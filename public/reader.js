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
            this.processExtractedText();
        });
        
        // Assessment button
        $('#assessment-button').on('click', () => {
            this.openAssessment();
        });
        
        // Document iframe click handler
        $('#document-iframe').on('load', () => {
            this.setupIframeInteractions();
        });
        
        // Start tracking metrics when a document is loaded
        $(document).on('document-loaded', () => {
            this.metrics.startTime = Date.now();
            this.updateMetricsDisplay();
            
            // Start tracking reading time
            this.readingTimeInterval = setInterval(() => {
                this.updateMetricsDisplay();
            }, 1000);
        });
        
        // Set default options
        $('#auto-process').prop('checked', true);
        $('#text-only').prop('checked', false);
        $('#dim-unread').prop('checked', false);
        
        // Dim unread text option
        $('#dim-unread').on('change', (e) => {
            if (e.target.checked) {
                this.applyDimming();
            } else {
                this.removeDimming();
            }
        });
        
        // Initialize collapsible sections
        this.initCollapsibleSections();
        
        // URL fetch buttons
        $('#fetch-url-btn').on('click', () => {
            const url = $('#url-input').val().trim();
            if (url) {
                this.loadPdfFromUrl(url);
            }
        });
        
        $('#html-fetch-url-btn').on('click', () => {
            const url = $('#html-url-input').val().trim();
            if (url) {
                this.loadHtmlFromUrl(url);
            }
        });
    }
    
    initCollapsibleSections() {
        // Add click handler for all collapsible headers
        $(document).on('click', '.collapsible-header', function() {
            $(this).toggleClass('collapsed');
            $(this).closest('.collapsible').find('.collapsible-content').slideToggle(200);
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
    
    loadPdfFromUrl(url) {
        if (!url) {
            console.error('URL is required');
            return;
        }
        
        console.log('Loading PDF from URL:', url);
        
        // Update UI to show document interface
        this.showDocumentInterface();
        
        // Store the PDF URL
        this.pdfUrl = url;
        
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
        this.metrics = {
            startTime: Date.now(),
            processingTimes: [],
            paragraphsProcessed: 0
        };
        
        // Update UI
        $('#processed-count').text('0');
        $('#total-count').text('0');
    }
    
    loadHtmlFromUrl(url) {
        if (!url) {
            console.error('URL is required');
            return;
        }
        
        // Update UI to show document interface
        this.showDocumentInterface();
        
        // Load the HTML in the iframe
        const iframe = document.getElementById('document-iframe');
        iframe.src = url;
        
        // Set up iframe load event
        iframe.onload = () => {
            this.setupIframeInteractions(iframe);
            $(document).trigger('document-loaded');
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
    }
    
    loadPdf(file) {
        if (!file || file.type !== 'application/pdf') {
            console.error('Invalid file type. Expected PDF.');
            return;
        }
        
        // Update UI to show document interface
        this.showDocumentInterface();
        
        // Load the document
        this.loadDocument(file);
    }
    
    async loadDocument(file) {
        try {
            console.log('Loading PDF from file');
            
            // Create a URL for the PDF file
            const pdfBlob = new Blob([await this.readFileAsArrayBuffer(file)], { type: 'application/pdf' });
            this.pdfUrl = URL.createObjectURL(pdfBlob);
            
            console.log('Created blob URL for PDF:', this.pdfUrl);
            
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
            iframe.src = this.pdfUrl;
            
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
    
    // Handle PDF click event
    async handlePdfClick(e) {
        console.log('Handling PDF click at position:', e.clientX, e.clientY);
        
        // Extract text from the PDF using PDF.js directly
        try {
            // Load the PDF document directly using PDF.js
            const loadingTask = pdfjsLib.getDocument(this.pdfUrl);
            const pdf = await loadingTask.promise;
            console.log('PDF loaded with', pdf.numPages, 'pages');
            
            // Get the first page
            const page = await pdf.getPage(1);
            
            // Extract text content
            const textContent = await page.getTextContent();
            console.log('Extracted', textContent.items.length, 'text items from PDF');
            
            // Get text from the page
            const text = textContent.items.map(item => item.str).join(' ');
            
            if (text && text.trim().length > 0) {
                console.log('Extracted text:', text.substring(0, 50) + '...');
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
            } else {
                console.log('No text extracted from PDF');
                alert('No text could be extracted from this PDF. Try another document or page.');
            }
        } catch (error) {
            console.error('Error extracting text from PDF on click:', error);
            alert('Error extracting text from PDF: ' + error.message);
        }
    }
    
    setupIframeInteractions(iframe) {
        try {
            console.log('Setting up iframe interactions');
            
            // If iframe is not provided, get it from the DOM
            if (!iframe) {
                iframe = document.getElementById('document-iframe');
            }
            
            if (!iframe) {
                console.error('Iframe not available');
                return;
            }
            
            // For PDF files, we need a different approach since we can't directly access the PDF content
            if (this.pdfUrl && (this.pdfUrl.includes('.pdf') || this.pdfUrl.endsWith('.pdf'))) {
                console.log('Setting up PDF iframe interactions');
                
                // Add click event listener to the iframe element itself
                iframe.addEventListener('click', async (e) => {
                    console.log('PDF iframe clicked at position:', e.clientX, e.clientY);
                    this.handlePdfClick(e);
                });
                
                console.log('PDF iframe click handler set up');
            } else {
                // For HTML content, we can use the contentDocument
                console.log('Setting up HTML iframe interactions');
                
                if (iframe.contentDocument) {
                    // Add click event listener to the iframe's content document
                    iframe.contentDocument.addEventListener('click', async (e) => {
                        console.log('HTML iframe clicked at position:', e.clientX, e.clientY);
                        
                        // Extract text at click position
                        const text = await this.extractTextAtPosition(e.clientX, e.clientY, iframe);
                        
                        if (text && text.trim().length > 0) {
                            console.log('Extracted text:', text.substring(0, 50) + '...');
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
                        } else {
                            console.log('No text extracted at click position');
                        }
                    });
                    
                    console.log('HTML iframe interactions set up successfully');
                } else {
                    console.error('Iframe contentDocument not available for HTML content');
                }
            }
        } catch (error) {
            console.error('Error setting up iframe interactions:', error);
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
            
            // For PDF files, we need to use PDF.js to extract text
            if (this.pdfUrl && (this.pdfUrl.includes('.pdf') || this.pdfUrl.endsWith('.pdf'))) {
                console.log('Extracting text from PDF at URL:', this.pdfUrl);
                
                try {
                    // Create a new PDF.js task to load the PDF directly
                    // This bypasses any cross-origin issues that might occur when trying to access the PDF through the iframe
                    let pdfUrl = this.pdfUrl;
                    
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
                    
                    // For a more sophisticated implementation, you would:
                    // 1. Convert iframe click coordinates to PDF coordinates
                    // 2. Find text items near those coordinates
                    // 3. Extract the relevant paragraph or section
                    
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
                        const iframeText = iframe.contentDocument.body.textContent;
                        if (iframeText && iframeText.trim().length > 0) {
                            return iframeText.trim();
                        }
                    } catch (iframeError) {
                        console.error('Alternative extraction also failed:', iframeError);
                    }
                    
                    return 'Error extracting text from PDF: ' + pdfError.message;
                }
            } else {
                // For HTML content, we can use the DOM to extract text
                console.log('Extracting text from HTML at position:', x, y);
                
                const element = iframe.contentDocument.elementFromPoint(x, y);
                if (element) {
                    // Try to get the paragraph or section containing the clicked element
                    const container = this.findTextContainer(element);
                    const text = container ? container.textContent.trim() : element.textContent.trim();
                    return text;
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
            case 'gpt-4':
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
    
    applyDimming() {
        try {
            const iframe = document.getElementById('document-iframe');
            if (!iframe || !iframe.contentDocument) {
                return;
            }
            
            // Get all paragraphs in the document
            const paragraphs = iframe.contentDocument.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, div, section, article');
            
            // Apply dimming to all paragraphs that haven't been read
            paragraphs.forEach((paragraph, index) => {
                if (!this.readParagraphs.has(index)) {
                    paragraph.style.opacity = '0.5';
                    paragraph.style.transition = 'opacity 0.3s ease';
                    
                    // Add click handler to restore opacity when clicked
                    paragraph.addEventListener('click', () => {
                        paragraph.style.opacity = '1';
                        this.readParagraphs.add(index);
                    });
                }
            });
        } catch (error) {
            console.error('Error applying dimming:', error);
        }
    }
    
    removeDimming() {
        try {
            const iframe = document.getElementById('document-iframe');
            if (!iframe || !iframe.contentDocument) {
                return;
            }
            
            // Get all paragraphs in the document
            const paragraphs = iframe.contentDocument.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, div, section, article');
            
            // Remove dimming from all paragraphs
            paragraphs.forEach(paragraph => {
                paragraph.style.opacity = '1';
            });
        } catch (error) {
            console.error('Error removing dimming:', error);
        }
    }
    
    async openAssessment() {
        if (!this.extractedText || this.extractedText.trim().length === 0) {
            alert('No text to assess');
            return;
        }
        
        // Get model and API key
        const apiKey = $('#api-key').val();
        const model = $('#model').val();
        
        if (!apiKey) {
            alert('API key is required for assessment');
            return;
        }
        
        try {
            // Show loading indicator
            const assessmentDiv = $('<div class="assessment"></div>');
            assessmentDiv.html('<div class="loading" style="margin: 0 auto;"></div>');
            $('#processed-text').after(assessmentDiv);
            assessmentDiv.show();
            
            // Construct prompt for assessment
            const prompt = `Please analyze the following text and provide a brief assessment of its:
1. Reading level (elementary, middle school, high school, college, graduate)
2. Main topics and key points
3. Complexity (vocabulary, sentence structure)
4. Tone and style

Text to analyze:
${this.extractedText}`;
            
            // Call appropriate LLM API based on model selection
            let response;
            
            switch (model) {
                case 'gpt-4':
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
            
            // Display assessment
            assessmentDiv.html(`<h4>Text Assessment</h4><div>${response}</div>`);
            
            // Send metrics to LRS if tracking is enabled
            if ($('#track-metrics').is(':checked')) {
                this.sendToLRS({
                    action: 'assessed',
                    text: this.extractedText.substring(0, 100) + '...'
                });
            }
        } catch (error) {
            console.error('Error generating assessment:', error);
            alert('Error generating assessment: ' + error.message);
        }
    }
}

// Initialize the reader when the document is ready
$(document).ready(function() {
    window.reader = new LLMReader();
    
    // Add process button functionality
    $('#process-button').on('click', function() {
        if (window.reader) {
            window.reader.processExtractedText();
        }
    });
});
