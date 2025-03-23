/**
 * PDF Viewer - Uses PDF.js to display PDFs
 */

// The workerSrc property needs to be specified
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Create a simple PDF viewer
class PDFViewer {
    constructor(container) {
        this.container = container;
        this.pdfDoc = null;
        this.pageNum = 1;
        this.pageRendering = false;
        this.pageNumPending = null;
        this.scale = 1.0;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Add canvas to container
        this.container.appendChild(this.canvas);
        
        // Create navigation controls
        this.createControls();
    }
    
    createControls() {
        const controls = document.createElement('div');
        controls.className = 'pdf-controls';
        controls.style.padding = '10px';
        controls.style.backgroundColor = '#f5f5f5';
        controls.style.borderBottom = '1px solid #ddd';
        controls.style.display = 'flex';
        controls.style.alignItems = 'center';
        controls.style.justifyContent = 'center';
        
        // Previous page button (disabled)
        const prevButton = document.createElement('button');
        prevButton.textContent = 'Previous';
        prevButton.style.marginRight = '10px';
        prevButton.style.padding = '5px 10px';
        prevButton.disabled = true;
        // Navigation event listeners disabled
        
        // Page number display
        this.pageInfo = document.createElement('span');
        this.pageInfo.style.margin = '0 10px';
        
        // Next page button (disabled)
        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next';
        nextButton.style.marginLeft = '10px';
        nextButton.style.padding = '5px 10px';
        nextButton.disabled = true;
        // Navigation event listeners disabled
        
        // Zoom controls
        const zoomOutButton = document.createElement('button');
        zoomOutButton.textContent = '-';
        zoomOutButton.style.marginLeft = '20px';
        zoomOutButton.style.padding = '5px 10px';
        zoomOutButton.addEventListener('click', () => this.zoomOut());
        
        const zoomInButton = document.createElement('button');
        zoomInButton.textContent = '+';
        zoomInButton.style.marginLeft = '10px';
        zoomInButton.style.padding = '5px 10px';
        zoomInButton.addEventListener('click', () => this.zoomIn());
        
        // Add elements to controls
        controls.appendChild(prevButton);
        controls.appendChild(this.pageInfo);
        controls.appendChild(nextButton);
        controls.appendChild(zoomOutButton);
        controls.appendChild(zoomInButton);
        
        // Insert controls before canvas
        this.container.insertBefore(controls, this.canvas);
    }
    
    // Load a PDF from URL
    loadPDF(url) {
        // Using promise to fetch the PDF
        const loadingTask = pdfjsLib.getDocument(url);
        loadingTask.promise.then(pdfDoc => {
            this.pdfDoc = pdfDoc;
            this.pageInfo.textContent = `Page ${this.pageNum} of ${this.pdfDoc.numPages}`;
            
            // Initial render
            this.renderPage(this.pageNum);
            
            // Add click handler for text extraction
            this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
            
            console.log('PDF loaded successfully');
        }).catch(error => {
            console.error('Error loading PDF:', error);
        });
    }
    
    // Render a specific page
    renderPage(num) {
        this.pageRendering = true;
        
        // Get page
        this.pdfDoc.getPage(num).then(page => {
            // Adjust canvas size to page size with scale
            const viewport = page.getViewport({ scale: this.scale });
            this.canvas.height = viewport.height;
            this.canvas.width = viewport.width;
            
            // Render PDF page into canvas context
            const renderContext = {
                canvasContext: this.ctx,
                viewport: viewport
            };
            
            const renderTask = page.render(renderContext);
            
            // Wait for rendering to finish
            renderTask.promise.then(() => {
                this.pageRendering = false;
                
                if (this.pageNumPending !== null) {
                    // New page rendering is pending
                    this.renderPage(this.pageNumPending);
                    this.pageNumPending = null;
                }
            });
        });
        
        // Update page info
        this.pageInfo.textContent = `Page ${num} of ${this.pdfDoc.numPages}`;
    }
    
    // Go to previous page
    prevPage() {
        if (this.pageNum <= 1) {
            return;
        }
        this.pageNum--;
        this.queueRenderPage(this.pageNum);
    }
    
    // Go to next page
    nextPage() {
        if (this.pageNum >= this.pdfDoc.numPages) {
            return;
        }
        this.pageNum++;
        this.queueRenderPage(this.pageNum);
    }
    
    // Zoom in
    zoomIn() {
        this.scale += 0.25;
        this.queueRenderPage(this.pageNum);
    }
    
    // Zoom out
    zoomOut() {
        if (this.scale <= 0.5) {
            return;
        }
        this.scale -= 0.25;
        this.queueRenderPage(this.pageNum);
    }
    
    // Queue rendering of a page
    queueRenderPage(num) {
        if (this.pageRendering) {
            this.pageNumPending = num;
        } else {
            this.renderPage(num);
        }
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
    
    // Handle canvas click for text extraction
    async handleCanvasClick(e) {
        // Get click coordinates relative to canvas
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        console.log('Canvas clicked at:', x, y);
        
        try {
            // Get current page
            const page = await this.pdfDoc.getPage(this.pageNum);
            
            // Get text content
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
            
            // Convert viewport coordinates to PDF coordinates
            const viewport = page.getViewport({ scale: this.scale });
            const pdfX = x / this.scale;
            const pdfY = (viewport.height - y) / this.scale;
            
            // Find text items near click position
            const clickedItems = [];
            const yThreshold = 5; // Items within this vertical distance are considered part of the same line
            let clickedY = null;
            let minDistance = 50; // Initial threshold for finding the closest item
            
            // First, find the item closest to the click
            for (const item of nonButtonItems) {
                // Calculate distance from click to text item
                const dx = Math.abs(item.transform[4] - pdfX);
                const dy = Math.abs(item.transform[5] - pdfY);
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < minDistance) {
                    minDistance = distance;
                    clickedY = item.transform[5]; // Y position of the closest item
                }
            }
            
            // If we found a closest item, collect all items on the same line and nearby lines
            if (clickedY !== null) {
                // Sort items by y position (line) and then by x position (order in line)
                const sortedItems = [...nonButtonItems].sort((a, b) => {
                    // First sort by y position (with some tolerance for same line)
                    const yDiff = Math.abs(a.transform[5] - b.transform[5]);
                    if (yDiff > yThreshold) {
                        return b.transform[5] - a.transform[5]; // Descending y order
                    }
                    // If on same line, sort by x position
                    return a.transform[4] - b.transform[4]; // Ascending x order
                });
                
                // Group items by line (y position)
                const lines = [];
                let currentLine = [];
                let currentY = null;
                
                for (const item of sortedItems) {
                    if (currentY === null) {
                        currentY = item.transform[5];
                        currentLine.push(item);
                    } else if (Math.abs(item.transform[5] - currentY) <= yThreshold) {
                        // Same line
                        currentLine.push(item);
                    } else {
                        // New line
                        lines.push(currentLine);
                        currentLine = [item];
                        currentY = item.transform[5];
                    }
                }
                
                // Add the last line if not empty
                if (currentLine.length > 0) {
                    lines.push(currentLine);
                }
                
                // Find the line containing the clicked position
                let clickedLineIndex = -1;
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    for (const item of line) {
                        if (Math.abs(item.transform[5] - clickedY) <= yThreshold) {
                            clickedLineIndex = i;
                            break;
                        }
                    }
                    if (clickedLineIndex !== -1) break;
                }
                
                // Extract text from the clicked line and surrounding lines (paragraph)
                if (clickedLineIndex !== -1) {
                    // Get a few lines before and after to form a paragraph
                    const startLine = Math.max(0, clickedLineIndex - 2);
                    const endLine = Math.min(lines.length - 1, clickedLineIndex + 2);
                    
                    let extractedText = '';
                    for (let i = startLine; i <= endLine; i++) {
                        const lineText = lines[i].map(item => item.str).join(' ');
                        extractedText += lineText + ' ';
                    }
                    
                    extractedText = extractedText.trim();
                    
                    if (extractedText) {
                        console.log('Extracted text:', extractedText);
                        
                        // Dispatch a custom event with the extracted text
                        const event = new CustomEvent('pdf-text-extracted', {
                            detail: { text: extractedText }
                        });
                        document.dispatchEvent(event);
                        
                        // Also send message to parent window
                        if (window.parent !== window) {
                            window.parent.postMessage({
                                type: 'pdf-text-extracted',
                                text: extractedText
                            }, '*');
                        }
                        
                        return;
                    }
                }
            }
            
            // Fallback: if we couldn't extract a paragraph, get all text from the page (excluding buttons)
            const pageText = nonButtonItems.map(item => item.str).join(' ');
            if (pageText) {
                console.log('Extracted page text (fallback)');
                
                // Dispatch a custom event with the extracted text
                const event = new CustomEvent('pdf-text-extracted', {
                    detail: { text: pageText }
                });
                document.dispatchEvent(event);
                
                // Also send message to parent window
                if (window.parent !== window) {
                    window.parent.postMessage({
                        type: 'pdf-text-extracted',
                        text: pageText
                    }, '*');
                }
            } else {
                console.log('No text found on page');
            }
        } catch (error) {
            console.error('Error extracting text:', error);
        }
    }
}

// Initialize the viewer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('pdf-container');
    if (container) {
        const viewer = new PDFViewer(container);
        
        // Get PDF URL from query parameter
        const urlParams = new URLSearchParams(window.location.search);
        const pdfUrl = urlParams.get('url');
        
        if (pdfUrl) {
            viewer.loadPDF(pdfUrl);
        } else {
            console.error('No PDF URL provided');
            container.innerHTML = '<p>Error: No PDF URL provided. Use ?url=path/to/pdf.pdf in the URL.</p>';
        }
        
        // Make viewer available globally
        window.pdfViewer = viewer;
    }
});
