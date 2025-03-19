/**
 * PDF Handler - Handles PDF-specific functionality
 */

class PDFHandler {
    constructor(reader) {
        this.reader = reader;
        
        // Initialize PDF.js
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    
    loadPdf(file) {
        if (!file || file.type !== 'application/pdf') {
            console.error('Invalid file type. Expected PDF.');
            return;
        }
        
        console.log('Loading PDF from file');
        
        // Update UI to show document interface
        this.reader.showDocumentInterface();
        
        // Load the document
        this.loadDocument(file);
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
            
            // Set up iframe load event before changing src
            iframe.onload = () => {
                console.log('PDF iframe loaded from file');
                this.setupIframeInteractions(iframe);
                $(document).trigger('pdf-loaded');
                
                // Add a direct click handler to the iframe
                iframe.addEventListener('click', async (e) => {
                    console.log('PDF iframe clicked directly (from file)');
                    this.handlePdfClick(e);
                });
            };
            
            // Set the iframe src to load the PDF
            iframe.src = this.reader.pdfUrl;
            
            // Reset metrics
            this.reader.metrics = {
                startTime: Date.now(),
                processingTimes: [],
                paragraphsProcessed: 0
            };
            
            // Update UI
            $('#processed-count').text('0');
            $('#total-count').text('0');
            
        } catch (error) {
            console.error('Error loading PDF:', error);
            alert('Error loading PDF: ' + error.message);
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
        
        // Load the PDF in the iframe
        const iframe = document.getElementById('document-iframe');
        
        // Set up iframe load event before changing src
        iframe.onload = () => {
            console.log('PDF iframe loaded');
            this.setupIframeInteractions(iframe);
            $(document).trigger('pdf-loaded');
            
            // Add a direct click handler to the iframe
            iframe.addEventListener('click', async (e) => {
                console.log('PDF iframe clicked directly');
                this.handlePdfClick(e);
            });
        };
        
        // Set the iframe src to load the PDF
        iframe.src = url;
        
        // Reset metrics
        this.reader.metrics = {
            startTime: Date.now(),
            processingTimes: [],
            paragraphsProcessed: 0
        };
        
        // Update UI
        $('#processed-count').text('0');
        $('#total-count').text('0');
    }
    
    setupIframeInteractions(iframe) {
        try {
            console.log('Setting up PDF iframe interactions');
            
            // If iframe is not provided, get it from the DOM
            if (!iframe) {
                iframe = document.getElementById('document-iframe');
            }
            
            if (!iframe) {
                console.error('Iframe not available');
                return;
            }
            
            // Remove any existing click handlers to avoid duplicates
            iframe.removeEventListener('click', this.handlePdfClickBound);
            
            // Bind the handlePdfClick method to this instance
            this.handlePdfClickBound = this.handlePdfClick.bind(this);
            
            // Add click event listener to the iframe element itself
            iframe.addEventListener('click', this.handlePdfClickBound);
            
            // Also add a mousedown event listener as a backup
            iframe.addEventListener('mousedown', this.handlePdfClickBound);
            
            // Add a direct click handler to the iframe's parent element as well
            const iframeParent = iframe.parentElement;
            if (iframeParent) {
                iframeParent.addEventListener('click', this.handlePdfClickBound);
            }
            
            console.log('PDF iframe click handlers set up successfully');
            
            // Force a click event after a short delay to test the handler
            setTimeout(() => {
                console.log('Testing PDF click handler with simulated click');
                this.extractTextFromPdf().then(text => {
                    if (text && text.trim().length > 0) {
                        console.log('Successfully extracted text from PDF on load:', text.substring(0, 50) + '...');
                    } else {
                        console.log('No text extracted from PDF on load');
                    }
                }).catch(error => {
                    console.error('Error extracting text from PDF on load:', error);
                });
            }, 1000);
        } catch (error) {
            console.error('Error setting up PDF iframe interactions:', error);
        }
    }
    
    // Handle PDF click event
    async handlePdfClick(e) {
        // Prevent the default action
        if (e && e.preventDefault) {
            e.preventDefault();
        }
        
        console.log('Handling PDF click event');
        
        // Extract text from the PDF
        const text = await this.extractTextFromPdf();
        
        if (text && text.trim().length > 0) {
            console.log('Extracted text:', text.substring(0, 50) + '...');
            this.reader.extractedText = text;
            
            // Display the extracted text
            $('#original-text').text(text);
            $('#processed-text').empty();
            
            // Show the processing overlay
            $('#processing-overlay').css('display', 'flex');
            
            // Process the text if auto-process is enabled
            if ($('#auto-process').is(':checked')) {
                this.reader.llmHandler.processExtractedText(text);
            }
        } else {
            console.log('No text extracted from PDF');
            alert('No text could be extracted from this PDF. Try another document or page.');
        }
    }
    
    async extractTextFromPdf() {
        console.log('Extracting text from PDF at URL:', this.reader.pdfUrl);
        
        try {
            // Create a new PDF.js task to load the PDF directly
            // This bypasses any cross-origin issues that might occur when trying to access the PDF through the iframe
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
            
            // Get the first page
            const page = await pdf.getPage(1);
            
            // Extract text content
            const textContent = await page.getTextContent();
            console.log('Extracted', textContent.items.length, 'text items from PDF');
            
            // For now, just return all text from the page
            const extractedText = textContent.items.map(item => item.str).join(' ');
            
            // If we got no text, try to get text from all pages
            if (!extractedText.trim()) {
                console.log('No text found on first page, trying all pages');
                let allText = '';
                
                // Try to get text from the first 3 pages (to avoid too much processing)
                const maxPages = Math.min(3, pdf.numPages);
                for (let i = 1; i <= maxPages; i++) {
                    const pageObj = await pdf.getPage(i);
                    const pageTextContent = await pageObj.getTextContent();
                    allText += pageTextContent.items.map(item => item.str).join(' ') + ' ';
                }
                
                return allText.trim();
            }
            
            return extractedText;
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
            
            return 'Error extracting text from PDF: ' + pdfError.message;
        }
    }
}
