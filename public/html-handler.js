/**
 * HTML Handler - Handles HTML-specific functionality
 */

class HTMLHandler {
    constructor(reader) {
        this.reader = reader;
    }
    
    loadHtmlFromUrl(url) {
        if (!url) {
            console.error('URL is required');
            return;
        }
        
        console.log('Loading HTML from URL:', url);
        
        // Update UI to show document interface
        this.reader.showDocumentInterface();
        
        // Load the HTML in the iframe
        const iframe = document.getElementById('document-iframe');
        
        // Set up iframe load event before changing src
        iframe.onload = () => {
            console.log('HTML iframe loaded');
            this.setupIframeInteractions(iframe);
            $(document).trigger('document-loaded');
        };
        
        // Set the iframe src to load the HTML
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
            console.log('Setting up HTML iframe interactions');
            
            // If iframe is not provided, get it from the DOM
            if (!iframe) {
                iframe = document.getElementById('document-iframe');
            }
            
            if (!iframe) {
                console.error('Iframe not available');
                return;
            }
            
            if (iframe.contentDocument) {
                // Add click event listener to the iframe's content document
                iframe.contentDocument.addEventListener('click', async (e) => {
                    console.log('HTML iframe clicked at position:', e.clientX, e.clientY);
                    
                    // Extract text at click position
                    const text = await this.extractTextAtPosition(e.clientX, e.clientY, iframe);
                    
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
                        console.log('No text extracted at click position');
                    }
                });
                
                console.log('HTML iframe interactions set up successfully');
            } else {
                console.error('Iframe contentDocument not available for HTML content');
            }
        } catch (error) {
            console.error('Error setting up HTML iframe interactions:', error);
        }
    }
    
    async extractTextAtPosition(x, y, iframe) {
        try {
            // If iframe is not provided, get it from the DOM
            if (!iframe) {
                iframe = document.getElementById('document-iframe');
            }
            
            if (!iframe || !iframe.contentDocument) {
                console.error('Iframe or contentDocument not available for text extraction');
                return '';
            }
            
            console.log('Extracting text from HTML at position:', x, y);
            
            const element = iframe.contentDocument.elementFromPoint(x, y);
            if (element) {
                // Try to get the paragraph or section containing the clicked element
                const container = this.findTextContainer(element);
                const text = container ? container.textContent.trim() : element.textContent.trim();
                return text;
            }
            
            return '';
        } catch (error) {
            console.error('Error extracting text from HTML:', error);
            return '';
        }
    }
    
    findTextContainer(element) {
        // Try to find the most appropriate container (paragraph, section, etc.)
        const textContainers = ['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'DIV', 'SECTION', 'ARTICLE'];
        
        let container = element;
        while (container && !textContainers.includes(container.nodeName)) {
            container = container.parentNode;
        }
        
        return container;
    }
}
