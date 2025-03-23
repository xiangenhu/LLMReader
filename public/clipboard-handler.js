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
        // Wait for DOM to be fully loaded
        $(document).ready(() => {
            // Create a container div for the clipboard option
            const clipboardOptionDiv = document.createElement('div');
            
            // Create a checkbox (to match the style of other options)
            const clipboardCheckbox = document.createElement('input');
            clipboardCheckbox.type = 'checkbox';
            clipboardCheckbox.id = 'clipboard-option';
            clipboardCheckbox.checked = true;
            
            // Create a label for the checkbox
            const clipboardLabel = document.createElement('label');
            clipboardLabel.htmlFor = 'clipboard-option';
            clipboardLabel.textContent = 'Process Clipboard Text';
            clipboardLabel.style.cursor = 'pointer';
            
            // Create a button for clipboard processing
            const clipboardButton = document.createElement('button');
            clipboardButton.id = 'clipboard-button';
            clipboardButton.className = 'btn btn-secondary';
            clipboardButton.textContent = 'Paste';
            clipboardButton.style.marginLeft = '10px';
            clipboardButton.style.padding = '2px 8px';
            clipboardButton.style.fontSize = '12px';
            
            // Add click event
            clipboardButton.addEventListener('click', this.requestClipboardAccess);
            
            // Add keyboard shortcut info
            const shortcutInfo = document.createElement('span');
            shortcutInfo.textContent = ' (Ctrl+V)';
            shortcutInfo.style.fontSize = '0.8em';
            shortcutInfo.style.color = '#666';
            
            // Append elements to the container
            clipboardOptionDiv.appendChild(clipboardCheckbox);
            clipboardOptionDiv.appendChild(clipboardLabel);
            clipboardOptionDiv.appendChild(clipboardButton);
            clipboardLabel.appendChild(shortcutInfo);
            
            // Find the options header specifically
            const optionsHeader = document.getElementById('options-header');
            if (optionsHeader) {
                // Get the parent of the options header (the settings group)
                const optionsGroup = optionsHeader.closest('.settings-group');
                if (optionsGroup) {
                    // Find the collapsible content within the options group
                    const collapsibleContent = optionsGroup.querySelector('.collapsible-content');
                    if (collapsibleContent) {
                        // Add the clipboard option as the first item in the options list
                        if (collapsibleContent.firstChild) {
                            collapsibleContent.insertBefore(clipboardOptionDiv, collapsibleContent.firstChild);
                        } else {
                            collapsibleContent.appendChild(clipboardOptionDiv);
                        }
                        
                        console.log('Clipboard option added to options area');
                    } else {
                        console.error('Options collapsible content not found');
                    }
                } else {
                    console.error('Options group not found');
                }
            } else {
                console.error('Options header not found');
                // Fallback: add to body
                document.body.appendChild(clipboardOptionDiv);
            }
        });
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
        console.log('Requesting clipboard access');
        
        // Try to read from clipboard directly if the API is available
        if (navigator.clipboard && navigator.clipboard.readText) {
            navigator.clipboard.readText()
                .then(text => {
                    if (text && text.trim().length > 0) {
                        this.processClipboardText(text);
                    } else {
                        console.log('No text found in clipboard');
                        // Show a small notification instead of a popup
                        this.showNotification('No text found in clipboard. Copy some text and try again.');
                    }
                })
                .catch(err => {
                    console.error('Failed to read clipboard contents: ', err);
                    // Show a small notification instead of a popup
                    this.showNotification('Press Ctrl+V to paste text from clipboard');
                    // Focus on the document to capture the paste event
                    document.body.focus();
                });
        } else {
            // Show a small notification instead of a popup
            this.showNotification('Press Ctrl+V to paste text from clipboard');
            // Focus on the document to capture the paste event
            document.body.focus();
        }
    }
    
    // Show a small notification that auto-disappears
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'clipboard-notification';
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        notification.style.color = 'white';
        notification.style.padding = '10px 15px';
        notification.style.borderRadius = '4px';
        notification.style.zIndex = '1000';
        notification.style.maxWidth = '300px';
        notification.style.fontSize = '14px';
        notification.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 3000);
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
