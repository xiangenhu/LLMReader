/**
 * Clipboard Handler - Handles clipboard text processing
 */

class ClipboardHandler {
    constructor(reader) {
        this.reader = reader;
        
        // Bind methods to this instance to maintain proper 'this' context
        this.handlePaste = this.handlePaste.bind(this);
        this.requestClipboardAccess = this.requestClipboardAccess.bind(this);
        this.processClipboardText = this.processClipboardText.bind(this);
        
        // Initialize event listeners
        this.initEventListeners();
    }
    
    initEventListeners() {
        // Add clipboard paste event listener to document
        document.addEventListener('paste', this.handlePaste);
        
        // Create clipboard button
        this.createClipboardButton();
    }
    
    createClipboardButton() {
        // Create a button for clipboard processing
        const clipboardButton = document.createElement('button');
        clipboardButton.id = 'clipboard-button';
        clipboardButton.className = 'action-button';
        clipboardButton.textContent = 'Process Clipboard Text';
        clipboardButton.style.marginLeft = '10px';
        clipboardButton.style.padding = '5px 10px';
        clipboardButton.style.backgroundColor = '#f0f0f0';
        clipboardButton.style.border = '1px solid #ccc';
        clipboardButton.style.borderRadius = '4px';
        clipboardButton.style.cursor = 'pointer';
        
        // Add hover effect
        clipboardButton.addEventListener('mouseover', () => {
            clipboardButton.style.backgroundColor = '#e0e0e0';
        });
        
        clipboardButton.addEventListener('mouseout', () => {
            clipboardButton.style.backgroundColor = '#f0f0f0';
        });
        
        // Add click event
        clipboardButton.addEventListener('click', this.requestClipboardAccess);
        
        // Add the button to the UI
        // Try to find the appropriate container
        const containers = [
            document.getElementById('file-controls'),
            document.querySelector('.file-controls'),
            document.querySelector('.controls'),
            document.querySelector('.action-buttons')
        ];
        
        // Find the first available container
        const container = containers.find(c => c !== null);
        
        if (container) {
            container.appendChild(clipboardButton);
        } else {
            // If no container found, add to the top of the document
            const mainContainer = document.querySelector('main') || document.body;
            mainContainer.insertBefore(clipboardButton, mainContainer.firstChild);
        }
        
        // Add keyboard shortcut info
        const shortcutInfo = document.createElement('span');
        shortcutInfo.textContent = ' (Ctrl+V)';
        shortcutInfo.style.fontSize = '0.8em';
        shortcutInfo.style.color = '#666';
        clipboardButton.appendChild(shortcutInfo);
    }
    
    // Handle paste event
    handlePaste(e) {
        console.log('Paste event detected');
        const clipboardData = e.clipboardData || window.clipboardData;
        if (clipboardData && clipboardData.getData) {
            const pastedText = clipboardData.getData('text');
            if (pastedText && pastedText.trim().length > 0) {
                console.log('Processing text from clipboard');
                this.processClipboardText(pastedText);
                
                // Prevent default paste behavior if we're in the document view
                if (this.reader.documentType !== 'chat') {
                    e.preventDefault();
                }
            }
        }
    }
    
    // Request clipboard access
    requestClipboardAccess() {
        // Show a message to the user
        const message = document.createElement('div');
        message.className = 'clipboard-message';
        message.style.position = 'fixed';
        message.style.top = '50%';
        message.style.left = '50%';
        message.style.transform = 'translate(-50%, -50%)';
        message.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        message.style.color = 'white';
        message.style.padding = '20px';
        message.style.borderRadius = '5px';
        message.style.zIndex = '1000';
        message.style.maxWidth = '400px';
        message.style.textAlign = 'center';
        
        message.innerHTML = `
            <h3>Clipboard Access</h3>
            <p>Please press Ctrl+V or paste text to process clipboard content.</p>
            <p>You can copy text from any source and paste it here to process.</p>
            <button id="close-clipboard-message" style="padding: 5px 10px; margin-top: 10px;">Got it!</button>
        `;
        
        document.body.appendChild(message);
        
        // Add event listener to close button
        document.getElementById('close-clipboard-message').addEventListener('click', () => {
            document.body.removeChild(message);
        });
        
        // Auto-remove after 8 seconds
        setTimeout(() => {
            if (document.body.contains(message)) {
                document.body.removeChild(message);
            }
        }, 8000);
        
        // Try to read from clipboard directly if the API is available
        if (navigator.clipboard && navigator.clipboard.readText) {
            navigator.clipboard.readText()
                .then(text => {
                    if (text && text.trim().length > 0) {
                        this.processClipboardText(text);
                        
                        // Remove the message if we successfully got text
                        if (document.body.contains(message)) {
                            document.body.removeChild(message);
                        }
                    }
                })
                .catch(err => {
                    console.error('Failed to read clipboard contents: ', err);
                    // We'll rely on the paste event instead
                });
        }
        
        // Focus on the document to capture the paste event
        document.body.focus();
    }
    
    // Process text from clipboard
    processClipboardText(text) {
        if (!text || text.trim().length === 0) {
            alert('No text found in clipboard');
            return;
        }
        
        console.log('Processing clipboard text:', text.substring(0, 50) + '...');
        
        // Store the text in the reader
        this.reader.extractedText = text;
        
        // Display the extracted text
        $('#original-text').text(text);
        $('#processed-text').empty();
        
        // Show the processing overlay
        $('#processing-overlay').css('display', 'flex');
        
        // Process the text automatically
        if (this.reader.llmHandler) {
            this.reader.llmHandler.processExtractedText(text);
        } else {
            // If llmHandler is not available, try to process directly
            this.reader.processExtractedText();
        }
        
        // Set up the Learning button to send text to the assessment URL
        $('#learning-button').off('click').on('click', () => {
            if (this.reader.llmHandler) {
                this.reader.llmHandler.sendTextToAssessment(text);
            } else {
                this.reader.openAssessment();
            }
        });
    }
}
