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
        
        // Assessment button
        $('#assessment-button').on('click', () => {
            this.llmHandler.openAssessment(this.extractedText);
        });
        
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
