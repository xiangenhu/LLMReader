// Background script for LLM Reader Extension

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'processText') {
    if (message.stream) {
      // For streaming, we'll send chunks back to the content script
      processTextWithLLMStreaming(message.text, message.settings, sender.tab.id);
      // Send immediate response to acknowledge the request
      sendResponse({ success: true, streaming: true });
    } else {
      // For non-streaming, we'll send the complete response
      processTextWithLLM(message.text, message.settings)
        .then(result => sendResponse({ success: true, processedText: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
    }
    return true; // Indicates we'll respond asynchronously
  }
  
  if (message.action === 'sendToAssessment') {
    // Just acknowledge the request, actual redirection happens in content script
    sendResponse({ success: true });
    return true;
  }
});

// Send a message to the content script with a text chunk
function sendTextChunk(tabId, chunk, type = 'chunk') {
  chrome.tabs.sendMessage(tabId, {
    action: 'textChunk',
    chunk: chunk,
    type: type
  });
}

/**
 * Process text with LLM using streaming
 * @param {string} text - The text to process
 * @param {Object} settings - User settings
 * @param {number} tabId - The tab ID to send chunks to
 */
async function processTextWithLLMStreaming(text, settings, tabId) {
  // Construct prompt based on user preferences
  let prompt = `Please rewrite the following text `;
  
  if (settings.readingLevel !== 'original') {
    prompt += `at a ${settings.readingLevel} reading level `;
  }
  
  if (settings.language !== 'original') {
    prompt += `in ${settings.language} `;
  }
  
  if (settings.style !== 'original') {
    prompt += `using a ${settings.style} style `;
  }
  
  prompt += `while preserving the original meaning and key information:\n\n${text}`;
  
  // Send start event
  sendTextChunk(tabId, {}, 'start');
  
  try {
    // Call appropriate LLM API based on provider
    switch (settings.provider) {
      case 'openai':
        await callOpenAIStreaming(prompt, settings.model, settings.apiKey, tabId);
        break;
      case 'anthropic':
        await callClaudeStreaming(prompt, settings.model, settings.apiKey, tabId);
        break;
      case 'google':
        await callGeminiStreaming(prompt, settings.model, settings.apiKey, tabId);
        break;
      default:
        throw new Error(`Unsupported provider: ${settings.provider}`);
    }
    
    // Send complete event
    sendTextChunk(tabId, {}, 'complete');
  } catch (error) {
    console.error('Streaming error:', error);
    // Send error event
    sendTextChunk(tabId, { error: error.message }, 'error');
  }
}

/**
 * Call OpenAI API with streaming
 * @param {string} prompt - The prompt to send to the API
 * @param {string} model - The model to use
 * @param {string} apiKey - The API key
 * @param {number} tabId - The tab ID to send chunks to
 */
async function callOpenAIStreaming(prompt, model, apiKey, tabId) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
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
        temperature: 0.7,
        stream: true
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API error');
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // Decode the chunk
      const chunk = decoder.decode(value);
      
      // Process the chunk (SSE format)
      const lines = chunk.split('\n').filter(line => line.trim() !== '');
      for (const line of lines) {
        if (line.includes('[DONE]')) continue;
        
        if (line.startsWith('data:')) {
          try {
            const data = JSON.parse(line.substring(5));
            if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
              const content = data.choices[0].delta.content;
              sendTextChunk(tabId, content);
            }
          } catch (e) {
            console.error('Error parsing streaming data:', e);
          }
        }
      }
    }
  } catch (error) {
    console.error('OpenAI streaming error:', error);
    throw new Error(`OpenAI API error: ${error.message}`);
  }
}

/**
 * Call Claude API with streaming
 * @param {string} prompt - The prompt to send to the API
 * @param {string} model - The model to use
 * @param {string} apiKey - The API key
 * @param {number} tabId - The tab ID to send chunks to
 */
async function callClaudeStreaming(prompt, model, apiKey, tabId) {
  try {
    // Map model names to actual Claude model identifiers
    const modelMap = {
      'claude-3-opus': 'claude-3-opus-20240229',
      'claude-3-sonnet': 'claude-3-sonnet-20240229',
      'claude-3-haiku': 'claude-3-haiku-20240307'
    };
    
    const claudeModel = modelMap[model] || 'claude-3-sonnet-20240229';
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: claudeModel,
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: true
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Claude API error');
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // Decode the chunk
      const chunk = decoder.decode(value);
      
      // Process the chunk (SSE format)
      const lines = chunk.split('\n').filter(line => line.trim() !== '');
      for (const line of lines) {
        if (line.startsWith('data:')) {
          try {
            const data = JSON.parse(line.substring(5));
            if (data.type === 'content_block_delta' && data.delta && data.delta.text) {
              const content = data.delta.text;
              sendTextChunk(tabId, content);
            }
          } catch (e) {
            console.error('Error parsing streaming data:', e);
          }
        }
      }
    }
  } catch (error) {
    console.error('Claude streaming error:', error);
    throw new Error(`Claude API error: ${error.message}`);
  }
}

/**
 * Call Gemini API with streaming
 * @param {string} prompt - The prompt to send to the API
 * @param {string} model - The model to use
 * @param {string} apiKey - The API key
 * @param {number} tabId - The tab ID to send chunks to
 */
async function callGeminiStreaming(prompt, model, apiKey, tabId) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:streamGenerateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
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
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Gemini API error');
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // Decode the chunk
      const chunk = decoder.decode(value);
      
      try {
        const data = JSON.parse(chunk);
        if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
          const content = data.candidates[0].content.parts[0].text;
          sendTextChunk(tabId, content);
        }
      } catch (e) {
        console.error('Error parsing streaming data:', e);
      }
    }
  } catch (error) {
    console.error('Gemini streaming error:', error);
    throw new Error(`Gemini API error: ${error.message}`);
  }
}

/**
 * Process text with LLM based on user preferences
 * @param {string} text - The text to process
 * @param {Object} settings - User settings
 * @returns {Promise<string>} - The processed text
 */
async function processTextWithLLM(text, settings) {
  // Construct prompt based on user preferences
  let prompt = `Please rewrite the following text `;
  
  if (settings.readingLevel !== 'original') {
    prompt += `at a ${settings.readingLevel} reading level `;
  }
  
  if (settings.language !== 'original') {
    prompt += `in ${settings.language} `;
  }
  
  if (settings.style !== 'original') {
    prompt += `using a ${settings.style} style `;
  }
  
  prompt += `while preserving the original meaning and key information:\n\n${text}`;
  
  // Call appropriate LLM API based on provider
  switch (settings.provider) {
    case 'openai':
      return await callOpenAI(prompt, settings.model, settings.apiKey);
    case 'anthropic':
      return await callClaude(prompt, settings.model, settings.apiKey);
    case 'google':
      return await callGemini(prompt, settings.model, settings.apiKey);
    default:
      throw new Error(`Unsupported provider: ${settings.provider}`);
  }
}

/**
 * Assess text with LLM
 * @param {string} text - The text to assess
 * @param {Object} settings - User settings
 * @returns {Promise<string>} - The assessment
 */
async function assessTextWithLLM(text, settings) {
  const prompt = `Please analyze the following text and provide a brief assessment of:
1. Main topic and key points
2. Reading difficulty level
3. Technical terminology used
4. Any biases or perspectives present

Text to analyze:
${text}`;
  
  // Call appropriate LLM API based on provider
  switch (settings.provider) {
    case 'openai':
      return await callOpenAI(prompt, settings.model, settings.apiKey);
    case 'anthropic':
      return await callClaude(prompt, settings.model, settings.apiKey);
    case 'google':
      return await callGemini(prompt, settings.model, settings.apiKey);
    default:
      throw new Error(`Unsupported provider: ${settings.provider}`);
  }
}

/**
 * Call OpenAI API
 * @param {string} prompt - The prompt to send to the API
 * @param {string} model - The model to use
 * @param {string} apiKey - The API key
 * @returns {Promise<string>} - The response text
 */
async function callOpenAI(prompt, model, apiKey) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
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
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API error');
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error(`OpenAI API error: ${error.message}`);
  }
}

/**
 * Call Claude API
 * @param {string} prompt - The prompt to send to the API
 * @param {string} model - The model to use
 * @param {string} apiKey - The API key
 * @returns {Promise<string>} - The response text
 */
async function callClaude(prompt, model, apiKey) {
  try {
    // Map model names to actual Claude model identifiers
    const modelMap = {
      'claude-3-opus': 'claude-3-opus-20240229',
      'claude-3-sonnet': 'claude-3-sonnet-20240229',
      'claude-3-haiku': 'claude-3-haiku-20240307'
    };
    
    const claudeModel = modelMap[model] || 'claude-3-sonnet-20240229';
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: claudeModel,
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Claude API error');
    }
    
    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('Claude API error:', error);
    throw new Error(`Claude API error: ${error.message}`);
  }
}

/**
 * Call Gemini API
 * @param {string} prompt - The prompt to send to the API
 * @param {string} model - The model to use
 * @param {string} apiKey - The API key
 * @returns {Promise<string>} - The response text
 */
async function callGemini(prompt, model, apiKey) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
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
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Gemini API error');
    }
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error(`Gemini API error: ${error.message}`);
  }
}
