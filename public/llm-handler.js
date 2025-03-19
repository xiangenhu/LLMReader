/**
 * LLM Handler - Handles LLM API calls and text processing
 */

class LLMHandler {
    constructor(reader) {
        this.reader = reader;
    }
    
    async processExtractedText(text) {
        if (!text || text.trim().length === 0) {
            console.error('No text to process');
            return;
        }
        
        // Get user preferences
        const readingLevel = $('#reading-level').val();
        const language = $('#language').val();
        const style = $('#style').val();
        const apiKey = $('#api-key').val();
        const model = $('#model').val();
        
        if (!apiKey) {
            alert('API key is required');
            return;
        }
        
        // Record start time for latency measurement
        const startTime = Date.now();
        
        try {
            // Process with LLM
            const processedText = await this.processWithLLM(
                text,
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
            this.reader.metrics.processingTimes.push(latency);
            this.reader.metrics.paragraphsProcessed++;
            this.reader.metricsHandler.updateMetricsDisplay();
            
            // Send metrics to LRS if tracking is enabled
            if ($('#track-metrics').is(':checked')) {
                this.reader.metricsHandler.sendToLRS({
                    action: 'processed',
                    text: text.substring(0, 100) + '...',
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
            $('#processed-count').text(this.reader.metrics.paragraphsProcessed);
        } catch (error) {
            console.error('Error processing text:', error);
            $('#processed-text').html(`<div style="color: red;">Error: ${error.message}</div>`);
        }
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
            
            // Update token metrics
            if (response.usage) {
                this.reader.metricsHandler.updateMetrics({
                    promptTokens: response.usage.prompt_tokens,
                    completionTokens: response.usage.completion_tokens,
                    totalTokens: response.usage.total_tokens
                });
            }
            
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
            
            // Update token metrics if available
            if (response.usage) {
                this.reader.metricsHandler.updateMetrics({
                    promptTokens: response.usage.input_tokens,
                    completionTokens: response.usage.output_tokens,
                    totalTokens: response.usage.input_tokens + response.usage.output_tokens
                });
            }
            
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
            
            // Update token metrics if available
            if (response.usageMetadata) {
                this.reader.metricsHandler.updateMetrics({
                    promptTokens: response.usageMetadata.promptTokenCount,
                    completionTokens: response.usageMetadata.candidatesTokenCount,
                    totalTokens: response.usageMetadata.totalTokenCount
                });
            }
            
            return response.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error('Gemini API error:', error);
            throw new Error(`Gemini API error: ${error.responseJSON?.error?.message || error.statusText}`);
        }
    }
    
    async openAssessment(text) {
        if (!text || text.trim().length === 0) {
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
${text}`;
            
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
                this.reader.metricsHandler.sendToLRS({
                    action: 'assessed',
                    text: text.substring(0, 100) + '...'
                });
            }
        } catch (error) {
            console.error('Error generating assessment:', error);
            alert('Error generating assessment: ' + error.message);
        }
    }
}
