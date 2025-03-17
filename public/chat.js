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
    
    async processWithLLM(messageText) {
        try {
            this.isProcessing = true;
            
            // Get model and other settings
            const model = $('#model').val();
            const provider = $('#provider').val();
            
            // Prepare conversation history for context
            const conversationHistory = this.messages.map(msg => ({
                role: msg.role,
                content: msg.content
            }));
            
            // Send to server
            const response = await $.ajax({
                url: '/api/chat',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    message: messageText,
                    conversation: conversationHistory,
                    model: model,
                    provider: provider,
                    sessionId: this.sessionId
                })
            });
            
            // Hide typing indicator
            this.hideTypingIndicator();
            
            // Add response to UI
            this.addMessageToUI('assistant', response.message);
            
            // Add to messages array
            this.messages.push({
                role: 'assistant',
                content: response.message
            });
            
            // Update metrics if available
            if (response.metrics) {
                this.updateMetrics(response.metrics);
            }
            
            // Scroll to bottom
            this.scrollToBottom();
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
