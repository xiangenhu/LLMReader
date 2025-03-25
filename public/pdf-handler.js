/**
 * PDF Handler - Handles PDF-specific functionality
 */

class PDFHandler {
    constructor(reader) {
        this.reader = reader;
        
        // Initialize PDF.js
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        // Bind methods to this instance to maintain proper 'this' context
        this.handlePdfClick = this.handlePdfClick.bind(this);
        this.extractTextFromPdf = this.extractTextFromPdf.bind(this);
        this.setupIframeInteractions = this.setupIframeInteractions.bind(this);
        this.handleIframeMessage = this.handleIframeMessage.bind(this);
        
        // Add event listener for messages from the iframe
        window.addEventListener('message', this.handleIframeMessage);
    }
    
    // Handle messages from the iframe
    handleIframeMessage(event) {
        // Check if the message is from our iframe
        if (event.data && event.data.type === 'pdf-click') {
            console.log('PDF click events are disabled');
            // Do not process click events
        } else if (event.data && event.data.type === 'pdf-text-extracted') {
            console.log('Received extracted text from iframe:', event.data.text);
            
            // Process the extracted text
            if (event.data.text && event.data.text.trim().length > 0) {
                this.reader.extractedText = event.data.text;
                
                // Display the extracted text
                $('#original-text').text(event.data.text);
                $('#processed-text').empty();
                
                // Show the processing overlay
                $('#processing-overlay').css('display', 'flex');
                
                // Clear clipboard to prevent processing the same text twice
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText('')
                        .then(() => {
                            console.log('Clipboard cleared after PDF text extraction');
                        })
                        .catch(err => {
                            console.error('Failed to clear clipboard:', err);
                        });
                }
                
                // Always process the text automatically
                this.reader.llmHandler.processExtractedText(event.data.text);
                
                // Set up the Learning button to send text to the assessment URL
                $('#learning-button').off('click').on('click', () => {
                    this.reader.llmHandler.sendTextToAssessment(event.data.text);
                });
            }
        }
    }
    
    loadPdf(file) {
        if (!file || file.type !== 'application/pdf') {
            console.error('Invalid file type. Expected PDF.');
            return;
        }
        
        console.log('Loading PDF from file');
        
        // Update UI to show document interface
        this.reader.showDocumentInterface();
        
        // Show instructions for highlighting
        this.showHighlightInstructions();
        
        // Load the document
        this.loadDocument(file);
    }
    
    // Show instructions for highlighting (no popup, just log to console)
    showHighlightInstructions() {
        console.log('PDF loaded - copy and paste mode active');
    }
    
    async loadDocument(file) {
        try {
            console.log('Loading PDF document from file');
            
            // Create a URL for the PDF file
            const pdfBlob = new Blob([await this.reader.readFileAsArrayBuffer(file)], { type: 'application/pdf' });
            this.reader.pdfUrl = URL.createObjectURL(pdfBlob);
            
            console.log('Created blob URL for PDF:', this.reader.pdfUrl);
            
            // Load the PDF in the iframe
            const iframe = document.getElementById('document-iframe');
            
            // Remove any existing sandbox attribute that might restrict functionality
            iframe.removeAttribute('sandbox');
            
            // Add sandbox attribute with necessary permissions
            iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms');
            
            // Set up iframe load event before changing src
            iframe.onload = () => {
                console.log('PDF iframe loaded from file');
                
                // Set up iframe interactions with a slight delay to ensure the PDF is fully loaded
                setTimeout(() => {
                    this.setupIframeInteractions(iframe);
                    $(document).trigger('pdf-loaded');
                    
                    // Add a direct click handler to the iframe
                    iframe.addEventListener('click', this.handlePdfClick);
                    
                    // Also add a mousedown event as a backup
                    iframe.addEventListener('mousedown', this.handlePdfClick);
                    
                    console.log('PDF click handlers added to iframe');
                }, 500);
            };
            
            // Use our custom PDF viewer
            iframe.src = `/pdf-viewer.html?url=${encodeURIComponent(this.reader.pdfUrl)}`;
            
            // Reset metrics
            this.reader.metrics = {
                startTime: Date.now(),
                processingTimes: [],
                paragraphsProcessed: 0,
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                lexicalDensity: 0,
                speechActs: [],
                lastPromptTime: null
            };
            
            // Update UI
            $('#processed-count').text('0');
            $('#total-count').text('0');
            
        } catch (error) {
            console.error('Error loading PDF:', error);
            // No alert, just log to console
        }
    }
    
    loadPdfFromUrl(url) {
        if (!url) {
            console.error('URL is required');
            return;
        }
        
        console.log('Loading PDF from URL:', url);
        
        // Update UI to show document interface
        this.reader.showDocumentInterface();
        
        // Store the PDF URL
        this.reader.pdfUrl = url;
        
        // Get the iframe element
        const iframe = document.getElementById('document-iframe');
        
        // Remove any existing sandbox attribute
        iframe.removeAttribute('sandbox');
        
        // Add sandbox attribute with necessary permissions
        iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms');
        
        // Set up iframe load event
        iframe.onload = () => {
            console.log('PDF iframe loaded from URL');
            
            // Set up iframe interactions with a slight delay to ensure the PDF is fully loaded
            setTimeout(() => {
                this.setupIframeInteractions(iframe);
                $(document).trigger('pdf-loaded');
                console.log('PDF click handlers added to iframe');
            }, 1000);
        };
        
        // Use our custom PDF viewer
        iframe.src = `/pdf-viewer.html?url=${encodeURIComponent(url)}`;
        
        // Reset metrics
        this.reader.metrics = {
            startTime: Date.now(),
            processingTimes: [],
            paragraphsProcessed: 0,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            lexicalDensity: 0,
            speechActs: [],
            lastPromptTime: null
        };
        
        // Update UI
        $('#processed-count').text('0');
        $('#total-count').text('0');
    }
    
    setupIframeInteractions(iframe) {
        try {
            console.log('PDF events disabled - only copy and paste allowed');
            
            // If iframe is not provided, get it from the DOM
            if (!iframe) {
                iframe = document.getElementById('document-iframe');
            }
            
            if (!iframe) {
                console.error('Iframe not available');
                return;
            }
            
            // Remove any existing click handlers
            iframe.removeEventListener('click', this.handlePdfClick);
            iframe.removeEventListener('mousedown', this.handlePdfClick);
            
            // Remove click handler from document body
            document.body.removeEventListener('click', this.handlePdfClick);
            
            // Try to remove click handler from iframe's content document if possible
            try {
                if (iframe.contentDocument) {
                    iframe.contentDocument.removeEventListener('click', this.handlePdfClick);
                }
            } catch (contentError) {
                console.error('Could not access iframe content document:', contentError);
            }
            
            console.log('PDF events disabled successfully');
            
            // Show instructions for copy and paste
            this.showCopyPasteInstructions();
        } catch (error) {
            console.error('Error disabling PDF events:', error);
        }
    }
    
    // Show instructions for copy and paste (no popup, just update text area)
    showCopyPasteInstructions() {
        console.log('Copy & Paste Mode: Select text in the PDF, copy it (Ctrl+C), and paste it (Ctrl+V)');
        
        // Show a message in the original-text area
        $('#original-text').text('Select text in the PDF, copy it (Ctrl+C), and paste it (Ctrl+V) to process.');
    }
    
    // No longer automatically extract text - user must highlight text
    async extractAndDisplayText() {
        // Instead of automatically extracting text, show instructions to highlight
        console.log('PDF loaded - waiting for user to highlight text');
        
        // Show a message in the original-text area
        $('#original-text').text('Please use the Highlight Mode button in the PDF viewer to select text for processing.');
    }
    
    // Handle PDF click event
    async handlePdfClick(e) {
        // Prevent the default action
        if (e && e.preventDefault) {
            e.preventDefault();
        }
        
        console.log('Handling PDF click event at position:', e.clientX, e.clientY);
        
        // Extract text from the clicked paragraph
        const text = await this.extractTextAtPosition(e.clientX, e.clientY);
        
        if (text && text.trim().length > 0) {
            console.log('Extracted text:', text.substring(0, 50) + '...');
            this.reader.extractedText = text;
            
            // Display the extracted text
            $('#original-text').text(text);
            $('#processed-text').empty();
            
            // Show the processing overlay
            $('#processing-overlay').css('display', 'flex');
            
            // Clear clipboard to prevent processing the same text twice
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText('')
                    .then(() => {
                        console.log('Clipboard cleared after PDF text extraction');
                    })
                    .catch(err => {
                        console.error('Failed to clear clipboard:', err);
                    });
            }
            
            // Always process the text automatically
            this.reader.llmHandler.processExtractedText(text);
            
            // Set up the Learning button to send text to the assessment URL
            $('#learning-button').off('click').on('click', () => {
                this.reader.llmHandler.sendTextToAssessment(text);
            });
        } else {
            console.log('No text extracted from PDF');
            // No alert, just log to console
        }
    }
    
    // Extract text at a specific position in the PDF
    async extractTextAtPosition(x, y) {
        try {
            console.log('Extracting text from PDF at position:', x, y);
            
            const iframe = document.getElementById('document-iframe');
            if (!iframe) {
                console.error('Iframe not available for text extraction');
                return '';
            }
            
            // Try to get the element at the click position
            try {
                if (iframe.contentDocument) {
                    const element = iframe.contentDocument.elementFromPoint(x, y);
                    if (element) {
                        // Try to find the paragraph or section containing the clicked element
                        const container = this.findTextContainer(element);
                        
                        // Always extract only text content, ignoring buttons, inputs, etc.
                        return this.getTextOnly(container || element);
                    }
                }
            } catch (contentError) {
                console.error('Error accessing iframe contentDocument for text extraction:', contentError);
            }
            
            // If we couldn't extract text at the position, fall back to extracting from the current page
            return await this.extractTextFromCurrentPage();
        } catch (error) {
            console.error('Error extracting text at position:', error);
            return '';
        }
    }
    
    // Find the text container (paragraph, section, etc.) containing the element
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
    
    // Extract text from the current page of the PDF
    async extractTextFromCurrentPage() {
        try {
            console.log('Extracting text from current PDF page');
            
            const iframe = document.getElementById('document-iframe');
            if (!iframe || !iframe.contentDocument) {
                return '';
            }
            
            // Try to get text from visible paragraphs
            const paragraphs = iframe.contentDocument.querySelectorAll('p, div');
            if (paragraphs.length > 0) {
                // Get text from the first few paragraphs
                let text = '';
                for (let i = 0; i < Math.min(3, paragraphs.length); i++) {
                    text += paragraphs[i].textContent.trim() + ' ';
                }
                return text.trim();
            }
            
            // If no paragraphs found, get text from the current page
            const currentPageText = iframe.contentDocument.body.textContent.trim();
            if (currentPageText) {
                // Limit to a reasonable length
                return currentPageText.substring(0, 1000);
            }
            
            return '';
        } catch (error) {
            console.error('Error extracting text from current page:', error);
            return '';
        }
    }
    
    // Helper method to extract only text content, ignoring buttons, inputs, etc.
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
    
    // Helper function to check if text is likely a button
    isLikelyButton(item) {
        // Check if text is short (typical for buttons)
        const isShortText = item.str.length < 20;
        
        // Check if text contains common button words
        const buttonWords = ['submit', 'cancel', 'ok', 'yes', 'no', 'next', 'prev', 'back', 'continue', 'save'];
        const containsButtonWord = buttonWords.some(word => 
            item.str.toLowerCase().includes(word));
        
        // Check if text is all uppercase (common for buttons)
        const isAllUppercase = item.str === item.str.toUpperCase() && item.str.length > 1;
        
        // If it's a short text AND (contains button word OR is all uppercase), it's likely a button
        return isShortText && (containsButtonWord || isAllUppercase);
    }
    
    async extractTextFromPdf() {
        console.log('Extracting text from PDF at URL:', this.reader.pdfUrl);
        
        try {
            // Create a new PDF.js task to load the PDF directly
            let pdfUrl = this.reader.pdfUrl;
            
            // If it's a blob URL (from file upload), we need to handle it differently
            if (pdfUrl.startsWith('blob:')) {
                console.log('Using blob URL directly');
            } else {
                // For remote URLs, we might need to use a proxy or CORS-enabled endpoint
                console.log('Using remote URL');
            }
            
            // Load the PDF document
            const loadingTask = pdfjsLib.getDocument(pdfUrl);
            const pdf = await loadingTask.promise;
            console.log('PDF loaded with', pdf.numPages, 'pages');
            
            // Extract text from all pages (up to 5 pages to avoid too much processing)
            const maxPages = Math.min(5, pdf.numPages);
            let allText = '';
            
            for (let i = 1; i <= maxPages; i++) {
                console.log(`Extracting text from page ${i}`);
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                
                // Get annotations (which might include buttons/form fields)
                const annotations = await page.getAnnotations();
                
                // Create a set of positions to ignore (button positions)
                const buttonPositions = new Set();
                
                // Add annotation positions to ignore (buttons, form fields, etc.)
                for (const annotation of annotations) {
                    if (annotation.subtype === 'Widget' || // Form fields
                        annotation.fieldType === 'Btn') {  // Buttons
                        
                        // Add the position to ignore
                        if (annotation.rect) {
                            const centerX = (annotation.rect[0] + annotation.rect[2]) / 2;
                            const centerY = (annotation.rect[1] + annotation.rect[3]) / 2;
                            buttonPositions.add(`${Math.round(centerX)},${Math.round(centerY)}`);
                        }
                    }
                }
                
                // Filter out items that are likely buttons
                const nonButtonItems = textContent.items.filter(item => {
                    // Check if item position matches any button position
                    const itemPos = `${Math.round(item.transform[4])},${Math.round(item.transform[5])}`;
                    if (buttonPositions.has(itemPos)) {
                        return false;
                    }
                    
                    // Also filter based on text content that looks like a button
                    return !this.isLikelyButton(item);
                });
                
                // Join the filtered text items
                const pageText = nonButtonItems.map(item => item.str).join(' ');
                allText += pageText + ' ';
            }
            
            return allText.trim();
        } catch (pdfError) {
            console.error('Error extracting text from PDF:', pdfError);
            
            // Try an alternative approach - get text from the iframe directly
            try {
                console.log('Trying alternative text extraction method');
                const iframe = document.getElementById('document-iframe');
                if (iframe && iframe.contentDocument && iframe.contentDocument.body) {
                    const iframeText = iframe.contentDocument.body.textContent;
                    if (iframeText && iframeText.trim().length > 0) {
                        return iframeText.trim();
                    }
                }
            } catch (iframeError) {
                console.error('Alternative extraction also failed:', iframeError);
            }
            
            // If all else fails, try to use a hardcoded sample text
            return 'Sample text for testing. This is a placeholder text that was generated because the PDF text extraction failed.';
        }
    }
}
