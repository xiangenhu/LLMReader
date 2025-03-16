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
