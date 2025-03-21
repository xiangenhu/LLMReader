/**
 * LLM Chat - A chat interface for interacting with LLMs
 * 
 * Features:
 * - Provides a chat interface similar to ChatGPT
 * - Sends messages to the LLM service
 * - Displays responses with typing animation
 * - Tracks conversation history
 * - Integrates with the existing LLM Reader
 */

class LLMChat {
    constructor() {
        this.messages = [];
        this.isProcessing = false;
        this.sessionId = `chat-session-${Date.now()}`;
        
        // Add initial welcome message
        this.messages.push({
            role: 'assistant',
            content: 'Hello! How can I help you today?'
        });
        
        this.initEventListeners();
    }
    
    initEventListeners() {
        // Send button click
        $('#chat-send-btn').on('click', () => {
            this.sendMessage();
        });
        
        // Enter key press in input field
        $('#chat-input').on('keydown', (e) => {
            // Send message on Enter key (without Shift)
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
            
            // Auto-resize textarea
            this.resizeTextarea();
        });
        
        // Input field changes for auto-resize
        $('#chat-input').on('input', () => {
            this.resizeTextarea();
        });
    }
    
    resizeTextarea() {
        const textarea = $('#chat-input')[0];
        
        // Reset height to auto to get the correct scrollHeight
        textarea.style.height = 'auto';
        
        // Set new height based on scrollHeight (with max height limit)
        const newHeight = Math.min(textarea.scrollHeight, 120);
        textarea.style.height = `${newHeight}px`;
    }
    
    sendMessage() {
        // Get message text
        const messageText = $('#chat-input').val().trim();
        
        // Don't send empty messages
        if (!messageText || this.isProcessing) {
            return;
        }
        
        // Add user message to UI
        this.addMessageToUI('user', messageText);
        
        // Add to messages array
        this.messages.push({
            role: 'user',
            content: messageText
        });
        
        // Clear input field
        $('#chat-input').val('');
        this.resizeTextarea();
        
        // Show typing indicator
        this.showTypingIndicator();
        
        // Process with LLM
        this.processWithLLM(messageText);
    }
    
    processWithLLM(messageText) {
        try {
            this.isProcessing = true;
            
            // Get model and other settings
            const model = $('#model').val();
            const provider = $('#provider').val();
            
            // Get user preferences
            const readingLevel = $('#reading-level').val();
            const language = $('#language').val();
            const style = $('#style').val();
            
            // Prepare conversation history for context
            const conversationHistory = this.messages.map(msg => ({
                role: msg.role,
                content: msg.content
            }));
            
            // Record start time for latency measurement
            const startTime = Date.now();
            
            // Create a placeholder for the assistant's response
            const assistantMessageElement = $(`<div class="message assistant-message"></div>`);
            $('#chat-messages').append(assistantMessageElement);
            
            // Create a variable to store the full response
            let fullResponse = '';
            
            // First send the POST request to initiate the chat
            fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: messageText,
                    conversation: conversationHistory,
                    model: model,
                    provider: provider,
                    readingLevel: readingLevel,
                    language: language,
                    style: style,
                    sessionId: this.sessionId,
                    stream: true,
                    startTime: startTime
                })
            }).then(response => {
                if (response.ok) {
                    // Set up event source for streaming only after the POST request is successful
                    const eventSource = new EventSource(`/api/chat/stream?sessionId=${this.sessionId}`);
                    
                    // Handle start event
                    eventSource.addEventListener('start', (event) => {
                        console.log('Streaming started');
                        // Hide typing indicator
                        this.hideTypingIndicator();
                    });
                    
                    // Handle chunk events
                    eventSource.addEventListener('chunk', (event) => {
                        const data = JSON.parse(event.data);
                        fullResponse += data.text;
                        assistantMessageElement.text(fullResponse);
                        this.scrollToBottom();
                    });
                    
                    // Handle complete event
                    eventSource.addEventListener('complete', (event) => {
                        const data = JSON.parse(event.data);
                        
                        // Add to messages array
                        this.messages.push({
                            role: 'assistant',
                            content: fullResponse
                        });
                        
                        // Update metrics if available
                        if (data) {
                            this.updateMetrics({
                                promptTokens: data.promptTokens || 0,
                                completionTokens: data.completionTokens || 0,
                                totalTokens: data.totalTokens || 0
                            });
                        }
                        
                        // Clean up
                        eventSource.close();
                        this.isProcessing = false;
                        
                        // Scroll to bottom
                        this.scrollToBottom();
                    });
                    
                    // Handle error event
                    eventSource.addEventListener('error', (event) => {
                        console.error('Error in streaming:', event);
                        
                        // Try to parse error data
                        let errorMessage = 'An error occurred while processing your message.';
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
                        
                        // Update the message with error
                        assistantMessageElement.text(`Error: ${errorMessage}`);
                        
                        // Clean up
                        eventSource.close();
                        this.isProcessing = false;
                        
                        // Scroll to bottom
                        this.scrollToBottom();
                    });
                } else {
                    // Handle HTTP error
                    assistantMessageElement.text(`Error: Failed to send message. Status: ${response.status}`);
                    this.isProcessing = false;
                }
            }).catch(error => {
                console.error('Fetch error:', error);
                assistantMessageElement.text(`Error: ${error.message || 'Failed to send message'}`);
                this.isProcessing = false;
            });
        } catch (error) {
            console.error('Error processing message:', error);
            
            // Hide typing indicator
            this.hideTypingIndicator();
            
            // Show error message
            this.addMessageToUI('assistant', `Sorry, there was an error processing your message: ${error.message || 'Unknown error'}`);
        } finally {
            this.isProcessing = false;
        }
    }
    
    addMessageToUI(role, content) {
        // Create message element
        const messageClass = role === 'user' ? 'user-message' : 'assistant-message';
        const messageElement = $(`<div class="message ${messageClass}"></div>`);
        
        // Add content
        messageElement.text(content);
        
        // Add to chat container
        $('#chat-messages').append(messageElement);
        
        // Scroll to bottom
        this.scrollToBottom();
    }
    
    showTypingIndicator() {
        // Create typing indicator
        const typingIndicator = $(`
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `);
        
        // Add to chat container
        $('#chat-messages').append(typingIndicator);
        
        // Scroll to bottom
        this.scrollToBottom();
    }
    
    hideTypingIndicator() {
        // Remove typing indicator
        $('.typing-indicator').remove();
    }
    
    scrollToBottom() {
        const chatMessages = $('#chat-messages');
        chatMessages.scrollTop(chatMessages[0].scrollHeight);
    }
    
    updateMetrics(metrics) {
        // Update token metrics
        $('#prompt-tokens').text(parseInt($('#prompt-tokens').text()) + (metrics.promptTokens || 0));
        $('#completion-tokens').text(parseInt($('#completion-tokens').text()) + (metrics.completionTokens || 0));
        $('#total-tokens').text(parseInt($('#total-tokens').text()) + (metrics.totalTokens || 0));
    }
    
    clearChat() {
        // Clear messages array except for the welcome message
        this.messages = [{
            role: 'assistant',
            content: 'Hello! How can I help you today?'
        }];
        
        // Clear chat UI except for the welcome message
        $('#chat-messages').html(`
            <div class="message assistant-message">
                Hello! How can I help you today?
            </div>
        `);
    }
}

// Export for use in reader.js
window.LLMChat = LLMChat;
