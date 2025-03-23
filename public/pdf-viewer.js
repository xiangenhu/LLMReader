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
        
        // Create canvas
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.wrapper.appendChild(this.canvas);
        
        // Create navigation controls
        this.createControls();
        
        // Initialize highlighting functionality
        this.isHighlighting = false;
        this.highlightStartX = null;
        this.highlightStartY = null;
        this.highlightedText = '';
        
        // Add highlighting overlay
        this.highlightOverlay = document.createElement('div');
        this.highlightOverlay.className = 'highlight-overlay';
        this.highlightOverlay.style.position = 'absolute';
        this.highlightOverlay.style.pointerEvents = 'none';
        this.highlightOverlay.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
        this.highlightOverlay.style.display = 'none';
        this.highlightOverlay.style.zIndex = '100';
        this.highlightOverlay.style.border = '1px solid #FFA500';
        this.wrapper.appendChild(this.highlightOverlay);
        
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
        
        // Highlight mode toggle button
        const highlightButton = document.createElement('button');
        highlightButton.textContent = 'Highlight Mode';
        highlightButton.style.marginLeft = '20px';
        highlightButton.style.padding = '5px 10px';
        highlightButton.style.backgroundColor = '#f0f0f0';
        highlightButton.addEventListener('click', () => {
            this.toggleHighlightMode();
            // Update button appearance
            highlightButton.style.backgroundColor = this.isHighlighting ? '#ffeb3b' : '#f0f0f0';
            highlightButton.style.fontWeight = this.isHighlighting ? 'bold' : 'normal';
        });
        
        // Add elements to controls
        controls.appendChild(prevButton);
        controls.appendChild(this.pageInfo);
        controls.appendChild(nextButton);
        controls.appendChild(zoomOutButton);
        controls.appendChild(zoomInButton);
        controls.appendChild(highlightButton);
        
        // Insert controls at the top of container
        this.container.insertBefore(controls, this.container.firstChild);
    }
    
    // Toggle highlight mode
    toggleHighlightMode() {
        this.isHighlighting = !this.isHighlighting;
        
        // Update cursor style based on mode
        this.canvas.style.cursor = this.isHighlighting ? 'crosshair' : 'default';
        
        // Show message to user
        const message = this.isHighlighting 
            ? 'Highlight Mode ON: Click and drag to highlight text' 
            : 'Highlight Mode OFF';
            
        // Display message to user
        alert(message);
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
    
    // Set up event listeners for highlighting
    setupHighlightListeners() {
        // Mouse down - start highlighting
        this.canvas.addEventListener('mousedown', (e) => {
            if (this.isHighlighting) {
                const rect = this.canvas.getBoundingClientRect();
                this.highlightStartX = e.clientX - rect.left;
                this.highlightStartY = e.clientY - rect.top;
                
                // Initialize highlight overlay
                this.highlightOverlay.style.left = `${this.highlightStartX}px`;
                this.highlightOverlay.style.top = `${this.highlightStartY}px`;
                this.highlightOverlay.style.width = '0px';
                this.highlightOverlay.style.height = '0px';
                this.highlightOverlay.style.display = 'block';
                
                // Update debug info
                this.updateDebugInfo('Start', this.highlightStartX, this.highlightStartY);
                
                e.preventDefault(); // Prevent text selection
            } else {
                // If not in highlight mode, handle as a regular click
                this.handleCanvasClick(e);
            }
        });
        
        // Mouse move - update highlight rectangle
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isHighlighting && this.highlightStartX !== null) {
                const rect = this.canvas.getBoundingClientRect();
                const currentX = e.clientX - rect.left;
                const currentY = e.clientY - rect.top;
                
                // Calculate dimensions
                const left = Math.min(this.highlightStartX, currentX);
                const top = Math.min(this.highlightStartY, currentY);
                const width = Math.abs(currentX - this.highlightStartX);
                const height = Math.abs(currentY - this.highlightStartY);
                
                // Update overlay
                this.highlightOverlay.style.left = `${left}px`;
                this.highlightOverlay.style.top = `${top}px`;
                this.highlightOverlay.style.width = `${width}px`;
                this.highlightOverlay.style.height = `${height}px`;
                
                // Update debug info
                this.updateDebugInfo('Move', currentX, currentY, left, top, width, height);
            }
        });
        
        // Mouse up - finish highlighting and extract text
        this.canvas.addEventListener('mouseup', async (e) => {
            if (this.isHighlighting && this.highlightStartX !== null) {
                const rect = this.canvas.getBoundingClientRect();
                const endX = e.clientX - rect.left;
                const endY = e.clientY - rect.top;
                
                // Update debug info
                this.updateDebugInfo('End', endX, endY);
                
                // Extract text from the highlighted area
                await this.extractHighlightedText(
                    this.highlightStartX, 
                    this.highlightStartY, 
                    endX, 
                    endY
                );
                
                // Reset highlight state
                this.highlightStartX = null;
                this.highlightStartY = null;
                
                // Hide overlay after a short delay
                setTimeout(() => {
                    this.highlightOverlay.style.display = 'none';
                }, 1000);
            }
        });
        
        // Mouse leave - cancel highlighting
        this.canvas.addEventListener('mouseleave', () => {
            if (this.isHighlighting && this.highlightStartX !== null) {
                this.highlightStartX = null;
                this.highlightStartY = null;
                this.highlightOverlay.style.display = 'none';
                
                // Update debug info
                this.updateDebugInfo('Cancel', 0, 0);
            }
        });
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
            
            // If we still couldn't extract text, show a message
            console.log('No text found in highlighted area');
            alert('No text found in highlighted area. Try highlighting a different section.');
            
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
    
    // Handle canvas click for text extraction (when not in highlight mode)
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
                        this.sendExtractedText(extractedText);
                        return;
                    }
                }
            }
            
            // Fallback: if we couldn't extract a paragraph, get all text from the page (excluding buttons)
            const pageText = nonButtonItems.map(item => item.str).join(' ');
            if (pageText) {
                console.log('Extracted page text (fallback)');
                this.sendExtractedText(pageText);
            } else {
                console.log('No text found on page');
                alert('No text found on this page. Try another page or use highlight mode.');
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
