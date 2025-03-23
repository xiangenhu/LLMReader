// Content script for LLM Reader Extension

// Global variables
let settings = {};
let selectedText = '';
let selectedElement = null;
let iframeContainer = null;
let processingOverlay = null;
let assessmentUrl = 'https://exp.skoonline.org/wizard/index.html?wizard=1&teacher=0&DirectSPL=1&DirectRequest='; // Default URL

// Initialize when the page is loaded
(async function() {
  // Load settings
  settings = await getSettings();
  
  // Use assessment URL from settings if available
  if (settings.assessmentUrl) {
    assessmentUrl = settings.assessmentUrl;
    console.log('Using assessment URL from settings:', assessmentUrl);
  }
  
  // Set up event listeners
  document.addEventListener('mouseup', handleTextSelection);
  document.addEventListener('keydown', handleKeyPress);
  
  // Create UI elements
  createUIElements();
  
  console.log('LLM Reader Extension initialized');
})();

// Get settings from storage
async function getSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get({
      // Default settings
      readingLevel: 'college',
      language: 'original',
      style: 'original',
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      apiKey: '',
      autoProcess: true,
      showIframe: true,
      expandContext: true,
      textOnly: false,
      dimUnread: false,
      enableAssessment: false,
      assessmentUrl: 'https://exp.skoonline.org/wizard/index.html?wizard=1&teacher=0&DirectSPL=1&DirectRequest='
    }, resolve);
  });
}

// Create UI elements
function createUIElements() {
  // Create iframe container (hidden by default)
  iframeContainer = document.createElement('div');
  iframeContainer.className = 'llm-reader-iframe-container';
  iframeContainer.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 40%;
    height: 100%;
    background-color: white;
    box-shadow: -5px 0 15px rgba(0, 0, 0, 0.2);
    z-index: 9999;
    display: none;
    flex-direction: column;
    overflow: hidden;
  `;
  document.body.appendChild(iframeContainer);
  
  // Create processing overlay (hidden by default)
  processingOverlay = document.createElement('div');
  processingOverlay.className = 'llm-reader-processing-overlay';
  processingOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 10000;
    display: none;
    justify-content: center;
    align-items: center;
  `;
  
  const spinner = document.createElement('div');
  spinner.className = 'llm-reader-spinner';
  spinner.style.cssText = `
    width: 50px;
    height: 50px;
    border: 5px solid #f3f3f3;
    border-top: 5px solid #3498db;
    border-radius: 50%;
    animation: llm-reader-spin 1s linear infinite;
  `;
  
  // Add keyframes for spinner animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes llm-reader-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
  
  processingOverlay.appendChild(spinner);
  document.body.appendChild(processingOverlay);
}

// Handle text selection
function handleTextSelection(event) {
  const selection = window.getSelection();
  if (!selection.toString().trim()) return;
  
  selectedText = selection.toString().trim();
  
  // Get the element that contains the selection
  const range = selection.getRangeAt(0);
  selectedElement = range.commonAncestorContainer;
  
  // If the selected element is a text node, get its parent
  if (selectedElement.nodeType === Node.TEXT_NODE) {
    selectedElement = selectedElement.parentNode;
  }
  
  // If expandContext is enabled, try to get the full paragraph or section
  if (settings.expandContext) {
    console.log('Original selection:', selectedText);
    console.log('Selection length:', selectedText.length);
    
    const expandedText = expandTextContext(selectedElement, selectedText);
    if (expandedText && expandedText !== selectedText) {
      console.log('Expanded text:', expandedText);
      console.log('Expanded length:', expandedText.length);
      selectedText = expandedText;
      
      // Show a visual indicator that the selection was expanded
      showExpansionIndicator(event.clientX, event.clientY);
    } else {
      console.log('No expanded text found');
    }
  }
  
  // If auto-process is enabled, process the text immediately
  if (settings.autoProcess && selectedText.length > 0) {
    processSelectedText();
  }
}

// Expand text context to include surrounding content
function expandTextContext(element, text) {
  // Check if we're in a PDF viewer
  const isPdf = isPdfViewer();
  if (isPdf) {
    console.log('PDF detected, using PDF-specific paragraph detection');
    const expandedPdfText = expandPdfSelection(element, text);
    if (expandedPdfText && expandedPdfText !== text) {
      console.log('Expanded PDF text using PDF-specific detection');
      return expandedPdfText;
    }
  }
  
  // If text-only mode is enabled, extract only text content
  if (settings.textOnly) {
    console.log('Text-only mode enabled');
    const textOnlyContent = extractTextOnly(element);
    if (textOnlyContent && textOnlyContent.trim().length > 0) {
      console.log('Extracted text-only content');
      return textOnlyContent;
    }
  }

  // First, try to expand the selection using DOM Range
  const expandedByRange = expandSelectionToEntireParagraph(text);
  if (expandedByRange && expandedByRange !== text) {
    console.log('Expanded using DOM Range');
    return expandedByRange;
  }
  
  // Try to find the most appropriate container (paragraph, section, etc.)
  let container = element;
  
  // Check if we're in a paragraph, list item, heading, or other text container
  const textContainers = ['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE'];
  const secondaryContainers = ['DIV', 'SECTION', 'ARTICLE', 'TD', 'SPAN'];
  
  // First, try to find a primary text container (paragraph, list item, heading)
  while (container && !textContainers.includes(container.nodeName)) {
    // If we reach the body or html, stop searching
    if (container.nodeName === 'BODY' || container.nodeName === 'HTML') {
      break;
    }
    container = container.parentNode;
  }
  
  // If we didn't find a primary container, try secondary containers
  if (!container || container.nodeName === 'BODY' || container.nodeName === 'HTML') {
    container = element;
    while (container && !secondaryContainers.includes(container.nodeName)) {
      if (container.nodeName === 'BODY' || container.nodeName === 'HTML') {
        break;
      }
      container = container.parentNode;
    }
  }
  
  // If we found a container, use its text content
  if (container && container.nodeName !== 'BODY' && container.nodeName !== 'HTML') {
    const containerText = container.textContent.trim();
    
    // Only use the container text if it's not too long (max 5000 chars)
    // and it contains the selected text
    if (containerText.length <= 5000 && containerText.includes(text)) {
      console.log(`Found container: ${container.nodeName} with text length: ${containerText.length}`);
      return containerText;
    }
  }
  
  // If we couldn't find a suitable container or the container is too large,
  // try to extract the paragraph based on text analysis
  if (text.length > 0) {
    // Get the text node that contains the selection
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let node = range.startContainer;
      
      // If the node is not a text node, find the first text node
      if (node.nodeType !== Node.TEXT_NODE) {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        node = walker.firstChild();
      }
      
      if (node && node.nodeType === Node.TEXT_NODE) {
        // Get the full text content of the parent
        const fullText = node.parentNode.textContent;
        
        // Find the paragraph boundaries
        let startPos = 0;
        let endPos = fullText.length;
        
        // Find the start of the paragraph (look for double newlines before the selection)
        const selectionStartInParent = fullText.indexOf(text);
        if (selectionStartInParent > 0) {
          const textBeforeSelection = fullText.substring(0, selectionStartInParent);
          const lastDoubleNewline = textBeforeSelection.lastIndexOf('\n\n');
          if (lastDoubleNewline !== -1) {
            startPos = lastDoubleNewline + 2; // Skip the double newline
          } else {
            const lastNewline = textBeforeSelection.lastIndexOf('\n');
            if (lastNewline !== -1) {
              startPos = lastNewline + 1; // Skip the newline
            }
          }
        }
        
        // Find the end of the paragraph (look for double newlines after the selection)
        const selectionEndInParent = selectionStartInParent + text.length;
        if (selectionEndInParent < fullText.length) {
          const textAfterSelection = fullText.substring(selectionEndInParent);
          const firstDoubleNewline = textAfterSelection.indexOf('\n\n');
          if (firstDoubleNewline !== -1) {
            endPos = selectionEndInParent + firstDoubleNewline;
          } else {
            const firstNewline = textAfterSelection.indexOf('\n');
            if (firstNewline !== -1) {
              endPos = selectionEndInParent + firstNewline;
            }
          }
        }
        
        // Extract the paragraph
        const paragraph = fullText.substring(startPos, endPos).trim();
        if (paragraph.length > 0 && paragraph.length <= 5000 && paragraph.includes(text)) {
          console.log(`Extracted paragraph with length: ${paragraph.length}`);
          return paragraph;
        }
      }
    }
  }
  
  // If all else fails, just return the selected text
  return text;
}

// Use DOM Range API to expand selection to entire paragraph
function expandSelectionToEntireParagraph(text) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return null;
  
  try {
    // Clone the current range to avoid modifying the user's selection
    const range = selection.getRangeAt(0).cloneRange();
    const startContainer = range.startContainer;
    
    // Only proceed if we're in a text node
    if (startContainer.nodeType !== Node.TEXT_NODE) {
      return null;
    }
    
    // Find the closest paragraph-like element
    let paragraphElement = startContainer.parentNode;
    const paragraphTags = ['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'DIV'];
    
    while (paragraphElement && !paragraphTags.includes(paragraphElement.nodeName)) {
      if (paragraphElement.nodeName === 'BODY' || paragraphElement.nodeName === 'HTML') {
        return null;
      }
      paragraphElement = paragraphElement.parentNode;
    }
    
    if (!paragraphElement) return null;
    
    // Create a range that encompasses the entire paragraph
    const paragraphRange = document.createRange();
    paragraphRange.selectNodeContents(paragraphElement);
    
    // Get the text content of the paragraph
    const paragraphText = paragraphRange.toString().trim();
    
    // Only use this if it's not too long and contains the original selection
    if (paragraphText.length <= 5000 && paragraphText.includes(text)) {
      console.log(`Found paragraph using Range API: ${paragraphElement.nodeName}`);
      return paragraphText;
    }
    
    return null;
  } catch (error) {
    console.error('Error expanding selection with Range API:', error);
    return null;
  }
}

// Handle key press events
function handleKeyPress(event) {
  // Process selected text with Ctrl+Shift+P
  if (event.ctrlKey && event.shiftKey && event.key === 'P') {
    event.preventDefault();
    if (selectedText) {
      processSelectedText();
    }
  }
  
  // Close iframe with Escape key
  if (event.key === 'Escape') {
    closeIframe();
  }
}

// Extract only text content, ignoring buttons, images, etc.
function extractTextOnly(element) {
  try {
    // Find the container element
    let container = findTextContainer(element);
    if (!container) return null;
    
    // Extract only text nodes, ignoring buttons, inputs, etc.
    return getTextNodesOnly(container);
  } catch (error) {
    console.error('Error extracting text-only content:', error);
    return null;
  }
}

// Find the most appropriate text container
function findTextContainer(element) {
  // Try to find the most appropriate container (paragraph, section, etc.)
  const textContainers = ['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'DIV', 'SECTION', 'ARTICLE'];
  
  let container = element;
  while (container && !textContainers.includes(container.nodeName)) {
    // If we reach the body or html, stop searching
    if (container.nodeName === 'BODY' || container.nodeName === 'HTML') {
      break;
    }
    container = container.parentNode;
  }
  
  // If we didn't find a suitable container, return null
  if (!container || container.nodeName === 'BODY' || container.nodeName === 'HTML') {
    return null;
  }
  
  return container;
}

// Get only text nodes from an element, ignoring buttons, inputs, etc.
function getTextNodesOnly(element) {
  // Skip non-text elements
  if (!element) return '';
  
  // Skip buttons, inputs, and other interactive elements
  const skipTags = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'OPTION', 'SCRIPT', 'STYLE', 'IFRAME', 'CANVAS', 'SVG', 'IMG'];
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
    text += getTextNodesOnly(child);
  }
  
  return text.trim();
}

// Process selected text with LLM
async function processSelectedText() {
  if (!selectedText || selectedText.length === 0) return;
  
  // Show processing overlay
  processingOverlay.style.display = 'flex';
  
  // If dim-unread is enabled, mark the selected text as read
  if (settings.dimUnread && selectedElement) {
    markAsRead(selectedElement);
  }
  
  // If assessment is enabled, send to SPL assessment URL
  if (settings.enableAssessment) {
    sendToAssessment(selectedText);
  }
  
  try {
    // Get current settings
    settings = await getSettings();
    
    // Create a variable to store the full response for streaming
    let fullResponse = '';
    
    // Create a container for the processed text
    let processedTextContainer = null;
    
    // Set up listener for streaming chunks
    const chunkListener = (message, sender, sendResponse) => {
      if (message.action === 'textChunk') {
        if (message.type === 'start') {
          console.log('Streaming started');
          
          // Create iframe if it doesn't exist
          if (settings.showIframe && !iframeContainer.style.display === 'flex') {
            displayProcessedText(selectedText, '');
            
            // Get the processed content container
            processedTextContainer = document.querySelector('.llm-reader-processed-content');
            if (processedTextContainer) {
              processedTextContainer.innerHTML = '';
            }
          }
        } else if (message.type === 'chunk') {
          // Append the chunk to the full response
          fullResponse += message.chunk;
          
          // Update the UI with the chunk
          if (processedTextContainer) {
            processedTextContainer.innerHTML = fullResponse;
          }
        } else if (message.type === 'complete') {
          console.log('Streaming complete');
          
          // Hide processing overlay
          processingOverlay.style.display = 'none';
          
          // If we're not using the iframe, display the full response
          if (!settings.showIframe) {
            displayProcessedText(selectedText, fullResponse);
          }
          
          // Remove the listener
          chrome.runtime.onMessage.removeListener(chunkListener);
        } else if (message.type === 'error') {
          console.error('Streaming error:', message.chunk.error);
          
          // Hide processing overlay
          processingOverlay.style.display = 'none';
          
          // Show error
          showError(message.chunk.error || 'Error processing text');
          
          // Remove the listener
          chrome.runtime.onMessage.removeListener(chunkListener);
        }
      }
    };
    
    // Add the listener
    chrome.runtime.onMessage.addListener(chunkListener);
    
    // Send message to background script to process text with streaming
    chrome.runtime.sendMessage({
      action: 'processText',
      text: selectedText,
      settings: settings,
      stream: true
    }, response => {
      if (!response || !response.success) {
        // Hide processing overlay
        processingOverlay.style.display = 'none';
        
        // Show error
        showError(response?.error || 'Error processing text');
        
        // Remove the listener
        chrome.runtime.onMessage.removeListener(chunkListener);
      }
    });
  } catch (error) {
    // Hide processing overlay
    processingOverlay.style.display = 'none';
    showError(error.message);
  }
}

// Mark an element as read
function markAsRead(element) {
  try {
    // Find the container element
    let container = findTextContainer(element);
    if (!container) return;
    
    // Add a class to mark it as read
    container.classList.add('llm-reader-read');
    
    // If the container doesn't have an ID, add one
    if (!container.id) {
      container.id = `llm-reader-paragraph-${Date.now()}`;
    }
    
    // Store the paragraph ID in local storage to persist across page loads
    const readParagraphs = JSON.parse(localStorage.getItem('llm-reader-read-paragraphs') || '[]');
    if (!readParagraphs.includes(container.id)) {
      readParagraphs.push(container.id);
      localStorage.setItem('llm-reader-read-paragraphs', JSON.stringify(readParagraphs));
    }
  } catch (error) {
    console.error('Error marking as read:', error);
  }
}

// Apply dimming to unread text
function applyDimming() {
  try {
    // Create a style element if it doesn't exist
    let style = document.getElementById('llm-reader-dimming-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'llm-reader-dimming-style';
      document.head.appendChild(style);
    }
    
    // Add CSS for dimming
    style.textContent = `
      body * {
        opacity: 0.5;
        transition: opacity 0.3s ease;
      }
      .llm-reader-read {
        opacity: 1 !important;
      }
    `;
    
    // Load previously read paragraphs from local storage
    const readParagraphs = JSON.parse(localStorage.getItem('llm-reader-read-paragraphs') || '[]');
    
    // Mark previously read paragraphs
    readParagraphs.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.classList.add('llm-reader-read');
      }
    });
  } catch (error) {
    console.error('Error applying dimming:', error);
  }
}

// Remove dimming
function removeDimming() {
  try {
    // Remove the style element
    const style = document.getElementById('llm-reader-dimming-style');
    if (style) {
      style.remove();
    }
  } catch (error) {
    console.error('Error removing dimming:', error);
  }
}

// Open SPL assessment URL with the selected text
function openSplAssessmentUrl(text) {
  try {
    // Encode the text for URL
    const encodedText = encodeURIComponent(text);
    
    // Construct the URL using the configured assessment URL
    const splUrl = `${assessmentUrl}${encodedText}`;
    
    // Open in a new tab
    window.open(splUrl, '_blank');
  } catch (error) {
    console.error('Error opening SPL assessment URL:', error);
    showError('Failed to open SPL assessment tool');
  }
}

// Display processed text in iframe
function displayProcessedText(originalText, processedText) {
  if (!settings.showIframe) {
    // If iframe is disabled, show in alert (not ideal but simple)
    alert(processedText);
    return;
  }
  
  // Apply dimming if enabled
  if (settings.dimUnread) {
    applyDimming();
  } else {
    removeDimming();
  }
  
  // Clear existing content
  iframeContainer.innerHTML = '';
  
  // Create header
  const header = document.createElement('div');
  header.className = 'llm-reader-header';
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    background-color: #f5f5f5;
    border-bottom: 1px solid #ddd;
  `;
  
  const title = document.createElement('h3');
  title.textContent = 'LLM Reader';
  title.style.margin = '0';
  
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.style.cssText = `
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
  `;
  closeButton.addEventListener('click', closeIframe);
  
  header.appendChild(title);
  header.appendChild(closeButton);
  iframeContainer.appendChild(header);
  
  // Create tabs
  const tabs = document.createElement('div');
  tabs.className = 'llm-reader-tabs';
  tabs.style.cssText = `
    display: flex;
    background-color: #f5f5f5;
    border-bottom: 1px solid #ddd;
  `;
  
  const originalTab = document.createElement('div');
  originalTab.className = 'llm-reader-tab active';
  originalTab.textContent = 'Original';
  originalTab.style.cssText = `
    padding: 10px 15px;
    cursor: pointer;
    border-bottom: 2px solid #4CAF50;
  `;
  
  const processedTab = document.createElement('div');
  processedTab.className = 'llm-reader-tab';
  processedTab.textContent = 'Processed';
  processedTab.style.cssText = `
    padding: 10px 15px;
    cursor: pointer;
    border-bottom: 2px solid transparent;
  `;
  
  tabs.appendChild(originalTab);
  tabs.appendChild(processedTab);
  iframeContainer.appendChild(tabs);
  
  // Create content container
  const contentContainer = document.createElement('div');
  contentContainer.className = 'llm-reader-content';
  contentContainer.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 15px;
  `;
  
  // Create original content
  const originalContent = document.createElement('div');
  originalContent.className = 'llm-reader-original-content';
  originalContent.innerHTML = `<pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(originalText)}</pre>`;
  
  // Create processed content (hidden initially)
  const processedContent = document.createElement('div');
  processedContent.className = 'llm-reader-processed-content';
  processedContent.style.display = 'none';
  processedContent.innerHTML = processedText;
  
  contentContainer.appendChild(originalContent);
  contentContainer.appendChild(processedContent);
  iframeContainer.appendChild(contentContainer);
  
  // Add tab switching functionality
  originalTab.addEventListener('click', () => {
    originalTab.style.borderBottom = '2px solid #4CAF50';
    processedTab.style.borderBottom = '2px solid transparent';
    originalContent.style.display = 'block';
    processedContent.style.display = 'none';
  });
  
  processedTab.addEventListener('click', () => {
    originalTab.style.borderBottom = '2px solid transparent';
    processedTab.style.borderBottom = '2px solid #4CAF50';
    originalContent.style.display = 'none';
    processedContent.style.display = 'block';
  });
  
  // Show iframe
  iframeContainer.style.display = 'flex';
}

// Close iframe
function closeIframe() {
  if (iframeContainer) {
    iframeContainer.style.display = 'none';
  }
}

// Show error message
function showError(message) {
  console.error('LLM Reader Error:', message);
  alert(`LLM Reader Error: ${message}`);
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Check if the current page is a PDF viewer
function isPdfViewer() {
  // Check for common PDF viewer elements
  const hasPdfJs = document.querySelector('.pdfViewer') !== null || 
                   document.querySelector('embed[type="application/pdf"]') !== null ||
                   document.querySelector('object[type="application/pdf"]') !== null ||
                   document.querySelector('iframe[src*=".pdf"]') !== null ||
                   window.location.href.toLowerCase().includes('.pdf');
  
  return hasPdfJs;
}

// Expand selection in PDF documents
function expandPdfSelection(element, text) {
  try {
    // In PDFs, text is often broken into separate spans or divs per line
    // We need to find the paragraph by looking at nearby text elements
    
    // First, check if we're in a text layer of PDF.js
    const textLayer = element.closest('.textLayer') || 
                      element.closest('.pdfViewer') || 
                      document.querySelector('.textLayer');
    
    if (!textLayer) {
      // Not in a standard PDF.js viewer, try generic approach
      return expandPdfSelectionGeneric(element, text);
    }
    
    // Get all text elements in the current page
    const textElements = Array.from(textLayer.querySelectorAll('span, div'));
    if (textElements.length === 0) return null;
    
    // Find the element containing our selection
    let selectedElementIndex = -1;
    for (let i = 0; i < textElements.length; i++) {
      if (textElements[i].textContent.includes(text)) {
        selectedElementIndex = i;
        break;
      }
    }
    
    if (selectedElementIndex === -1) return null;
    
    // Determine paragraph boundaries by looking for significant vertical gaps
    // or empty lines in the PDF
    let startIndex = selectedElementIndex;
    let endIndex = selectedElementIndex;
    
    // Look backward to find start of paragraph
    for (let i = selectedElementIndex - 1; i >= 0; i--) {
      const currentElement = textElements[i];
      const nextElement = textElements[i + 1];
      
      // Check if there's a significant gap or if this is an empty line
      if (isParagraphBreak(currentElement, nextElement)) {
        break;
      }
      
      startIndex = i;
    }
    
    // Look forward to find end of paragraph
    for (let i = selectedElementIndex + 1; i < textElements.length; i++) {
      const currentElement = textElements[i];
      const prevElement = textElements[i - 1];
      
      // Check if there's a significant gap or if this is an empty line
      if (isParagraphBreak(prevElement, currentElement)) {
        break;
      }
      
      endIndex = i;
    }
    
    // Combine the text from all elements in the paragraph
    let paragraphText = '';
    for (let i = startIndex; i <= endIndex; i++) {
      paragraphText += textElements[i].textContent + ' ';
    }
    
    paragraphText = paragraphText.trim();
    
    // Only use this if it's not too long and contains the original selection
    if (paragraphText.length <= 5000 && paragraphText.includes(text)) {
      console.log(`Found PDF paragraph with length: ${paragraphText.length}`);
      return paragraphText;
    }
    
    return null;
  } catch (error) {
    console.error('Error in PDF paragraph detection:', error);
    return null;
  }
}

// Generic approach for PDF viewers that don't use standard PDF.js structure
function expandPdfSelectionGeneric(element, text) {
  try {
    // For generic PDF viewers, we'll use a text-based approach
    // Get the parent that likely contains the paragraph
    let container = element;
    while (container && container.childNodes.length <= 3 && container !== document.body) {
      container = container.parentNode;
    }
    
    if (!container || container === document.body) return null;
    
    // Get all text from this container
    const fullText = container.textContent;
    
    // Find the paragraph boundaries using newlines and spacing patterns
    let startPos = 0;
    let endPos = fullText.length;
    
    // Find the position of our selected text
    const selectionPos = fullText.indexOf(text);
    if (selectionPos === -1) return null;
    
    // Look for paragraph breaks before the selection
    for (let i = selectionPos - 1; i >= 0; i--) {
      // Look for double newlines or other paragraph indicators
      if ((fullText[i] === '\n' && fullText[i-1] === '\n') || 
          (fullText[i] === '\r' && fullText[i-1] === '\n')) {
        startPos = i + 1;
        break;
      }
    }
    
    // Look for paragraph breaks after the selection
    for (let i = selectionPos + text.length; i < fullText.length; i++) {
      // Look for double newlines or other paragraph indicators
      if ((fullText[i] === '\n' && fullText[i+1] === '\n') || 
          (fullText[i] === '\n' && fullText[i+1] === '\r')) {
        endPos = i;
        break;
      }
    }
    
    // Extract the paragraph
    const paragraphText = fullText.substring(startPos, endPos).trim();
    
    // Only use this if it's not too long and contains the original selection
    if (paragraphText.length <= 5000 && paragraphText.includes(text)) {
      console.log(`Found generic PDF paragraph with length: ${paragraphText.length}`);
      return paragraphText;
    }
    
    return null;
  } catch (error) {
    console.error('Error in generic PDF paragraph detection:', error);
    return null;
  }
}

// Helper function to determine if there's a paragraph break between elements
function isParagraphBreak(element1, element2) {
  if (!element1 || !element2) return true;
  
  try {
    // Get positions
    const rect1 = element1.getBoundingClientRect();
    const rect2 = element2.getBoundingClientRect();
    
    // Check for significant vertical gap (more than 1.5x the line height)
    const lineHeight = rect1.height;
    const verticalGap = rect2.top - (rect1.top + rect1.height);
    
    if (verticalGap > lineHeight * 1.5) {
      return true;
    }
    
    // Check if either element is empty or just whitespace
    if (element1.textContent.trim() === '' || element2.textContent.trim() === '') {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking paragraph break:', error);
    return false;
  }
}

// Show a visual indicator that the selection was expanded
  indicator.style.left = `${x + 15}px`;
  indicator.style.top = `${y + 15}px`;
  indicator.textContent = 'Expanded to full paragraph';
  indicator.style.opacity = '1';
  
  // Hide the indicator after a short delay
  setTimeout(() => {
    indicator.style.opacity = '0';
  }, 1500);
}
// Show a visual indicator that the selection was expanded
function showExpansionIndicator(x, y) {
  // Create indicator element if it doesn't exist
  let indicator = document.getElementById('llm-reader-expansion-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'llm-reader-expansion-indicator';
    indicator.style.cssText = `
      position: fixed;
      padding: 8px 12px;
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      border-radius: 4px;
      font-size: 14px;
      z-index: 10000;
      pointer-events: none;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(indicator);
  }
  
  // Position the indicator near the mouse
  indicator.style.left = `${x + 15}px`;
  indicator.style.top = `${y + 15}px`;
  indicator.textContent = 'Expanded to full paragraph';
  indicator.style.opacity = '1';
  
  // Hide the indicator after a short delay
  setTimeout(() => {
    indicator.style.opacity = '0';
  }, 1500);
}
