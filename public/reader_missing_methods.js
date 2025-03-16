// Try to find the most appropriate container (paragraph, section, etc.)
    const textContainers = ['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'DIV', 'SECTION', 'ARTICLE'];
    
    let container = element;
    while (container && !textContainers.includes(container.nodeName)) {
        container = container.parentNode;
        
        // Stop if we reach the document body
        if (container === doc.body) {
            container = element;
            break;
        }
    }
    
    if (textOnly) {
        // Extract only text content, ignoring buttons, inputs, etc.
        return this.getTextOnly(container);
    } else {
        return container ? container.textContent.trim() : element.textContent.trim();
    }
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

async processExtractedText() {
    if (!this.extractedText || this.extractedText.trim().length === 0) {
        return;
    }
    
    // Get user preferences
    const readingLevel = $('#reading-level').val();
    const language = $('#language').val();
    const style = $('#style').val();
    const model = $('#model').val();
    
    // Record start time for latency measurement
    const startTime = Date.now();
    
    try {
        // Process with LLM via server API
        const response = await $.ajax({
            url: '/api/process',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                text: this.extractedText,
                readingLevel: readingLevel,
                language: language,
                style: style,
                model: model,
                startTime: startTime,
                stream: false
            })
        });
        
        // Record end time and calculate latency
        const endTime = Date.now();
        const latency = response.latency || (endTime - startTime);
        
        // Update metrics
        this.metrics.processingTimes.push(latency);
        this.metrics.paragraphsProcessed++;
        this.updateMetricsDisplay();
        
        // Send metrics to server if tracking is enabled
        if ($('#track-metrics').is(':checked')) {
            this.sendMetricsToServer({
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
        $('#processed-text').html(response.processedText);
        
        // Update processed count
        $('#processed-count').text(this.metrics.paragraphsProcessed);
    } catch (error) {
        console.error('Error processing text:', error);
        $('#processed-text').html(`<div style="color: red;">Error: ${error.message || 'Unknown error'}</div>`);
    }
}

sendMetricsToServer(data) {
    $.ajax({
        url: '/api/metrics',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(data),
        error: function(error) {
            console.error('Error sending metrics to server:', error);
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
