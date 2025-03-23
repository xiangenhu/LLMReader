/**
 * LLM Reader - A tool to help people read PDFs with customized rendering
 * 
 * Features:
 * - Displays PDFs in an iframe, preserving original formatting
 * - Extracts text at mouse click position
 * - Processes extracted text with an LLM based on user preferences
 * - Tracks interaction metrics (latency, ready time) and sends to an LRS
 * - Supports loading documents directly from URL parameters
 */

// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Parse URL parameters
function getUrlParameters() {
    const params = {};
    const queryString = window.location.search.substring(1);
    const pairs = queryString.split('&');
    
    for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key && value) {
            params[decodeURIComponent(key)] = decodeURIComponent(value);
        }
    }
    
    return params;
}

// Initialize the reader when the document is ready
$(document).ready(function() {
    // Create the main reader instance
    window.reader = new LLMReader();
    
    // Initialize handlers if they weren't already created in the constructor
    if (!window.reader.pdfHandler) {
        window.reader.pdfHandler = new PDFHandler(window.reader);
    }
    
    if (!window.reader.htmlHandler) {
        window.reader.htmlHandler = new HTMLHandler(window.reader);
    }
    
    if (!window.reader.llmHandler) {
        window.reader.llmHandler = new LLMHandler(window.reader);
    }
    
    if (!window.reader.clipboardHandler) {
        window.reader.clipboardHandler = new ClipboardHandler(window.reader);
    }
    
    if (!window.reader.uiHandler) {
        window.reader.uiHandler = new UIHandler(window.reader);
    }
    
    if (!window.reader.metricsHandler) {
        window.reader.metricsHandler = new MetricsHandler(window.reader);
    }
    
    // Add process button functionality
    $('#process-button').on('click', function() {
        if (window.reader && window.reader.llmHandler) {
            window.reader.llmHandler.processExtractedText(window.reader.extractedText);
        }
    });
    
    // Connect the clipboard button to the clipboard handler
    $('#clipboard-button-main').on('click', function() {
        if (window.reader && window.reader.clipboardHandler) {
            window.reader.clipboardHandler.requestClipboardAccess();
        }
    });
    
    // Check for URL parameters to load documents directly
    const params = getUrlParameters();
    
    if (params.type && params.url) {
        console.log(`Loading ${params.type} document from URL: ${params.url}`);
        
        // Set the document type radio button
        $(`input[name="file-type"][value="${params.type}"]`).prop('checked', true);
        
        // Load the document based on type
        if (params.type === 'pdf') {
            // Update the document type
            window.reader.documentType = 'pdf';
            
            // Show the document interface
            window.reader.showDocumentInterface();
            
            // Load the PDF from URL
            window.reader.pdfHandler.loadPdfFromUrl(params.url);
            
            // Update the URL input field
            $('#url-input').val(params.url);
        } else if (params.type === 'html') {
            // Update the document type
            window.reader.documentType = 'html';
            
            // Show the document interface
            window.reader.showDocumentInterface();
            
            // Load the HTML from URL
            window.reader.htmlHandler.loadHtmlFromUrl(params.url);
            
            // Update the URL input field
            $('#html-url-input').val(params.url);
        }
    }
    
    console.log('LLM Reader initialized successfully');
});
