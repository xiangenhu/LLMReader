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
            
            // Convert viewport coordinates to PDF coordinates
            const viewport = page.getViewport({ scale: this.scale });
            const pdfX = x / this.scale;
            const pdfY = (viewport.height - y) / this.scale;
            
            // Find text near click position
            let closestText = '';
            let minDistance = 50; // Threshold for distance
            
            for (const item of textContent.items) {
                // Calculate distance from click to text item
                const dx = Math.abs(item.transform[4] - pdfX);
                const dy = Math.abs(item.transform[5] - pdfY);
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < minDistance) {
                    closestText = item.str;
                    minDistance = distance;
                }
            }
            
            if (closestText) {
                console.log('Extracted text:', closestText);
                
                // Dispatch a custom event with the extracted text
                const event = new CustomEvent('pdf-text-extracted', {
                    detail: { text: closestText }
                });
                document.dispatchEvent(event);
            } else {
                console.log('No text found near click position');
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
