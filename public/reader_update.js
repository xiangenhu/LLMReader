// Update metrics display method
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
    
    // Update token metrics
    $('#prompt-tokens').text(this.metrics.promptTokens);
    $('#completion-tokens').text(this.metrics.completionTokens);
    $('#total-tokens').text(this.metrics.totalTokens);
    
    // Update lexical density if available
    if (this.metrics.lexicalDensity !== undefined) {
        $('#lexical-density').text(this.metrics.lexicalDensity);
    }
    
    // Update speech acts if available
    if (this.metrics.speechActs !== undefined && this.metrics.speechActs.length > 0) {
        $('#speech-acts').text(this.metrics.speechActs.join(', '));
    }
}

// Process extracted text method
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
        
        // Update token metrics if available
        if (response.promptTokens) {
            this.metrics.promptTokens += response.promptTokens;
        }
        if (response.completionTokens) {
            this.metrics.completionTokens += response.completionTokens;
        }
        if (response.totalTokens) {
            this.metrics.totalTokens += response.totalTokens;
        }
        
        // Update lexical density and speech acts if available
        if (response.originalLexicalDensity !== undefined) {
            this.metrics.lexicalDensity = response.originalLexicalDensity;
        }
        if (response.originalSpeechActs !== undefined) {
            this.metrics.speechActs = response.originalSpeechActs;
        }
        
        this.updateMetricsDisplay();
        
        // Send metrics to server if tracking is enabled
        if ($('#track-metrics').is(':checked')) {
            this.sendMetricsToServer({
                action: 'processed',
                paragraphId: `paragraph-${Date.now()}`, // Add a unique paragraphId
                text: this.extractedText.substring(0, 100) + '...',
                latency: latency,
                readingLevel: readingLevel,
                language: language,
                style: style,
                model: model,
                lexicalDensity: this.metrics.lexicalDensity,
                speechActs: this.metrics.speechActs
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
