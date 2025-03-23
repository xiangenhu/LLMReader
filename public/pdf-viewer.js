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
        
        // Create a wrapper div for positioning
        this.wrapper = document.createElement('div');
        this.wrapper.style.position = 'relative';
        this.wrapper.style.width = 'fit-content';
        this.wrapper.style.margin = '0 auto';
        this.container.appendChild(this.wrapper);
        
        // Create canvas with text selection enabled
        this.canvas = document.createElement('canvas');
        this.canvas.style.userSelect = 'text'; // Enable text selection
        this.canvas.style.webkitUserSelect = 'text'; // For Safari
        this.canvas.style.cursor = 'text'; // Show text cursor
        this.ctx = this.canvas.getContext('2d');
        this.wrapper.appendChild(this.canvas);
        
        // Create navigation controls
        this.createControls();
        
    // Disable highlighting functionality
    this.isHighlighting = false;
    this.highlightStartX = null;
    this.highlightStartY = null;
    this.highlightedText = '';
    
    // Add a message about copy-paste mode
    const copyPasteMessage = document.createElement('div');
    copyPasteMessage.className = 'copy-paste-message';
    copyPasteMessage.style.position = 'absolute';
    copyPasteMessage.style.top = '10px';
    copyPasteMessage.style.left = '50%';
    copyPasteMessage.style.transform = 'translateX(-50%)';
    copyPasteMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    copyPasteMessage.style.color = 'white';
    copyPasteMessage.style.padding = '10px 15px';
    copyPasteMessage.style.borderRadius = '5px';
    copyPasteMessage.style.zIndex = '100';
    copyPasteMessage.style.fontSize = '14px';
    copyPasteMessage.style.textAlign = 'center';
    copyPasteMessage.textContent = 'Copy & Paste Mode: Select text, copy (Ctrl+C), and paste (Ctrl+V)';
    this.wrapper.appendChild(copyPasteMessage);
    
    // Auto-hide the message after 10 seconds
    setTimeout(() => {
        copyPasteMessage.style.opacity = '0';
        copyPasteMessage.style.transition = 'opacity 1s ease';
        setTimeout(() => {
            if (this.wrapper.contains(copyPasteMessage)) {
                this.wrapper.removeChild(copyPasteMessage);
            }
        }, 1000);
    }, 10000);
        
        // Add debug info for highlighting (will be hidden in production)
        this.debugInfo = document.createElement('div');
        this.debugInfo.style.position = 'fixed';
        this.debugInfo.style.bottom = '10px';
        this.debugInfo.style.right = '10px';
        this.debugInfo.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.debugInfo.style.color = 'white';
        this.debugInfo.style.padding = '5px';
        this.debugInfo.style.fontSize = '12px';
        this.debugInfo.style.fontFamily = 'monospace';
        this.debugInfo.style.zIndex = '1000';
        this.debugInfo.style.display = 'none'; // Hidden by default
        document.body.appendChild(this.debugInfo);
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
        controls.style.marginBottom = '10px';
        
        // Previous page button
        const prevButton = document.createElement('button');
        prevButton.textContent = 'Previous';
        prevButton.style.marginRight = '10px';
        prevButton.style.padding = '5px 10px';
        prevButton.addEventListener('click', () => this.prevPage());
        
        // Page number display
        this.pageInfo = document.createElement('span');
        this.pageInfo.style.margin = '0 10px';
        
        // Next page button
        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next';
        nextButton.style.marginLeft = '10px';
        nextButton.style.padding = '5px 10px';
        nextButton.addEventListener('click', () => this.nextPage());
        
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
        
        // Copy & Paste mode label (not a button)
        const copyPasteLabel = document.createElement('div');
        copyPasteLabel.textContent = 'Copy & Paste Mode';
        copyPasteLabel.style.marginLeft = '20px';
        copyPasteLabel.style.padding = '5px 10px';
        copyPasteLabel.style.backgroundColor = '#4CAF50';
        copyPasteLabel.style.color = 'white';
        copyPasteLabel.style.fontWeight = 'bold';
        copyPasteLabel.style.borderRadius = '4px';
        
        // Add elements to controls
        controls.appendChild(prevButton);
        controls.appendChild(this.pageInfo);
        controls.appendChild(nextButton);
        controls.appendChild(zoomOutButton);
        controls.appendChild(zoomInButton);
        controls.appendChild(copyPasteLabel);
        
        // Insert controls at the top of container
        this.container.insertBefore(controls, this.container.firstChild);
    }
    
    // Toggle highlight mode (disabled in copy-paste mode)
    toggleHighlightMode() {
        // Do nothing - highlighting is disabled in copy-paste mode
        console.log('Highlight mode is disabled in copy-paste mode');
        return;
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
            
            // Set up event listeners for highlighting
            this.setupHighlightListeners();
            
            console.log('PDF loaded successfully');
        }).catch(error => {
            console.error('Error loading PDF:', error);
        });
    }
    
    // Set up event listeners for highlighting (completely disabled in copy-paste mode)
    setupHighlightListeners() {
        // No event listeners for highlighting - we're in copy-paste mode only
        console.log('Highlight listeners disabled - using copy-paste mode only');
        // No mouse event listeners are added - users must use browser's native text selection
    }
    
    // Update debug info
    updateDebugInfo(action, x, y, left, top, width, height) {
        // Only show in development mode
        if (this.debugInfo.style.display === 'block') {
            let info = `Action: ${action}<br>`;
            info += `X: ${Math.round(x)}, Y: ${Math.round(y)}<br>`;
            
            if (left !== undefined) {
                info += `Left: ${Math.round(left)}, Top: ${Math.round(top)}<br>`;
                info += `Width: ${Math.round(width)}, Height: ${Math.round(height)}`;
            }
            
            this.debugInfo.innerHTML = info;
        }
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
            
            // Remove any existing text layer
            if (this.textLayer) {
                this.wrapper.removeChild(this.textLayer);
            }
            
            // Create text layer for selection
            this.textLayer = document.createElement('div');
            this.textLayer.className = 'textLayer';
            this.textLayer.style.position = 'absolute';
            this.textLayer.style.left = '0';
            this.textLayer.style.top = '0';
            this.textLayer.style.width = `${viewport.width}px`;
            this.textLayer.style.height = `${viewport.height}px`;
            this.textLayer.style.overflow = 'hidden';
            this.textLayer.style.opacity = '1'; // Make fully visible
            this.textLayer.style.color = 'transparent'; // Text is transparent
            this.textLayer.style.userSelect = 'text';
            this.textLayer.style.webkitUserSelect = 'text';
            this.textLayer.style.mozUserSelect = 'text';
            this.textLayer.style.msUserSelect = 'text';
            this.textLayer.style.cursor = 'text';
            this.textLayer.style.zIndex = '1'; // Place above canvas
            
            // Add CSS for text selection highlighting
            const style = document.createElement('style');
            style.textContent = `
                .textLayer ::selection {
                    background: rgba(0, 0, 255, 0.3);
                }
                .textLayer > span {
                    cursor: text;
                }
                .textLayer > span::selection {
                    background: rgba(0, 0, 255, 0.3);
                }
            `;
            document.head.appendChild(style);
            
            this.wrapper.appendChild(this.textLayer);
            
            const renderTask = page.render(renderContext);
            
            // Get the text content of the page
            page.getTextContent().then(textContent => {
                // Create text layer
                pdfjsLib.renderTextLayer({
                    textContent: textContent,
                    container: this.textLayer,
                    viewport: viewport,
                    textDivs: []
                });
            });
            
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
    
    // Extract text from highlighted area
    async extractHighlightedText(startX, startY, endX, endY) {
        try {
            // Get current page
            const page = await this.pdfDoc.getPage(this.pageNum);
            
            // Get text content
            const textContent = await page.getTextContent();
            
            // Convert viewport coordinates to PDF coordinates
            const viewport = page.getViewport({ scale: this.scale });
            const pdfStartX = Math.min(startX, endX) / this.scale;
            const pdfEndX = Math.max(startX, endX) / this.scale;
            const pdfStartY = (viewport.height - Math.max(startY, endY)) / this.scale;
            const pdfEndY = (viewport.height - Math.min(startY, endY)) / this.scale;
            
            console.log('Highlight area in PDF coordinates:', 
                        pdfStartX, pdfStartY, pdfEndX, pdfEndY);
            
            // Filter text items that are within the highlighted area
            const highlightedItems = [];
            
            // Use a more relaxed approach to find text in the highlighted area
            for (const item of textContent.items) {
                const itemX = item.transform[4];
                const itemY = item.transform[5];
                const itemWidth = item.width || 20; // Use default width if not provided
                const itemHeight = 10; // Estimate height
                
                // Check if item overlaps with the highlighted rectangle
                const overlapsX = (itemX + itemWidth >= pdfStartX - 5) && (itemX <= pdfEndX + 5);
                const overlapsY = (itemY >= pdfStartY - 5) && (itemY - itemHeight <= pdfEndY + 5);
                
                if (overlapsX && overlapsY) {
                    highlightedItems.push(item);
                    console.log('Found item in highlight:', item.str, itemX, itemY);
                }
            }
            
            if (highlightedItems.length > 0) {
                // Sort by y-position (line) and then x-position (order in line)
                const sortedItems = highlightedItems.sort((a, b) => {
                    // First sort by y position (with some tolerance for same line)
                    const yDiff = Math.abs(a.transform[5] - b.transform[5]);
                    if (yDiff > 5) {
                        return b.transform[5] - a.transform[5]; // Descending y order
                    }
                    // If on same line, sort by x position
                    return a.transform[4] - b.transform[4]; // Ascending x order
                });
                
                // Group items by line
                const lines = [];
                let currentLine = [];
                let currentY = null;
                
                for (const item of sortedItems) {
                    if (currentY === null) {
                        currentY = item.transform[5];
                        currentLine.push(item);
                    } else if (Math.abs(item.transform[5] - currentY) <= 5) {
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
                
                // Extract text from lines
                let extractedText = '';
                for (const line of lines) {
                    const lineText = line.map(item => item.str).join(' ');
                    extractedText += lineText + ' ';
                }
                
                extractedText = extractedText.trim();
                
                if (extractedText) {
                    this.highlightedText = extractedText;
                    console.log('Extracted text from highlight:', extractedText);
                    
                    // Send the extracted text to the parent window
                    this.sendExtractedText(extractedText);
                    return;
                }
            }
            
            // If we still couldn't extract text, try a more aggressive approach
            if (highlightedItems.length === 0) {
                console.log('No items found in highlight area, trying broader search');
                
                // Get all text from the page and filter by position
                const allText = textContent.items.map(item => ({
                    text: item.str,
                    x: item.transform[4],
                    y: item.transform[5],
                    distance: Math.min(
                        Math.sqrt(Math.pow(item.transform[4] - pdfStartX, 2) + Math.pow(item.transform[5] - pdfStartY, 2)),
                        Math.sqrt(Math.pow(item.transform[4] - pdfEndX, 2) + Math.pow(item.transform[5] - pdfEndY, 2))
                    )
                }))
                .sort((a, b) => a.distance - b.distance)
                .slice(0, 20); // Get the 20 closest items
                
                if (allText.length > 0) {
                    const extractedText = allText.map(item => item.text).join(' ');
                    console.log('Extracted text from broader search:', extractedText);
                    this.sendExtractedText(extractedText);
                    return;
                }
            }
            
            // If we still couldn't extract text, log a message (but don't show alert)
            console.log('No text found in highlighted area');
            
        } catch (error) {
            console.error('Error extracting highlighted text:', error);
        }
    }
    
    // Send extracted text to parent window
    sendExtractedText(text) {
        // Dispatch a custom event with the extracted text
        const event = new CustomEvent('pdf-text-extracted', {
            detail: { text: text }
        });
        document.dispatchEvent(event);
        
        // Also send message to parent window
        if (window.parent !== window) {
            window.parent.postMessage({
                type: 'pdf-text-extracted',
                text: text
            }, '*');
        }
    }
    
    // Handle canvas click for text extraction (completely disabled in copy-paste mode)
    async handleCanvasClick(e) {
        // Do nothing - automatic text extraction is disabled
        console.log('Automatic text extraction is disabled. Please use copy and paste instead.');
        // No text extraction, no popups
        return;
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
        
        // Add keyboard shortcut to toggle debug info (Ctrl+Shift+D)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                viewer.debugInfo.style.display = 
                    viewer.debugInfo.style.display === 'none' ? 'block' : 'none';
                e.preventDefault();
            }
        });
    }
});
