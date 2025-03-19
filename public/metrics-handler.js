/**
 * Metrics Handler - Handles metrics-related functionality
 */

class MetricsHandler {
    constructor(reader) {
        this.reader = reader;
    }
    
    updateMetricsDisplay() {
        // Update processed count
        $('#processed-count').text(this.reader.metrics.paragraphsProcessed);
        
        // Calculate and update average latency
        if (this.reader.metrics.processingTimes.length > 0) {
            const avgLatency = this.reader.metrics.processingTimes.reduce((a, b) => a + b, 0) / this.reader.metrics.processingTimes.length;
            $('#avg-latency').text(Math.round(avgLatency));
        }
        
        // Update reading time
        if (this.reader.metrics.startTime) {
            const readingTime = Math.round((Date.now() - this.reader.metrics.startTime) / 1000);
            $('#reading-time').text(readingTime);
        }
        
        // Update token counts
        $('#prompt-tokens').text(this.reader.metrics.promptTokens);
        $('#completion-tokens').text(this.reader.metrics.completionTokens);
        $('#total-tokens').text(this.reader.metrics.totalTokens);
        
        // Update lexical density
        $('#lexical-density').text(this.reader.metrics.lexicalDensity);
        
        // Update speech acts
        if (this.reader.metrics.speechActs.length > 0) {
            $('#speech-acts').text(this.reader.metrics.speechActs.join(', '));
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
    
    updateMetrics(metrics) {
        // Update token counts
        this.reader.metrics.promptTokens += metrics.promptTokens || 0;
        this.reader.metrics.completionTokens += metrics.completionTokens || 0;
        this.reader.metrics.totalTokens += metrics.totalTokens || 0;
        
        // Update lexical density if provided
        if (metrics.lexicalDensity) {
            this.reader.metrics.lexicalDensity = metrics.lexicalDensity;
        }
        
        // Update speech acts if provided
        if (metrics.speechActs) {
            this.reader.metrics.speechActs = metrics.speechActs;
        }
        
        // Update the display
        this.updateMetricsDisplay();
    }
}
