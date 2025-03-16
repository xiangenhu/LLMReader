document.addEventListener('DOMContentLoaded', function() {
  // Load saved settings
  loadSettings();
  
  // Set up event listeners
  document.getElementById('provider').addEventListener('change', updateModelOptions);
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  document.getElementById('reset-settings').addEventListener('click', resetSettings);
  
  // Initialize model options based on selected provider
  updateModelOptions();
});

// Load settings from storage
function loadSettings() {
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
    enableAssessment: false
  }, function(items) {
    // Populate form with saved settings
    document.getElementById('reading-level').value = items.readingLevel;
    document.getElementById('language').value = items.language;
    document.getElementById('style').value = items.style;
    document.getElementById('provider').value = items.provider;
    document.getElementById('api-key').value = items.apiKey;
    document.getElementById('auto-process').checked = items.autoProcess;
    document.getElementById('show-iframe').checked = items.showIframe;
    document.getElementById('expand-context').checked = items.expandContext;
    document.getElementById('text-only').checked = items.textOnly;
    document.getElementById('dim-unread').checked = items.dimUnread;
    document.getElementById('enable-assessment').checked = items.enableAssessment;
    
    // Update model options and select the saved model
    updateModelOptions();
    document.getElementById('model').value = items.model;
  });
}

// Save settings to storage
function saveSettings() {
  const settings = {
    readingLevel: document.getElementById('reading-level').value,
    language: document.getElementById('language').value,
    style: document.getElementById('style').value,
    provider: document.getElementById('provider').value,
    model: document.getElementById('model').value,
    apiKey: document.getElementById('api-key').value,
    autoProcess: document.getElementById('auto-process').checked,
    showIframe: document.getElementById('show-iframe').checked,
    expandContext: document.getElementById('expand-context').checked,
    textOnly: document.getElementById('text-only').checked,
    dimUnread: document.getElementById('dim-unread').checked,
    enableAssessment: document.getElementById('enable-assessment').checked
  };
  
  chrome.storage.sync.set(settings, function() {
    // Show success message
    const statusMessage = document.getElementById('status-message');
    statusMessage.textContent = 'Settings saved successfully!';
    statusMessage.className = 'status-message success';
    
    // Hide message after 2 seconds
    setTimeout(function() {
      statusMessage.className = 'status-message';
    }, 2000);
  });
}

// Reset settings to defaults
function resetSettings() {
  const defaultSettings = {
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
    enableAssessment: false
  };
  
  chrome.storage.sync.set(defaultSettings, function() {
    // Reload form with default settings
    loadSettings();
    
    // Show success message
    const statusMessage = document.getElementById('status-message');
    statusMessage.textContent = 'Settings reset to defaults!';
    statusMessage.className = 'status-message success';
    
    // Hide message after 2 seconds
    setTimeout(function() {
      statusMessage.className = 'status-message';
    }, 2000);
  });
}

// Update model options based on selected provider
function updateModelOptions() {
  const provider = document.getElementById('provider').value;
  const modelSelect = document.getElementById('model');
  
  // Clear existing options
  modelSelect.innerHTML = '';
  
  // Add appropriate options based on provider
  switch (provider) {
    case 'openai':
      addOption(modelSelect, 'GPT-4', 'gpt-4');
      addOption(modelSelect, 'GPT-3.5 Turbo', 'gpt-3.5-turbo', true);
      break;
    case 'anthropic':
      addOption(modelSelect, 'Claude 3 Opus', 'claude-3-opus');
      addOption(modelSelect, 'Claude 3 Sonnet', 'claude-3-sonnet', true);
      addOption(modelSelect, 'Claude 3 Haiku', 'claude-3-haiku');
      break;
    case 'google':
      addOption(modelSelect, 'Gemini Pro', 'gemini-pro', true);
      addOption(modelSelect, 'Gemini Ultra', 'gemini-ultra');
      break;
  }
}

// Helper function to add an option to a select element
function addOption(selectElement, text, value, selected = false) {
  const option = document.createElement('option');
  option.text = text;
  option.value = value;
  option.selected = selected;
  selectElement.add(option);
}
