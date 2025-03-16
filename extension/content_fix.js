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
