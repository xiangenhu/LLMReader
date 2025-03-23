/**
 * LLM Reader - A tool to help people read PDFs with customized rendering
 * 
 * Features:
 * - Displays PDFs in an iframe, preserving original formatting
 * - Extracts text at mouse click position
 * - Processes extracted text with an LLM based on user preferences
 * - Tracks interaction metrics (latency, ready time) and sends to an LRS
 */

// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

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
    
    console.log('LLM Reader initialized successfully');
});
