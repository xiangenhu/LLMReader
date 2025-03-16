/**
 * LLM Reader - A tool to help people read PDFs with customized rendering
 * 
 * Features:
 * - Displays PDFs in an iframe, preserving original formatting
 * - Extracts text at mouse click position
 * - Processes extracted text with an LLM based on user preferences
 * - Tracks interaction metrics (latency, ready time) and sends to an LRS
 */

// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

class LLMReader {
    constructor() {
        this.currentDocument = null;
        this.documentType = 'pdf'; // Default to PDF
        this.pdfUrl = null;
        this.pdfData = null;
        this.extractedText = '';
        this.readParagraphs = new Set(); // Track read paragraphs
        this.metrics = {
            startTime: null,
            processingTimes: [],
            paragraphsProcessed: 0
        };
        
        this.initEventListeners();
    }
    
    initEventListeners() {
        // File drop area
        const fileDropArea = $('#file-drop');
        const fileInput = $('#file-input');
        
        fileDropArea.on('dragover', (e) => {
            e.preventDefault();
            fileDropArea.addClass('highlight');
        });
        
        fileDropArea.on('dragleave', () => {
            fileDropArea.removeClass('highlight');
        });
        
        fileDropArea.on('drop', (e) => {
            e.preventDefault();
            fileDropArea.removeClass('highlight');
            
            const file = e.originalEvent.dataTransfer.files[0];
            if (file) {
                this.loadDocument(file);
            }
        });
        
        fileInput.on('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.loadDocument(file);
            }
        });
        
        // URL input
        $('#fetch-url-btn').on('click', () => {
            const url = $('#url-input').val().trim();
            if (url) {
                this.fetchFromUrl(url);
            } else {
                alert('Please enter a valid URL');
            }
        });
        
        // Enter key in URL input
        $('#url-input').on('keypress', (e) => {
            if (e.which === 13) { // Enter key
                const url = $('#url-input').val().trim();
                if (url) {
                    this.fetchFromUrl(url);
                }
            }
        });
        
        // File type toggle
        $('input[name="file-type"]').on('change', (e) => {
            this.documentType = e.target.value;
            
            // Update file input accept attribute
            if (this.documentType === 'pdf') {
                $('#file-input').attr('accept', '.pdf');
            } else {
                $('#file-input').attr('accept', '.html,.htm');
            }
        });
        
        // Close overlay button
        $('#close-overlay').on('click', () => {
            $('#processing-overlay').hide();
        });
        
        // Process button
        $('#process-button').on('click', () => {
            this.processExtractedText();
        });
        
        // Document iframe click handler
        $('#document-iframe').on('load', () => {
            this.setupIframeInteractions();
        });
        
        // Start tracking metrics when a document is loaded
        $(document).on('document-loaded', () => {
            this.metrics.startTime = Date.now();
            this.updateMetricsDisplay();
            
            // Start tracking reading time
            this.readingTimeInterval = setInterval(() => {
                this.updateMetricsDisplay();
            }, 1000);
        });
        
        // Set default options
        $('#auto-process').prop('checked', true);
        $('#text-only').prop('checked', false);
        $('#dim-unread').prop('checked', false);
        
        // Dim unread text option
        $('#dim-unread').on('change', (e) => {
            if (e.target.checked) {
                this.applyDimming();
            } else {
                this.removeDimming();
            }
        });
    }
    
    async loadDocument(file) {
        try {
            // Determine file type based on extension or MIME type
            const fileType = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf' 
                ? 'pdf' 
                : 'html';
            
            // Reset state
            this.currentDocument = file;
            this.documentType = fileType;
            this.extractedText = '';
            this.readParagraphs = new Set(); // Reset read paragraphs
            
            // Update UI
            $('#processed-count').text('0');
            $('#total-count').text('0');
            
            // Reset metrics
            this.metrics = {
                startTime: Date.now(),
                processingTimes: [],
                paragraphsProcessed: 0
            };
            
            // Create a URL for the file
            if (fileType === 'pdf') {
                // For PDFs, we'll use PDF.js to render in a canvas within our page
                // This gives us more control over text extraction
                const arrayBuffer = await this.readFileAsArrayBuffer(file);
                this.pdfData = arrayBuffer;
                
                // Load the PDF using PDF.js
                const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
                this.currentDocument = pdf;
                
                // Create a simple HTML page with the PDF viewer
                const iframe = document.getElementById('document-iframe');
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                
                // Create a basic HTML structure for the PDF viewer
                iframeDoc.open();
                iframeDoc.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>PDF Viewer</title>
                        <style>
                            body { margin: 0; padding: 0; }
                            .pdf-page { position: relative; margin: 10px auto; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
                            .text-layer { position: absolute; top: 0; left: 0; right: 0; bottom: 0; color: transparent; }
                            .text-content { position: absolute; cursor: pointer; }
                            .text-content:hover { background-color: rgba(0,255,0,0.1); }
                            .paragraph-group { opacity: 0.5; transition: opacity 0.3s ease; }
                            .paragraph-group.read { opacity: 1; }
                        </style>
                    </head>
                    <body>
                        <div id="pdf-container"></div>
                    </body>
                    </html>
                `);
                iframeDoc.close();
                
                // Wait for the iframe to load
                await new Promise(resolve => {
                    iframe.onload = resolve;
                    // If already loaded, resolve immediately
                    if (iframeDoc.readyState === 'complete') {
                        resolve();
                    }
                });
                
                // Render the PDF in the iframe
                await this.renderPdfInIframe(pdf, iframe);
                
                // Set up click handlers in the iframe
                this.setupPdfClickHandlers(iframe);
                
                // Apply dimming if enabled
                if ($('#dim-unread').is(':checked')) {
                    this.applyDimming();
                }
                
                // Trigger document loaded event
                $(document).trigger('document-loaded');
            } else {
                // For HTML, we can load it directly in the iframe
                const text = await this.readFileAsText(file);
                const htmlBlob = new Blob([text], { type: 'text/html' });
                const htmlUrl = URL.createObjectURL(htmlBlob);
                
                // Load the HTML in the iframe
                const iframe = document.getElementById('document-iframe');
                iframe.src = htmlUrl;
                
                // Set up iframe load event
                iframe.onload = () => {
                    this.setupIframeInteractions();
                    
                    // Apply dimming if enabled
                    if ($('#dim-unread').is(':checked')) {
                        this.applyDimming();
                    }
                    
                    $(document).trigger('document-loaded');
                };
            }
        } catch (error) {
            console.error('Error loading document:', error);
            alert('Error loading document: ' + error.message);
        }
    }
    
    async fetchFromUrl(url) {
        try {
            // Show loading indicator
            const $loading = $('<div>').addClass('loading');
            $('#sidebar').append($loading);
            
            // Fetch document from URL
            const response = await $.ajax({
                url: '/fetch-url',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ url })
            });
            
            if (response.success) {
                // Reset state
                this.currentDocument = null;
                this.documentType = response.file.type;
                this.extractedText = '';
                this.readParagraphs = new Set(); // Reset read paragraphs
                
                // Update UI
                $('#processed-count').text('0');
                $('#total-count').text('0');
                
                // Reset metrics
                this.metrics = {
                    startTime: Date.now(),
                    processingTimes: [],
                    paragraphsProcessed: 0
                };
                
                // Load the document in the iframe
                const iframe = document.getElementById('document-iframe');
                iframe.src = response.file.path;
                
                // Set up iframe load event
                iframe.onload = () => {
                    this.setupIframeInteractions();
                    
                    // Apply dimming if enabled
                    if ($('#dim-unread').is(':checked')) {
                        this.applyDimming();
                    }
                    
                    $(document).trigger('document-loaded');
                };
            } else {
                alert('Failed to fetch document from URL');
            }
        } catch (error) {
            console.error('Error fetching from URL:', error);
            alert('Error fetching document: ' + (error.responseJSON?.error || error.statusText || error.message));
        } finally {
            // Remove loading indicator
            $('.loading').remove();
        }
    }
    
    async renderPdfInIframe(pdf, iframe) {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        const container = iframeDoc.getElementById('pdf-container');
        
        // Clear container
        container.innerHTML = '';
        
        // Get total pages
        const numPages = pdf.numPages;
        
        // Render each page
        for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const scale = 1.5;
            const viewport = page.getViewport({ scale });
            
            // Create page div
            const pageDiv = document.createElement('div');
            pageDiv.className = 'pdf-page';
            pageDiv.style.width = viewport.width + 'px';
            pageDiv.style.height = viewport.height + 'px';
            pageDiv.setAttribute('data-page-number', i);
            
            // Create canvas
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            // Render PDF page to canvas
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            // Add canvas to page div
            pageDiv.appendChild(canvas);
            
            // Create text layer
            const textLayer = document.createElement('div');
            textLayer.className = 'text-layer';
            
            // Get text content
            const textContent = await page.getTextContent();
            
            // Process text items
            textContent.items.forEach((item, index) => {
                const tx = pdfjsLib.Util.transform(
                    viewport.transform,
                    item.transform
                );
                
                const textDiv = document.createElement('div');
                textDiv.className = 'text-content';
                textDiv.setAttribute('data-text-index', index);
                textDiv.textContent = item.str;
                textDiv.style.left = tx[4] + 'px';
                textDiv.style.top = tx[5] + 'px';
                textDiv.style.fontSize = tx[0] + 'px';
                textDiv.style.width = item.width * scale + 'px';
                textDiv.style.height = item.height * scale + 'px';
                textDiv.style.position = 'absolute';
                textDiv.style.pointerEvents = 'auto';
                
                // Store the text content as a data attribute
                textDiv.setAttribute('data-text', item.str);
                
                textLayer.appendChild(textDiv);
            });
            
            // Add text layer to page div
            pageDiv.appendChild(textLayer);
            
            // Add page div to container
            container.appendChild(pageDiv);
        }
    }
    
    setupPdfClickHandlers(iframe) {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        
        // Add click event to all text elements
        const textElements = iframeDoc.querySelectorAll('.text-content');
        textElements.forEach(element => {
            element.addEventListener('click', (e) => {
                // Find the paragraph or section containing this text
                const text = this.extractPdfParagraph(e.target, iframeDoc);
                
                if (text && text.trim().length > 0) {
                    this.extractedText = text;
                    
                    // Mark the paragraph as read
                    this.markPdfParagraphAsRead(e.target, iframeDoc);
                    
                    // Display the extracted text
                    $('#original-text').text(text);
                    $('#processed-text').empty();
                    
                    // Show the processing overlay
                    $('#processing-overlay').css('display', 'flex');
                    
                    // Process the text if auto-process is enabled
                    if ($('#auto-process').is(':checked')) {
                        this.processExtractedText();
                    }
                }
            });
        });
    }
    
    markPdfParagraphAsRead(element, doc) {
        if ($('#dim-unread').is(':checked')) {
            try {
                // Get the page containing this element
                const page = element.closest('.pdf-page');
                if (!page) return;
                
                // Get paragraph boundaries
                const paragraphInfo = this.getPdfParagraphBoundaries(element, doc);
                if (!paragraphInfo) return;
                
                // Create a unique ID for this paragraph
                const paragraphId = `pdf-paragraph-${paragraphInfo.startLineIndex}-${paragraphInfo.endLineIndex}-${paragraphInfo.pageNumber}`;
                
                // Check if we already have a group for this paragraph
                let groupElement = doc.getElementById(paragraphId);
                
                if (!groupElement) {
                    // Create a group element for this paragraph
                    groupElement = doc.createElement('div');
                    groupElement.id = paragraphId;
                    groupElement.className = 'paragraph-group';
                    groupElement.style.position = 'absolute';
                    
                    // Position the group to cover the paragraph
                    const top = Math.min(...paragraphInfo.lines.flat().map(el => parseFloat(el.style.top)));
                    const left = Math.min(...paragraphInfo.lines.flat().map(el => parseFloat(el.style.left)));
                    const bottom = Math.max(...paragraphInfo.lines.flat().map(el => parseFloat(el.style.top) + parseFloat(el.style.height)));
                    const right = Math.max(...paragraphInfo.lines.flat().map(el => parseFloat(el.style.left) + parseFloat(el.style.width)));
                    
                    groupElement.style.top = `${top}px`;
                    groupElement.style.left = `${left}px`;
                    groupElement.style.width = `${right - left}px`;
                    groupElement.style.height = `${bottom - top}px`;
                    
                    // Add to the page
                    page.appendChild(groupElement);
                }
                
                // Mark as read
                groupElement.classList.add('read');
                this.readParagraphs.add(paragraphId);
                
            } catch (error) {
                console.error('Error marking PDF paragraph as read:', error);
            }
        }
    }
    
    getPdfParagraphBoundaries(element, doc) {
        // Get the page containing this element
        const page = element.closest('.pdf-page');
        if (!page) return null;
        
        const pageNumber = page.getAttribute('data-page-number');
        
        // Get all text elements on this page
        const textElements = Array.from(page.querySelectorAll('.text-content'));
        
        // Get the index of the clicked element
        const index = textElements.indexOf(element);
        if (index === -1) return null;
        
        // Sort text elements by vertical position (top to bottom)
        const sortedElements = [...textElements].sort((a, b) => {
            return parseFloat(a.style.top) - parseFloat(b.style.top);
        });
        
        // Group elements into lines based on vertical position
        const lines = [];
        let currentLine = [sortedElements[0]];
        
        for (let i = 1; i < sortedElements.length; i++) {
            const prevElement = sortedElements[i - 1];
            const currElement = sortedElements[i];
            
            const prevY = parseFloat(prevElement.style.top);
            const currY = parseFloat(currElement.style.top);
            
            // If vertical positions are close, they're on the same line
            if (Math.abs(currY - prevY) < 5) {
                currentLine.push(currElement);
            } else {
                // Sort line elements by horizontal position (left to right)
                currentLine.sort((a, b) => parseFloat(a.style.left) - parseFloat(b.style.left));
                lines.push(currentLine);
                currentLine = [currElement];
            }
        }
        
        // Add the last line
        if (currentLine.length > 0) {
            currentLine.sort((a, b) => parseFloat(a.style.left) - parseFloat(b.style.left));
            lines.push(currentLine);
        }
        
        // Find the line containing the clicked element
        let clickedLineIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(element)) {
                clickedLineIndex = i;
                break;
            }
        }
        
        if (clickedLineIndex === -1) {
            return null;
        }
        
        // Identify paragraph boundaries
        // A paragraph is a sequence of lines with similar indentation and spacing
        let startLineIndex = clickedLineIndex;
        let endLineIndex = clickedLineIndex;
        
        // Find the start of the paragraph (going upward)
        for (let i = clickedLineIndex - 1; i >= 0; i--) {
            const currLine = lines[i];
            const nextLine = lines[i + 1];
            
            // Check if there's a significant gap between lines
            const currBottom = Math.max(...currLine.map(el => parseFloat(el.style.top) + parseFloat(el.style.height)));
            const nextTop = Math.min(...nextLine.map(el => parseFloat(el.style.top)));
            
            // If the gap is too large, it's likely a paragraph break
            if (nextTop - currBottom > 15) {
                break;
            }
            
            // Check if indentation changes significantly
            const currLeft = Math.min(...currLine.map(el => parseFloat(el.style.left)));
            const nextLeft = Math.min(...nextLine.map(el => parseFloat(el.style.left)));
            
            // If indentation changes significantly, it's likely a paragraph break
            if (Math.abs(currLeft - nextLeft) > 20) {
                break;
            }
            
            startLineIndex = i;
        }
        
        // Find the end of the paragraph (going downward)
        for (let i = clickedLineIndex + 1; i < lines.length; i++) {
            const prevLine = lines[i - 1];
            const currLine = lines[i];
            
            // Check if there's a significant gap between lines
            const prevBottom = Math.max(...prevLine.map(el => parseFloat(el.style.top) + parseFloat(el.style.height)));
            const currTop = Math.min(...currLine.map(el => parseFloat(el.style.top)));
            
            // If the gap is too large, it's likely a paragraph break
            if (currTop - prevBottom > 15) {
                break;
            }
            
            // Check if indentation changes significantly
            const prevLeft = Math.min(...prevLine.map(el => parseFloat(el.style.left)));
            const currLeft = Math.min(...currLine.map(el => parseFloat(el.style.left)));
            
            // If indentation changes significantly, it's likely a paragraph break
            if (Math.abs(prevLeft - currLeft) > 20) {
                break;
            }
            
            endLineIndex = i;
        }
        
        return {
            startLineIndex,
            endLineIndex,
            pageNumber,
            lines: lines.slice(startLineIndex, endLineIndex + 1)
        };
    }
    
    extractPdfParagraph(element, doc) {
        // Get the page containing this element
        const page = element.closest('.pdf-page');
        if (!page) return element.getAttribute('data-text');
        
        // Get all text elements on this page
        const textElements = Array.from(page.querySelectorAll('.text-content'));
        
        // Get the index of the clicked element
        const index = textElements.indexOf(element);
        if (index === -1) return element.getAttribute('data-text');
        
        // Sort text elements by vertical position (top to bottom)
        const sortedElements = [...textElements].sort((a, b) => {
            return parseFloat(a.style.top) - parseFloat(b.style.top);
        });
        
        // Group elements into lines based on vertical position
        const lines = [];
        let currentLine = [sortedElements[0]];
        
        for (let i = 1; i < sortedElements.length; i++) {
            const prevElement = sortedElements[i - 1];
            const currElement = sortedElements[i];
            
            const prevY = parseFloat(prevElement.style.top);
            const currY = parseFloat(currElement.style.top);
            
            // If vertical positions are close, they're on the same line
            if (Math.abs(currY - prevY) < 5) {
                currentLine.push(currElement);
            } else {
                // Sort line elements by horizontal position (left to right)
                currentLine.sort((a, b) => parseFloat(a.style.left) - parseFloat(b.style.left));
                lines.push(currentLine);
                currentLine = [currElement];
            }
        }
        
        // Add the last line
        if (currentLine.length > 0) {
            currentLine.sort((a, b) => parseFloat(a.style.left) - parseFloat(b.style.left));
            lines.push(currentLine);
        }
        
        // Find the line containing the clicked element
        let clickedLineIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(element)) {
                clickedLineIndex = i;
                break;
            }
        }
        
        if (clickedLineIndex === -1) {
            return element.getAttribute('data-text');
        }
        
        // Identify paragraph boundaries
        // A paragraph is a sequence of lines with similar indentation and spacing
        let startLineIndex = clickedLineIndex;
        let endLineIndex = clickedLineIndex;
        
        // Find the start of the paragraph (going upward)
        for (let i = clickedLineIndex - 1; i >= 0; i--) {
            const currLine = lines[i];
            const nextLine = lines[i + 1];
            
            // Check if there's a significant gap between lines
            const currBottom = Math.max(...currLine.map(el => parseFloat(el.style.top) + parseFloat(el.style.height)));
            const nextTop = Math.min(...nextLine.map(el => parseFloat(el.style.top)));
            
            // If the gap is too large, it's likely a paragraph break
            if (nextTop - currBottom > 15) {
                break;
            }
            
            // Check if indentation changes significantly
            const currLeft = Math.min(...currLine.map(el => parseFloat(el.style.left)));
            const nextLeft = Math.min(...nextLine.map(el => parseFloat(el.style.left)));
            
            // If indentation changes significantly, it's likely a paragraph break
            if (Math.abs(currLeft - nextLeft) > 20) {
                break;
            }
            
            startLineIndex = i;
        }
        
        // Find the end of the paragraph (going downward)
        for (let i = clickedLineIndex + 1; i < lines.length; i++) {
            const prevLine = lines[i - 1];
            const currLine = lines[i];
            
            // Check if there's a significant gap between lines
            const prevBottom = Math.max(...prevLine.map(el => parseFloat(el.style.top) + parseFloat(el.style.height)));
            const currTop = Math.min(...currLine.map(el => parseFloat(el.style.top)));
            
            // If the gap is too large, it's likely a paragraph break
            if (currTop - prevBottom > 15) {
                break;
            }
            
            // Check if indentation changes significantly
            const prevLeft = Math.min(...prevLine.map(el => parseFloat(el.style.left)));
            const currLeft = Math.min(...currLine.map(el => parseFloat(el.style.left)));
            
            // If indentation changes significantly, it's likely a paragraph break
            if (Math.abs(prevLeft - currLeft) > 20) {
                break;
            }
            
            endLineIndex = i;
        }
        
        // Extract text from the identified paragraph
        let paragraphText = '';
        for (let i = startLineIndex; i <= endLineIndex; i++) {
            const lineText = lines[i]
                .map(el => el.getAttribute('data-text'))
                .join(' ');
            
            paragraphText += (i > startLineIndex ? ' ' : '') + lineText;
        }
        
        return paragraphText;
    }
    
    setupIframeInteractions() {
        try {
            const iframe = document.getElementById('document-iframe');
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            
            // Check if we can access the iframe content
            if (!iframeDoc) {
                console.error('Cannot access iframe content - possible cross-origin restriction');
                return;
            }
            
            // Add CSS for dimming if needed
            if ($('#dim-unread').is(':checked')) {
                this.applyDimming();
            }
            
            // For HTML documents, add click event listener
            if (this.documentType === 'html') {
                iframeDoc.addEventListener('click', (e) => {
                    // Extract text at click position
                    const text = this.extractTextFromHtml(e.target, iframeDoc);
                    
                    if (text && text.trim().length > 0) {
                        this.extractedText = text;
                        
                        // Mark the paragraph as read
                        this.markAsRead(e.target);
                        
                        // Display the extracted text
                        $('#original-text').text(text);
                        $('#processed-text').empty();
                        
                        // Show the processing overlay
                        $('#processing-overlay').css('display', 'flex');
                        
                        // Process the text if auto-process is enabled
                        if ($('#auto-process').is(':checked')) {
                            this.processExtractedText();
                        }
                    }
                });
            }
            
            console.log('Iframe interactions set up successfully');
        } catch (error) {
            console.error('Error setting up iframe interactions:', error);
        }
    }
    
    applyDimming() {
        try {
            const iframe = document.getElementById('document-iframe');
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            
            // Add CSS for dimming
            const style = iframeDoc.createElement('style');
            style.id = 'dimming-style';
            style.textContent = `
                body * {
                    opacity: 0.5;
                    transition: opacity 0.3s ease;
                }
                .read-paragraph {
                    opacity: 1 !important;
                }
                .paragraph-group {
                    opacity: 0.5;
                    transition: opacity 0.3s ease;
                }
                .paragraph-group.read {
                    opacity: 1 !important;
                }
            `;
            iframeDoc.head.appendChild(style);
        } catch (error) {
            console.error('Error applying dimming:', error);
        }
    }
    
    removeDimming() {
        try {
            const iframe = document.getElementById('document-iframe');
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            
            // Remove dimming style
            const style = iframeDoc.getElementById('dimming-style');
            if (style) {
                style.remove();
            }
        } catch (error) {
            console.error('Error removing dimming:', error);
        }
    }
    
    markAsRead(element) {
        try {
            if ($('#dim-unread').is(':checked')) {
                // Find the paragraph container
                const container = this.findTextContainer(element);
                if (container) {
                    // Add a class to mark it as read
                    container.classList.add('read-paragraph');
                    
                    // Store the paragraph ID or some identifier
                    const paragraphId = container.id || `paragraph-${Date.now()}`;
                    if (!container.id) {
                        container.id = paragraphId;
                    }
                    this.readParagraphs.add(paragraphId);
                }
            }
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    }
    
    findTextContainer(element) {
        // Try to find the most appropriate container (paragraph, section, etc.)
        const textContainers = ['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'DIV', 'SECTION', 'ARTICLE'];
        
        let container = element;
        while (container && !textContainers.includes(container.nodeName)) {
            container = container.parentNode;
            
            // Stop if we reach the document body
            if (container === document.body) {
                container = element;
                break;
            }
        }
        
        return container;
    }
    
    extractTextFromHtml(element, doc) {
        // Check if text-only mode is enabled
        const textOnly = $('#text-only').is(':checked');
// Try to find the most appropriate container (paragraph, section, etc.)
    const textContainers = ['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'DIV', 'SECTION', 'ARTICLE'];
    
    let container = element;
    while (container && !textContainers.includes(container.nodeName)) {
        container = container.parentNode;
        
        // Stop if we reach the document body
        if (container === doc.body) {
            container = element;
            break;
        }
    }
    
    if (textOnly) {
        // Extract only text content, ignoring buttons, inputs, etc.
        return this.getTextOnly(container);
    } else {
        return container ? container.textContent.trim() : element.textContent.trim();
    }
}

getTextOnly(element) {
    // Skip non-text elements
    if (!element) return '';
    
    // Skip buttons, inputs, and other interactive elements
    const skipTags = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'OPTION', 'SCRIPT', 'STYLE', 'IFRAME', 'CANVAS', 'SVG'];
    if (skipTags.includes(element.nodeName)) {
        return '';
    }
    
    // If it's a text node, return its content
    if (element.nodeType === Node.TEXT_NODE) {
        return element.textContent.trim();
    }
    
    // Recursively process child nodes
    let text = '';
    for (const child of element.childNodes) {
        text += this.getTextOnly(child);
    }
    
    return text.trim();
}

async processExtractedText() {
    if (!this.extractedText || this.extractedText.trim().length === 0) {
        return;
    }
    
    // Get user preferences
    const readingLevel = $('#reading-level').val();
    const language = $('#language').val();
    const style = $('#style').val();
    const model = $('#model').val();
    
    // Record start time for latency measurement
    const startTime = Date.now();
    
    try {
        // Process with LLM via server API
        const response = await $.ajax({
            url: '/api/process',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                text: this.extractedText,
                readingLevel: readingLevel,
                language: language,
                style: style,
                model: model,
                startTime: startTime,
                stream: false
            })
        });
        
        // Record end time and calculate latency
        const endTime = Date.now();
        const latency = response.latency || (endTime - startTime);
        
        // Update metrics
        this.metrics.processingTimes.push(latency);
        this.metrics.paragraphsProcessed++;
        this.updateMetricsDisplay();
        
        // Send metrics to server if tracking is enabled
        if ($('#track-metrics').is(':checked')) {
            this.sendMetricsToServer({
                action: 'processed',
                text: this.extractedText.substring(0, 100) + '...',
                latency: latency,
                readingLevel: readingLevel,
                language: language,
                style: style,
                model: model
            });
        }
        
        // Display processed text
        $('#processed-text').html(response.processedText);
        
        // Update processed count
        $('#processed-count').text(this.metrics.paragraphsProcessed);
    } catch (error) {
        console.error('Error processing text:', error);
        $('#processed-text').html(`<div style="color: red;">Error: ${error.message || 'Unknown error'}</div>`);
    }
}

sendMetricsToServer(data) {
    $.ajax({
        url: '/api/metrics',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(data),
        error: function(error) {
            console.error('Error sending metrics to server:', error);
        }
    });
}

updateMetricsDisplay() {
    // Update processed count
    $('#processed-count').text(this.metrics.paragraphsProcessed);
    
    // Calculate and update average latency
    if (this.metrics.processingTimes.length > 0) {
        const avgLatency = this.metrics.processingTimes.reduce((a, b) => a + b, 0) / this.metrics.processingTimes.length;
        $('#avg-latency').text(Math.round(avgLatency));
    }
    
    // Update reading time
    if (this.metrics.startTime) {
        const readingTime = Math.round((Date.now() - this.metrics.startTime) / 1000);
        $('#reading-time').text(readingTime);
    }
}
