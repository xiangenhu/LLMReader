/**
 * HTML Handler - Handles HTML-specific functionality
 */

class HTMLHandler {
    constructor(reader) {
        this.reader = reader;
        
        // Bind methods to this instance to maintain proper 'this' context
        this.handleHtmlClick = this.handleHtmlClick.bind(this);
        this.extractTextAtPosition = this.extractTextAtPosition.bind(this);
        this.setupIframeInteractions = this.setupIframeInteractions.bind(this);
        this.extractAllText = this.extractAllText.bind(this);
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
        
        // Remove any existing sandbox attribute
        iframe.removeAttribute('sandbox');
        
        // Add sandbox attribute with necessary permissions
        iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms');
        
        // Set up iframe load event before changing src
        iframe.onload = () => {
            console.log('HTML iframe loaded');
            
            // Set up iframe interactions with a slight delay to ensure the HTML is fully loaded
            setTimeout(() => {
                this.setupIframeInteractions(iframe);
                $(document).trigger('document-loaded');
                
                // Extract some sample text automatically
                this.extractAndDisplaySampleText(iframe);
                
                console.log('HTML click handlers added to iframe');
            }, 500);
        };
        
        // Set the iframe src to load the HTML
        iframe.src = url;
        
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
            console.log('Setting up HTML iframe interactions');
            
            // If iframe is not provided, get it from the DOM
            if (!iframe) {
                iframe = document.getElementById('document-iframe');
            }
            
            if (!iframe) {
                console.error('Iframe not available');
                return;
            }
            
            // Remove any existing click handlers to avoid duplicates
            iframe.removeEventListener('click', this.handleHtmlClick);
            
            // Add click event listener to the iframe element itself
            iframe.addEventListener('click', this.handleHtmlClick);
            
            try {
                if (iframe.contentDocument) {
                    // Remove any existing click handlers from the content document
                    iframe.contentDocument.removeEventListener('click', this.handleHtmlClick);
                    
                    // Add click event listener to the iframe's content document
                    iframe.contentDocument.addEventListener('click', this.handleHtmlClick);
                    
                    console.log('HTML iframe content document click handler set up');
                } else {
                    console.warn('Iframe contentDocument not available for HTML content');
                }
            } catch (contentError) {
                console.error('Error accessing iframe contentDocument:', contentError);
                console.log('This might be due to cross-origin restrictions');
            }
            
            // Add click handler to the document body as well to catch clicks that might be outside the iframe
            document.body.addEventListener('click', (e) => {
                // Check if the click is within the iframe
                const rect = iframe.getBoundingClientRect();
                if (
                    e.clientX >= rect.left &&
                    e.clientX <= rect.right &&
                    e.clientY >= rect.top &&
                    e.clientY <= rect.bottom
                ) {
                    console.log('Click detected in iframe area from body handler');
                    this.handleHtmlClick(e);
                }
            });
            
            console.log('HTML iframe interactions set up successfully');
        } catch (error) {
            console.error('Error setting up HTML iframe interactions:', error);
        }
    }
    
    // Extract and display sample text automatically
    async extractAndDisplaySampleText(iframe) {
        try {
            console.log('Automatically extracting sample text from HTML');
            
            let sampleText = '';
            
            try {
                if (iframe && iframe.contentDocument) {
                    // Try to get text from the first paragraph or heading
                    const paragraphs = iframe.contentDocument.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
                    if (paragraphs.length > 0) {
                        for (let i = 0; i < Math.min(5, paragraphs.length); i++) {
                            sampleText += paragraphs[i].textContent + ' ';
                        }
                    } else {
                        // If no paragraphs or headings, get text from the body
                        sampleText = iframe.contentDocument.body.textContent.substring(0, 1000);
                    }
                }
            } catch (contentError) {
                console.error('Error accessing iframe content for sample text:', contentError);
            }
            
            if (sampleText && sampleText.trim().length > 0) {
                console.log('Automatically extracted sample text:', sampleText.substring(0, 50) + '...');
                this.reader.extractedText = sampleText;
            } else {
                console.log('No text automatically extracted from HTML');
            }
        } catch (error) {
            console.error('Error automatically extracting text from HTML:', error);
        }
    }
    
    // Handle HTML click event
    async handleHtmlClick(e) {
        // Prevent the default action
        if (e && e.preventDefault) {
            e.preventDefault();
        }
        
        console.log('Handling HTML click event at position:', e.clientX, e.clientY);
        
        // Extract text at click position
        const text = await this.extractTextAtPosition(e.clientX, e.clientY);
        
        if (text && text.trim().length > 0) {
            console.log('Extracted text:', text.substring(0, 50) + '...');
            this.reader.extractedText = text;
            
            // Display the extracted text
            $('#original-text').text(text);
            $('#processed-text').empty();
            
            // Show the processing overlay
            $('#processing-overlay').css('display', 'flex');
            
            // Always process the text automatically
            this.reader.llmHandler.processExtractedText(text);
            
            // Set up the Learning button to send text to the assessment URL
            $('#learning-button').off('click').on('click', () => {
                this.reader.llmHandler.sendTextToAssessment(text);
            });
        } else {
            console.log('No text extracted at click position');
            
            // Try to extract text from the entire document
            const iframe = document.getElementById('document-iframe');
            try {
                if (iframe && iframe.contentDocument && iframe.contentDocument.body) {
                    const bodyText = iframe.contentDocument.body.textContent;
                    if (bodyText && bodyText.trim().length > 0) {
                        console.log('Extracted text from body:', bodyText.substring(0, 50) + '...');
                        this.reader.extractedText = bodyText;
                        
                        // Display the extracted text
                        $('#original-text').text(bodyText);
                        $('#processed-text').empty();
                        
                        // Show the processing overlay
                        $('#processing-overlay').css('display', 'flex');
                        
                        // Always process the text automatically
                        this.reader.llmHandler.processExtractedText(bodyText);
                        
                        return;
                    }
                }
            } catch (contentError) {
                console.error('Error accessing iframe content for body text:', contentError);
            }
            
            alert('No text could be extracted at the click position. Try clicking on a paragraph or text element.');
        }
    }
    
    async extractTextAtPosition(x, y) {
        try {
            const iframe = document.getElementById('document-iframe');
            
            if (!iframe) {
                console.error('Iframe not available for text extraction');
                return '';
            }
            
            console.log('Extracting text from HTML at position:', x, y);
            
            try {
                if (iframe.contentDocument) {
                    const element = iframe.contentDocument.elementFromPoint(x, y);
                    if (element) {
                        // Try to get the paragraph or section containing the clicked element
                        const container = this.findTextContainer(element);
                        const text = container ? container.textContent.trim() : element.textContent.trim();
                        return text;
                    }
                }
            } catch (contentError) {
                console.error('Error accessing iframe contentDocument for text extraction:', contentError);
            }
            
            // If we couldn't extract text at the position, try to get some text from the document
            try {
                if (iframe.contentDocument && iframe.contentDocument.body) {
                    // Try to get text from the first few paragraphs
                    const paragraphs = iframe.contentDocument.querySelectorAll('p');
                    if (paragraphs.length > 0) {
                        let text = '';
                        for (let i = 0; i < Math.min(3, paragraphs.length); i++) {
                            text += paragraphs[i].textContent + ' ';
                        }
                        return text.trim();
                    }
                    
                    // If no paragraphs, return some of the body text
                    return iframe.contentDocument.body.textContent.substring(0, 500).trim();
                }
            } catch (bodyError) {
                console.error('Error accessing iframe body for fallback text extraction:', bodyError);
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
            
            // Stop if we reach the document body
            if (container === document.body) {
                container = element;
                break;
            }
        }
        
        // Always extract only text content, ignoring buttons, inputs, etc.
        // regardless of the text-only checkbox setting
        return this.getTextOnly(container || element);
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
    
    // Extract all text from the HTML document
    extractAllText() {
        try {
            const iframe = document.getElementById('document-iframe');
            
            if (!iframe) {
                console.error('Iframe not available for text extraction');
                return '';
            }
            
            try {
                if (iframe.contentDocument && iframe.contentDocument.body) {
                    return iframe.contentDocument.body.textContent.trim();
                }
            } catch (contentError) {
                console.error('Error accessing iframe content for all text extraction:', contentError);
            }
            
            return '';
        } catch (error) {
            console.error('Error extracting all text from HTML:', error);
            return '';
        }
    }
}
