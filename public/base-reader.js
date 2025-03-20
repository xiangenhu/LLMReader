/**
 * Base Reader - Core functionality for the LLM Reader
 */

class LLMReader {
    constructor() {
        this.currentDocument = null;
        this.documentType = 'chat'; // Default to Chat
        this.pdfUrl = null;
        this.pdfData = null;
        this.extractedText = '';
        this.readParagraphs = new Set(); // Track read paragraphs
        this.metrics = {
            startTime: null,
            processingTimes: [],
            paragraphsProcessed: 0,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            lexicalDensity: 0,
            speechActs: [],
            lastPromptTime: null // Track time of last prompt for latency calculation
        };
        
        // Initialize chat interface
        this.chat = null;
        
        // Initialize handlers
        this.uiHandler = new UIHandler(this);
        this.pdfHandler = new PDFHandler(this);
        this.htmlHandler = new HTMLHandler(this);
        this.metricsHandler = new MetricsHandler(this);
        this.llmHandler = new LLMHandler(this);
        
        // Initialize event listeners
        this.initEventListeners();
        
        // Show chat interface by default
        this.showChatInterface();
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
            if (file && file.type === 'application/pdf') {
                this.pdfHandler.loadPdf(file);
            }
        });
        
        fileInput.on('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type === 'application/pdf') {
                this.pdfHandler.loadPdf(file);
            }
        });
        
        // Close overlay button
        $(document).on('click', '#close-overlay', () => {
            $('#processing-overlay').hide();
        });
        
        // File type toggle
        $('input[name="file-type"]').on('change', (e) => {
            this.documentType = e.target.value;
            
            // Show the appropriate form based on document type
            if (this.documentType === 'pdf') {
                $('#pdf-form').show();
                $('#html-form').hide();
                $('#chat-form').hide();
                this.showDocumentInterface();
            } else if (this.documentType === 'html') {
                $('#pdf-form').hide();
                $('#html-form').show();
                $('#chat-form').hide();
                this.showDocumentInterface();
            } else if (this.documentType === 'chat') {
                $('#pdf-form').hide();
                $('#html-form').hide();
                $('#chat-form').show();
                this.showChatInterface();
            }
        });
        
        // Process button
        $('#process-button').on('click', () => {
            this.llmHandler.processExtractedText(this.extractedText);
        });
        
        // We've removed the assessment button from the UI and replaced it with a dynamic button
        // that's added by the PDF and HTML handlers when text is selected
        
        // Document iframe click handler
        $('#document-iframe').on('load', () => {
            if (this.documentType === 'pdf') {
                this.pdfHandler.setupIframeInteractions();
            } else if (this.documentType === 'html') {
                this.htmlHandler.setupIframeInteractions();
            }
        });
        
        // Start tracking metrics when a document is loaded
        $(document).on('document-loaded', () => {
            this.metrics.startTime = Date.now();
            this.metricsHandler.updateMetricsDisplay();
            
            // Start tracking reading time
            this.readingTimeInterval = setInterval(() => {
                this.metricsHandler.updateMetricsDisplay();
            }, 1000);
        });
        
        // Set default options
        $('#auto-process').prop('checked', true);
        $('#text-only').prop('checked', false);
        $('#dim-unread').prop('checked', false);
        
        // Dim unread text option
        $('#dim-unread').on('change', (e) => {
            if (e.target.checked) {
                this.uiHandler.applyDimming();
            } else {
                this.uiHandler.removeDimming();
            }
        });
        
        // Initialize collapsible sections
        this.uiHandler.initCollapsibleSections();
        
        // URL fetch buttons
        $('#fetch-url-btn').on('click', () => {
            const url = $('#url-input').val().trim();
            if (url) {
                this.pdfHandler.loadPdfFromUrl(url);
            }
        });
        
        $('#html-fetch-url-btn').on('click', () => {
            const url = $('#html-url-input').val().trim();
            if (url) {
                this.htmlHandler.loadHtmlFromUrl(url);
            }
        });
        
        // Extract PDF text button
        $('#extract-pdf-text-btn').on('click', async () => {
            console.log('Extract PDF text button clicked');
            if (this.documentType === 'pdf' && this.pdfUrl) {
                try {
                    // Extract text from the PDF
                    const text = await this.pdfHandler.extractTextFromPdf();
                    
                    if (text && text.trim().length > 0) {
                        console.log('Extracted text from PDF button:', text.substring(0, 50) + '...');
                        this.extractedText = text;
                        
                        // Display the extracted text
                        $('#original-text').text(text);
                        $('#processed-text').empty();
                        
                        // Show the processing overlay
                        $('#processing-overlay').css('display', 'flex');
                        
                        // Process the text if auto-process is enabled
                        if ($('#auto-process').is(':checked')) {
                            this.llmHandler.processExtractedText(text);
                        }
                    } else {
                        console.log('No text extracted from PDF');
                        alert('No text could be extracted from this PDF. Try another document or page.');
                    }
                } catch (error) {
                    console.error('Error extracting text from PDF:', error);
                    alert('Error extracting text from PDF: ' + error.message);
                }
            } else {
                alert('Please load a PDF document first.');
            }
        });
        
        // Extract HTML text button
        $('#extract-html-text-btn').on('click', async () => {
            console.log('Extract HTML text button clicked');
            if (this.documentType === 'html') {
                try {
                    // Extract all text from the HTML document
                    const text = this.htmlHandler.extractAllText();
                    
                    if (text && text.trim().length > 0) {
                        console.log('Extracted text from HTML button:', text.substring(0, 50) + '...');
                        this.extractedText = text;
                        
                        // Display the extracted text
                        $('#original-text').text(text);
                        $('#processed-text').empty();
                        
                        // Show the processing overlay
                        $('#processing-overlay').css('display', 'flex');
                        
                        // Process the text if auto-process is enabled
                        if ($('#auto-process').is(':checked')) {
                            this.llmHandler.processExtractedText(text);
                        }
                    } else {
                        console.log('No text extracted from HTML');
                        alert('No text could be extracted from this HTML document. Try another document.');
                    }
                } catch (error) {
                    console.error('Error extracting text from HTML:', error);
                    alert('Error extracting text from HTML: ' + error.message);
                }
            } else {
                alert('Please load an HTML document first.');
            }
        });
    }
    
    showDocumentInterface() {
        // Show document iframe, hide chat interface
        $('#document-iframe').show();
        $('#chat-container').hide();
    }
    
    showChatInterface() {
        // Hide document iframe, show chat interface
        $('#document-iframe').hide();
        $('#chat-container').show();
        
        // Initialize chat if not already done
        if (!this.chat) {
            this.chat = new LLMChat();
        }
    }
    
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }
}

// Initialize the reader when the document is ready
$(document).ready(function() {
    window.reader = new LLMReader();
});
