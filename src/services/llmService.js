/**
 * LLM Service
 * Handles interactions with various LLM providers
 */

const axios = require('axios');

/**
 * Process text with LLM based on user preferences
 * @param {string} text - The text to process
 * @param {string} readingLevel - The target reading level
 * @param {string} language - The target language
 * @param {string} style - The target writing style
 * @param {string} model - The LLM model to use
 * @param {boolean} stream - Whether to stream the response
 * @param {function} onChunk - Callback for streaming chunks
 * @returns {Promise<string>} - The processed text (if not streaming)
 */
exports.processText = async (text, readingLevel, language, style, model, stream = false, onChunk = null) => {
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
  
  // Determine provider based on model
  let provider = '';
  if (model.startsWith('gpt-')) {
    provider = 'openai';
  } else if (model.startsWith('claude-')) {
    provider = 'anthropic';
  } else if (model.startsWith('gemini-')) {
    provider = 'google';
  } else {
    throw new Error(`Could not determine provider for model: ${model}`);
  }
  
  // Call appropriate LLM API based on provider
  let processedText;
  
  switch (provider) {
    case 'openai':
      processedText = await callOpenAI(prompt, model, stream, onChunk);
      break;
    case 'anthropic':
      processedText = await callClaude(prompt, model, stream, onChunk);
      break;
    case 'google':
      processedText = await callGemini(prompt, model, stream, onChunk);
      break;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
  
  return processedText;
};

/**
 * Get assessment of text from LLM
 * @param {string} text - The text to assess
 * @param {string} model - The LLM model to use
 * @returns {Promise<string>} - The assessment
 */
exports.assessText = async (text, model) => {
  const prompt = `Please analyze the following text and provide a brief assessment of:
1. Main topic and key points
2. Reading difficulty level
3. Technical terminology used
4. Any biases or perspectives present

Text to analyze:
${text}`;
  
  // Determine provider based on model
  let provider = '';
  if (model.startsWith('gpt-')) {
    provider = 'openai';
  } else if (model.startsWith('claude-')) {
    provider = 'anthropic';
  } else if (model.startsWith('gemini-')) {
    provider = 'google';
  } else {
    throw new Error(`Could not determine provider for model: ${model}`);
  }
  
  // Call appropriate LLM API based on provider
  let assessment;
  
  switch (provider) {
    case 'openai':
      assessment = await callOpenAI(prompt, model);
      break;
    case 'anthropic':
      assessment = await callClaude(prompt, model);
      break;
    case 'google':
      assessment = await callGemini(prompt, model);
      break;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
  
  return assessment;
};

/**
 * Call OpenAI API
 * @param {string} prompt - The prompt to send to the API
 * @param {string} model - The model to use
 * @param {boolean} stream - Whether to stream the response
 * @param {function} onChunk - Callback for streaming chunks
 * @returns {Promise<string>} - The response text (if not streaming)
 */
async function callOpenAI(prompt, model, stream = false, onChunk = null) {
  try {
    const requestBody = {
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
      stream: stream
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    };
    
    if (stream && onChunk) {
      // For streaming responses
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        requestBody,
        {
          headers,
          responseType: 'stream'
        }
      );
      
      let fullText = '';
      
      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
        for (const line of lines) {
          if (line.includes('[DONE]')) return;
          
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.substring(5));
              if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                const content = data.choices[0].delta.content;
                fullText += content;
                onChunk(content);
              }
            } catch (e) {
              console.error('Error parsing streaming data:', e);
            }
          }
        }
      });
      
      return new Promise((resolve) => {
        response.data.on('end', () => {
          resolve(fullText);
        });
      });
    } else {
      // For non-streaming responses
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        requestBody,
        { headers }
      );
      
      return response.data.choices[0].message.content;
    }
  } catch (error) {
    console.error('OpenAI API error:', error.response?.data || error.message);
    throw new Error(`OpenAI API error: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Call Claude API
 * @param {string} prompt - The prompt to send to the API
 * @param {string} model - The model to use
 * @param {boolean} stream - Whether to stream the response
 * @param {function} onChunk - Callback for streaming chunks
 * @returns {Promise<string>} - The response text (if not streaming)
 */
async function callClaude(prompt, model = 'claude-3-sonnet-20240229', stream = false, onChunk = null) {
  try {
    // Map model names to actual Claude model identifiers
    const modelMap = {
      'claude-3-opus': 'claude-3-opus-20240229',
      'claude-3-sonnet': 'claude-3-sonnet-20240229',
      'claude-3-haiku': 'claude-3-haiku-20240307'
    };
    
    const claudeModel = modelMap[model] || 'claude-3-sonnet-20240229';
    
    const requestBody = {
      model: claudeModel,
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      stream: stream
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': process.env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    };
    
    if (stream && onChunk) {
      // For streaming responses
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        requestBody,
        {
          headers,
          responseType: 'stream'
        }
      );
      
      let fullText = '';
      
      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.substring(5));
              if (data.type === 'content_block_delta' && data.delta && data.delta.text) {
                const content = data.delta.text;
                fullText += content;
                onChunk(content);
              }
            } catch (e) {
              console.error('Error parsing streaming data:', e);
            }
          }
        }
      });
      
      return new Promise((resolve) => {
        response.data.on('end', () => {
          resolve(fullText);
        });
      });
    } else {
      // For non-streaming responses
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        requestBody,
        { headers }
      );
      
      return response.data.content[0].text;
    }
  } catch (error) {
    console.error('Claude API error:', error.response?.data || error.message);
    throw new Error(`Claude API error: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Call Gemini API
 * @param {string} prompt - The prompt to send to the API
 * @param {string} model - The model to use
 * @param {boolean} stream - Whether to stream the response
 * @param {function} onChunk - Callback for streaming chunks
 * @returns {Promise<string>} - The response text (if not streaming)
 */
async function callGemini(prompt, model = 'gemini-pro', stream = false, onChunk = null) {
  try {
    const requestBody = {
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
    };
    
    if (stream && onChunk) {
      // For streaming responses
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:streamGenerateContent?key=${process.env.GEMINI_API_KEY}`,
        requestBody,
        {
          responseType: 'stream'
        }
      );
      
      let fullText = '';
      
      response.data.on('data', (chunk) => {
        try {
          const data = JSON.parse(chunk.toString());
          if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
            const content = data.candidates[0].content.parts[0].text;
            fullText += content;
            onChunk(content);
          }
        } catch (e) {
          console.error('Error parsing streaming data:', e);
        }
      });
      
      return new Promise((resolve) => {
        response.data.on('end', () => {
          resolve(fullText);
        });
      });
    } else {
      // For non-streaming responses
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
        requestBody
      );
      
      return response.data.candidates[0].content.parts[0].text;
    }
  } catch (error) {
    console.error('Gemini API error:', error.response?.data || error.message);
    throw new Error(`Gemini API error: ${error.response?.data?.error?.message || error.message}`);
  }
}
