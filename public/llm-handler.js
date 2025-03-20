/**
 * LLM Handler - Handles LLM API calls and text processing
 */

class LLMHandler {
    constructor(reader) {
        this.reader = reader;
        this.sessionId = `session-${Date.now()}`;
    }
    
    processExtractedText(text) {
        if (!text || text.trim().length === 0) {
            console.error('No text to process');
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
            // Clear previous processed text
            $('#processed-text').empty();
            
            // Create a placeholder for the processed text
            const processedTextElement = $('#processed-text');
            
            // Create a variable to store the full response
            let fullResponse = '';
            
            // Set up event source for streaming
            const eventSource = new EventSource(`/api/process?_=${Date.now()}`);
            
            // Send the request as POST with fetch
            fetch('/api/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    readingLevel: readingLevel,
                    language: language,
                    style: style,
                    model: model,
                    startTime: startTime,
                    stream: true,
                    sessionId: this.sessionId
                })
            });
            
            // Handle start event
            eventSource.addEventListener('start', (event) => {
                console.log('Streaming started');
            });
            
            // Handle chunk events
            eventSource.addEventListener('chunk', (event) => {
                const data = JSON.parse(event.data);
                fullResponse += data.text;
                processedTextElement.html(fullResponse);
            });
            
            // Handle complete event
            eventSource.addEventListener('complete', (event) => {
                const data = JSON.parse(event.data);
                
                // Update metrics
                this.reader.metrics.processingTimes.push(data.latency || 0);
                this.reader.metrics.paragraphsProcessed++;
                this.reader.metrics.promptTokens += data.promptTokens || 0;
                this.reader.metrics.completionTokens += data.completionTokens || 0;
                this.reader.metrics.totalTokens += data.totalTokens || 0;
                this.reader.metricsHandler.updateMetricsDisplay();
                
                // Send metrics to server for LRS tracking
                this.sendMetricsToServer({
                    action: 'processed',
                    paragraphId: `paragraph-${Date.now()}`,
                    latency: data.latency || 0,
                    interPromptLatency: data.interPromptLatency || 0,
                    promptTokens: data.promptTokens || 0,
                    completionTokens: data.completionTokens || 0,
                    totalTokens: data.totalTokens || 0,
                    readingLevel: readingLevel,
                    language: language,
                    style: style,
                    model: model
                });
                
                // Update processed count
                $('#processed-count').text(this.reader.metrics.paragraphsProcessed);
                
                // Clean up
                eventSource.close();
            });
            
            // Handle error event
            eventSource.addEventListener('error', (event) => {
                console.error('Error in streaming:', event);
                
                // Try to parse error data
                let errorMessage = 'An error occurred while processing your text.';
                try {
                    if (event.data) {
                        const data = JSON.parse(event.data);
                        if (data.error) {
                            errorMessage = data.error;
                        }
                    }
                } catch (e) {
                    console.error('Error parsing error data:', e);
                }
                
                // Update the processed text with error
                processedTextElement.html(`<div style="color: red;">Error: ${errorMessage}</div>`);
                
                // Clean up
                eventSource.close();
            });
            
            return fullResponse;
        } catch (error) {
            console.error('Error processing text:', error);
            $('#processed-text').html(`<div style="color: red;">Error: ${error.responseJSON?.error || error.message}</div>`);
            return null;
        }
    }
    
    sendTextToAssessment(text) {
        if (!text || text.trim().length === 0) {
            alert('No text to send');
            return;
        }
        
        try {
            // Get the assessment URL from the server config
            $.ajax({
                url: '/api/config',
                type: 'GET',
                success: (config) => {
                    const assessmentUrl = config.assessmentUrl;
                    
                    if (!assessmentUrl) {
                        alert('Assessment URL is not configured');
                        return;
                    }
                    
                    // Encode the text for URL
                    const encodedText = encodeURIComponent(text);
                    
                    // Open the assessment URL with the text
                    window.open(`${assessmentUrl}${encodedText}`, '_blank');
                    
                    // Send metrics to server for LRS tracking
                    this.sendMetricsToServer({
                        action: 'sent_to_assessment',
                        paragraphId: `paragraph-${Date.now()}`,
                        textLength: text.length,
                        model: $('#model').val()
                    });
                },
                error: (error) => {
                    console.error('Error getting config:', error);
                    alert('Error getting assessment URL: ' + (error.responseJSON?.error || error.message));
                }
            });
        } catch (error) {
            console.error('Error generating assessment:', error);
            alert('Error generating assessment: ' + (error.responseJSON?.error || error.message));
            return null;
        }
    }
    
    sendMetricsToServer(metricsData) {
        // Only send metrics if tracking is enabled
        if (!$('#track-metrics').is(':checked')) {
            return;
        }
        
        // Send metrics to server for LRS tracking
        $.ajax({
            url: '/api/metrics',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(metricsData),
            success: function(data) {
                console.log('Metrics sent to server:', data);
            },
            error: function(error) {
                console.error('Error sending metrics to server:', error);
            }
        });
    }
}
