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

class LLMReader {
    constructor() {
        this.currentPdf = null;
        this.pdfUrl = null;
        this.extractedText = '';
        this.metrics = {
            startTime: null,
            processingTimes: [],
            paragraphsProcessed: 0
        };
        
        this.initEventListeners();
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
                this.loadPdf(file);
            }
        });
        
        fileInput.on('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type === 'application/pdf') {
                this.loadPdf(file);
            }
        });
        
        // Close overlay button
        $('#close-overlay').on('click', () => {
            $('#processing-overlay').hide();
        });
        
        // Start tracking metrics when a PDF is loaded
        $(document).on('pdf-loaded', () => {
            this.metrics.startTime = Date.now();
            this.updateMetricsDisplay();
            
            // Start tracking reading time
            this.readingTimeInterval = setInterval(() => {
                this.updateMetricsDisplay();
            }, 1000);
        });
    }
    
    async loadPdf(file) {
        try {
            // Create a URL for the PDF file
            const pdfBlob = new Blob([await this.readFileAsArrayBuffer(file)], { type: 'application/pdf' });
            this.pdfUrl = URL.createObjectURL(pdfBlob);
            
            // Load the PDF in the iframe
            const iframe = document.getElementById('document-iframe');
            iframe.src = this.pdfUrl;
            
            // Set up iframe load event
            iframe.onload = () => {
                this.setupIframeInteractions(iframe);
                $(document).trigger('pdf-loaded');
            };
            
            // Reset metrics
            this.metrics = {
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
    
    setupIframeInteractions(iframe) {
        try {
            // Add click event listener to the iframe
            iframe.contentDocument.addEventListener('click', async (e) => {
                // Extract text at click position
                const text = await this.extractTextAtPosition(e.clientX, e.clientY, iframe);
                
                if (text && text.trim().length > 0) {
                    this.extractedText = text;
                    
                    // Display the extracted text
                    $('#original-text').text(text);
                    $('#processed-text').empty();
                    
                    // Show the processing overlay
                    $('#processing-overlay').css('display', 'flex');
                    
                    // Process the text if auto-process is enabled
                    if ($('#auto-process').is(':checked')) {
                        this.processExtractedText();
                    }
                }
            });
            
            console.log('Iframe interactions set up successfully');
        } catch (error) {
            console.error('Error setting up iframe interactions:', error);
        }
    }
    
    async extractTextAtPosition(x, y, iframe) {
        try {
            // For PDF files, we need to use PDF.js to extract text
            if (this.pdfUrl && this.pdfUrl.includes('.pdf')) {
                // This is a simplified approach - in a real implementation,
                // you would need to convert iframe coordinates to PDF coordinates
                // and extract the specific paragraph or section at that position
                
                // For now, we'll just extract text from the current visible page
                const pdf = await pdfjsLib.getDocument(this.pdfUrl).promise;
                const page = await pdf.getPage(1); // Get the first page
                const textContent = await page.getTextContent();
                
                // Find text near the click position
                // This is a simplified approach - in a real implementation,
                // you would need to use the position information to find the exact text
                
                // For now, just return all text from the page
                return textContent.items.map(item => item.str).join(' ');
            } else {
                // For HTML content, we can use the DOM to extract text
                const element = iframe.contentDocument.elementFromPoint(x, y);
                if (element) {
                    // Try to get the paragraph or section containing the clicked element
                    const container = this.findTextContainer(element);
                    return container ? container.textContent.trim() : element.textContent.trim();
                }
            }
            
            return '';
        } catch (error) {
            console.error('Error extracting text:', error);
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
    
    async processExtractedText() {
        if (!this.extractedText || this.extractedText.trim().length === 0) {
            return;
        }
        
        // Get user preferences
        const readingLevel = $('#reading-level').val();
        const language = $('#language').val();
        const style = $('#style').val();
        const apiKey = $('#api-key').val();
        const model = $('#model').val();
        
        // Record start time for latency measurement
        const startTime = Date.now();
        
        try {
            // Process with LLM
            const processedText = await this.processWithLLM(
                this.extractedText,
                readingLevel,
                language,
                style,
                apiKey,
                model
            );
            
            // Record end time and calculate latency
            const endTime = Date.now();
            const latency = endTime - startTime;
            
            // Update metrics
            this.metrics.processingTimes.push(latency);
            this.metrics.paragraphsProcessed++;
            this.updateMetricsDisplay();
            
            // Send metrics to LRS if tracking is enabled
            if ($('#track-metrics').is(':checked')) {
                this.sendToLRS({
                    action: 'processed',
                    text: this.extractedText.substring(0, 100) + '...',
                    latency: latency,
                    readingLevel: readingLevel,
                    language: language,
                    style: style,
                    model: model
                });
            }
            
            // Display processed text
            $('#processed-text').html(processedText);
            
            // Update processed count
            $('#processed-count').text(this.metrics.paragraphsProcessed);
        } catch (error) {
            console.error('Error processing text:', error);
            $('#processed-text').html(`<div style="color: red;">Error: ${error.message}</div>`);
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
    
    async processWithLLM(text, readingLevel, language, style, apiKey, model) {
        if (!apiKey) {
            throw new Error('API key is required');
        }
        
        // Construct prompt based on user preferences
        let prompt = `Please rewrite the following text `;
        
        if (readingLevel !== 'original') {
            prompt += `at a ${readingLevel} reading level `;
        }
        
        if (language !== 'original') {
            prompt += `in ${language} `;
        }
        
        if (style !== 'original') {
            prompt += `using a ${style} style `;
        }
        
        prompt += `while preserving the original meaning and key information:\n\n${text}`;
        
        // Call appropriate LLM API based on model selection
        let response;
        
        switch (model) {
            case 'gpt-4o-mini':
            case 'gpt-3.5-turbo':
                response = await this.callOpenAI(prompt, apiKey, model);
                break;
            case 'claude-3':
                response = await this.callClaude(prompt, apiKey);
                break;
            case 'gemini-pro':
                response = await this.callGemini(prompt, apiKey);
                break;
            default:
                throw new Error(`Unsupported model: ${model}`);
        }
        
        return response;
    }
    
    async callOpenAI(prompt, apiKey, model) {
        try {
            const response = await $.ajax({
                url: 'https://api.openai.com/v1/chat/completions',
                type: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                data: JSON.stringify({
                    model: model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful assistant that rewrites text based on user preferences.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.7
                })
            });
            
            return response.choices[0].message.content;
        } catch (error) {
            console.error('OpenAI API error:', error);
            throw new Error(`OpenAI API error: ${error.responseJSON?.error?.message || error.statusText}`);
        }
    }
    
    async callClaude(prompt, apiKey) {
        try {
            const response = await $.ajax({
                url: 'https://api.anthropic.com/v1/messages',
                type: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                data: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1000,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                })
            });
            
            return response.content[0].text;
        } catch (error) {
            console.error('Claude API error:', error);
            throw new Error(`Claude API error: ${error.responseJSON?.error?.message || error.statusText}`);
        }
    }
    
    async callGemini(prompt, apiKey) {
        try {
            const response = await $.ajax({
                url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: prompt
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1000
                    }
                })
            });
            
            return response.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error('Gemini API error:', error);
            throw new Error(`Gemini API error: ${error.responseJSON?.error?.message || error.statusText}`);
        }
    }
    
    sendToLRS(data) {
        const lrsEndpoint = $('#lrs-endpoint').val();
        const lrsUsername = $('#lrs-username').val();
        const lrsPassword = $('#lrs-password').val();
        
        if (!lrsEndpoint || !lrsUsername || !lrsPassword) {
            console.warn('LRS credentials not provided, skipping metrics submission');
            return;
        }
        
        // Create xAPI statement
        const statement = {
            actor: {
                name: 'LLM Reader User',
                mbox: 'mailto:user@example.com'
            },
            verb: {
                id: data.action === 'processed' 
                    ? 'http://adlnet.gov/expapi/verbs/completed'
                    : 'http://adlnet.gov/expapi/verbs/experienced',
                display: {
                    'en-US': data.action === 'processed' ? 'processed' : 'assessed'
                }
            },
            object: {
                id: `http://example.com/llmreader/text/${Date.now()}`,
                definition: {
                    name: {
                        'en-US': `Text ${Date.now()}`
                    }
                }
            },
            result: {
                extensions: {
                    'http://example.com/llmreader/metrics': {
                        latency: data.latency,
                        readingLevel: data.readingLevel,
                        language: data.language,
                        style: data.style,
                        model: data.model,
                        timestamp: new Date().toISOString()
                    }
                }
            },
            timestamp: new Date().toISOString()
        };
        
        // Send to LRS
        $.ajax({
            url: lrsEndpoint + 'statements',
            type: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + btoa(lrsUsername + ':' + lrsPassword)
            },
            data: JSON.stringify(statement),
            success: function(data) {
                console.log('Metrics sent to LRS:', data);
            },
            error: function(error) {
                console.error('Error sending metrics to LRS:', error);
            }
        });
    }
    
    updateMetricsDisplay() {
        // Update processed count
        $('#processed-count').text(this.metrics.paragraphsProcessed);
        
        // Calculate and update average latency
        if (this.metrics.processingTimes.length > 0) {
            const avgLatency = this.metrics.processingTimes.reduce((a, b) => a + b, 0) / this.metrics.processingTimes.length;
            $('#avg-latency').text(Math.round(avgLatency));
        }
        
        // Update reading time
        if (this.metrics.startTime) {
            const readingTime = Math.round((Date.now() - this.metrics.startTime) / 1000);
            $('#reading-time').text(readingTime);
        }
    }
}

// Initialize the reader when the document is ready
$(document).ready(function() {
    window.reader = new LLMReader();
    
    // Initialize handlers
    window.reader.pdfHandler = new PDFHandler(window.reader);
    window.reader.htmlHandler = new HTMLHandler(window.reader);
    window.reader.llmHandler = new LLMHandler(window.reader);
    window.reader.clipboardHandler = new ClipboardHandler(window.reader);
    
    // Add process button functionality
    $('#process-button').on('click', function() {
        if (window.reader) {
            window.reader.processExtractedText();
        }
    });
    
    // Connect the clipboard button to the clipboard handler
    $('#clipboard-button-main').on('click', function() {
        if (window.reader && window.reader.clipboardHandler) {
            window.reader.clipboardHandler.requestClipboardAccess();
        }
    });
});
