/**
 * LLM Service
 * Handles interactions with various LLM providers
 */

const axios = require('axios');
const { countTokens } = require('../utils/tokenCounter');

// Store the timestamp of the last prompt for each session
const lastPromptTimestamps = new Map();

/**
 * Calculate lexical density of text
 * @param {string} text - The text to analyze
 * @returns {number} - The lexical density percentage
 */
function calculateLexicalDensity(text) {
  // Remove punctuation and convert to lowercase
  const cleanText = text.replace(/[^\w\s]/g, '').toLowerCase();
  
  // Split into words
  const words = cleanText.split(/\s+/).filter(word => word.length > 0);
  
  // Count total words
  const totalWords = words.length;
  
  // Define function words (common non-lexical words)
  const functionWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'when',
    'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through',
    'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down',
    'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any',
    'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
    'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'can', 'will', 'just', 'should', 'now', 'of', 'as', 'be', 'is', 'are',
    'was', 'were', 'am', 'been', 'being', 'have', 'has', 'had', 'having',
    'do', 'does', 'did', 'doing', 'would', 'could', 'should', 'might', 'must',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs'
  ]);
  
  // Count lexical words (non-function words)
  const lexicalWords = words.filter(word => !functionWords.has(word));
  const lexicalWordCount = lexicalWords.length;
  
  // Calculate lexical density
  return totalWords > 0 ? Math.round((lexicalWordCount / totalWords) * 100) : 0;
}

/**
 * Identify speech acts in text
 * @param {string} text - The text to analyze
 * @returns {Array<string>} - Array of identified speech acts
 */
function identifySpeechActs(text) {
  const speechActs = [];
  
  // Define patterns for different speech acts
  const patterns = [
    { act: 'Question', regex: /\?|what|who|when|where|why|how|could you|can you|would you/i },
    { act: 'Command/Request', regex: /please|kindly|would you|could you|can you|must|should|shall|do this|try to/i },
    { act: 'Statement/Assertion', regex: /is|are|was|were|will be|has been|have been|there is|there are/i },
    { act: 'Promise/Commitment', regex: /will|shall|going to|promise|commit|guarantee|ensure|pledge|vow/i },
    { act: 'Expression/Exclamation', regex: /!|wow|oh|ah|ouch|great|excellent|amazing|wonderful|terrible|awful/i },
    { act: 'Declaration', regex: /hereby|pronounce|declare|announce|proclaim/i }
  ];
  
  // Check for each speech act pattern
  for (const pattern of patterns) {
    if (pattern.regex.test(text)) {
      speechActs.push(pattern.act);
    }
  }
  
  // If no speech acts identified, default to Statement
  if (speechActs.length === 0) {
    speechActs.push('Statement');
  }
  
  return [...new Set(speechActs)]; // Remove duplicates
}

/**
 * Process text with LLM based on user preferences
 * @param {string} text - The text to process
 * @param {string} readingLevel - The target reading level
 * @param {string} language - The target language
 * @param {string} style - The target writing style
 * @param {string} model - The LLM model to use
 * @param {boolean} stream - Whether to stream the response
 * @param {function} onChunk - Callback for streaming chunks
 * @param {string} sessionId - Unique identifier for the session
 * @returns {Promise<Object>} - The processed text and metrics
 */
exports.processText = async (text, readingLevel, language, style, model, stream = false, onChunk = null, sessionId = 'default') => {
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
  let originalModel = model;
  
  if (model.startsWith('gpt-')) {
    provider = 'openai';
  } else if (model.startsWith('claude-')) {
    provider = 'anthropic';
  } else if (model.startsWith('gemini-')) {
    // Check if Gemini API key is properly set
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      console.warn('Gemini API key not set. Falling back to OpenAI GPT-3.5-turbo.');
      provider = 'openai';
      model = 'gpt-3.5-turbo'; // Fall back to GPT-3.5-turbo
    } else {
      provider = 'google';
    }
  } else if (model.startsWith('deepseek-')) {
    // Check if Deepseek API key is properly set
    if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'your_deepseek_api_key_here') {
      console.warn('Deepseek API key not set. Falling back to OpenAI GPT-3.5-turbo.');
      provider = 'openai';
      model = 'gpt-3.5-turbo'; // Fall back to GPT-3.5-turbo
    } else {
      provider = 'deepseek';
    }
  } else {
    throw new Error(`Could not determine provider for model: ${model}`);
  }
  
  // Calculate inter-prompt latency
  const currentTime = Date.now();
  const lastPromptTime = lastPromptTimestamps.get(sessionId);
  const interPromptLatency = lastPromptTime ? currentTime - lastPromptTime : 0;
  
  // Update last prompt timestamp
  lastPromptTimestamps.set(sessionId, currentTime);
  
  // Count tokens in prompt
  const promptTokens = countTokens(prompt, provider, model);
  
  // Call appropriate LLM API based on provider
  let processedText;
  let completionTokens = 0;
  
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
    case 'deepseek':
      processedText = await callDeepseek(prompt, model, stream, onChunk);
      break;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
  
  // Count tokens in completion
  if (typeof processedText === 'string') {
    completionTokens = countTokens(processedText, provider, model);
  }
  
  // Calculate lexical density for both original and processed text
  const originalLexicalDensity = calculateLexicalDensity(text);
  const processedLexicalDensity = calculateLexicalDensity(processedText);
  
  // Identify speech acts in both original and processed text
  const originalSpeechActs = identifySpeechActs(text);
  const processedSpeechActs = identifySpeechActs(processedText);
  
  // Return processed text and metrics
  return {
    processedText,
    metrics: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      interPromptLatency,
      originalLexicalDensity,
      processedLexicalDensity,
      originalSpeechActs,
      processedSpeechActs
    }
  };
};

/**
 * Process chat message with LLM
 * @param {string} message - The user's message
 * @param {Array} conversation - The conversation history
 * @param {string} model - The LLM model to use
 * @param {string} provider - The LLM provider to use
 * @param {string} sessionId - Unique identifier for the session
 * @param {boolean} stream - Whether to stream the response
 * @param {function} onChunk - Callback for streaming chunks
 * @param {string} readingLevel - The target reading level
 * @param {string} language - The target language
 * @param {string} style - The target writing style
 * @returns {Promise<Object>} - The response message and metrics
 */
exports.processChat = async (message, conversation, model, provider, sessionId = 'default', stream = false, onChunk = null, readingLevel = 'original', language = 'original', style = 'original') => {
  // Determine provider based on model if not explicitly provided
  if (!provider) {
    let originalModel = model;
    
    if (model.startsWith('gpt-')) {
      provider = 'openai';
    } else if (model.startsWith('claude-')) {
      provider = 'anthropic';
    } else if (model.startsWith('gemini-')) {
      // Check if Gemini API key is properly set
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
        console.warn('Gemini API key not set. Falling back to OpenAI GPT-3.5-turbo.');
        provider = 'openai';
        model = 'gpt-3.5-turbo'; // Fall back to GPT-3.5-turbo
      } else {
        provider = 'google';
      }
    } else if (model.startsWith('deepseek-')) {
      // Check if Deepseek API key is properly set
      if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'your_deepseek_api_key_here') {
        console.warn('Deepseek API key not set. Falling back to OpenAI GPT-3.5-turbo.');
        provider = 'openai';
        model = 'gpt-3.5-turbo'; // Fall back to GPT-3.5-turbo
      } else {
        provider = 'deepseek';
      }
    } else {
      throw new Error(`Could not determine provider for model: ${model}`);
    }
  }
  
  // Add system message with preferences if any are specified
  let systemMessage = 'You are a helpful assistant.';
  
  if (readingLevel !== 'original' || language !== 'original' || style !== 'original') {
    systemMessage = 'You are a helpful assistant. ';
    
    if (readingLevel !== 'original') {
      systemMessage += `Please respond at a ${readingLevel} reading level. `;
    }
    
    if (language !== 'original') {
      systemMessage += `Please respond in ${language}. `;
    }
    
    if (style !== 'original') {
      systemMessage += `Please use a ${style} writing style. `;
    }
  }
  
  // Calculate inter-prompt latency
  const currentTime = Date.now();
  const lastPromptTime = lastPromptTimestamps.get(sessionId);
  const interPromptLatency = lastPromptTime ? currentTime - lastPromptTime : 0;
  
  // Update last prompt timestamp
  lastPromptTimestamps.set(sessionId, currentTime);
  
  // Format conversation for the LLM API
  let formattedConversation;
  let promptTokens = 0;
  
  // Call appropriate LLM API based on provider
  let responseMessage;
  let completionTokens = 0;
  
  switch (provider) {
    case 'openai':
      // Format conversation for OpenAI
      formattedConversation = conversation.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // Add system message if not present
      if (!formattedConversation.some(msg => msg.role === 'system')) {
        formattedConversation.unshift({
          role: 'system',
          content: systemMessage
        });
      }
      
      // Count tokens in prompt
      promptTokens = countTokens(JSON.stringify(formattedConversation), provider, model);
      
      // Call OpenAI API with streaming if requested
      if (stream && onChunk) {
        responseMessage = await callOpenAIChatAPI(formattedConversation, model, true, onChunk);
      } else {
        responseMessage = await callOpenAIChatAPI(formattedConversation, model);
      }
      break;
      
    case 'anthropic':
      // Format conversation for Claude
      formattedConversation = conversation.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));
      
      // Count tokens in prompt
      promptTokens = countTokens(JSON.stringify(formattedConversation), provider, model);
      
      // Call Claude API with streaming if requested
      if (stream && onChunk) {
        responseMessage = await callClaudeChatAPI(formattedConversation, model, true, onChunk);
      } else {
        responseMessage = await callClaudeChatAPI(formattedConversation, model);
      }
      break;
      
    case 'google':
      // Format conversation for Gemini
      formattedConversation = conversation.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }));
      
      // Count tokens in prompt
      promptTokens = countTokens(JSON.stringify(formattedConversation), provider, model);
      
      // Call Gemini API with streaming if requested
      if (stream && onChunk) {
        responseMessage = await callGeminiChatAPI(formattedConversation, model, true, onChunk);
      } else {
        responseMessage = await callGeminiChatAPI(formattedConversation, model);
      }
      break;
      
    case 'deepseek':
      // Format conversation for Deepseek (similar to OpenAI format)
      formattedConversation = conversation.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // Add system message if not present
      if (!formattedConversation.some(msg => msg.role === 'system')) {
        formattedConversation.unshift({
          role: 'system',
          content: systemMessage
        });
      }
      
      // Count tokens in prompt
      promptTokens = countTokens(JSON.stringify(formattedConversation), provider, model);
      
      // Call Deepseek API with streaming if requested
      if (stream && onChunk) {
        responseMessage = await callDeepseekChatAPI(formattedConversation, model, true, onChunk);
      } else {
        responseMessage = await callDeepseekChatAPI(formattedConversation, model);
      }
      break;
      
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
  
  // Count tokens in completion
  if (typeof responseMessage === 'string') {
    completionTokens = countTokens(responseMessage, provider, model);
  }
  
  // Return response and metrics
  return {
    message: responseMessage,
    metrics: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      interPromptLatency
    }
  };
};

/**
 * Get assessment of text from LLM
 * @param {string} text - The text to assess
 * @param {string} model - The LLM model to use
 * @param {string} sessionId - Unique identifier for the session
 * @returns {Promise<Object>} - The assessment and metrics
 */
exports.assessText = async (text, model, sessionId = 'default') => {
  const prompt = `Please analyze the following text and provide a brief assessment of:
1. Main topic and key points
2. Reading difficulty level
3. Technical terminology used
4. Any biases or perspectives present

Text to analyze:
${text}`;
  
  // Determine provider based on model
  let provider = '';
  let originalModel = model;
  
  if (model.startsWith('gpt-')) {
    provider = 'openai';
  } else if (model.startsWith('claude-')) {
    provider = 'anthropic';
  } else if (model.startsWith('gemini-')) {
    // Check if Gemini API key is properly set
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      console.warn('Gemini API key not set. Falling back to OpenAI GPT-3.5-turbo.');
      provider = 'openai';
      model = 'gpt-3.5-turbo'; // Fall back to GPT-3.5-turbo
    } else {
      provider = 'google';
    }
  } else if (model.startsWith('deepseek-')) {
    // Check if Deepseek API key is properly set
    if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'your_deepseek_api_key_here') {
      console.warn('Deepseek API key not set. Falling back to OpenAI GPT-3.5-turbo.');
      provider = 'openai';
      model = 'gpt-3.5-turbo'; // Fall back to GPT-3.5-turbo
    } else {
      provider = 'deepseek';
    }
  } else {
    throw new Error(`Could not determine provider for model: ${model}`);
  }
  
  // Calculate inter-prompt latency
  const currentTime = Date.now();
  const lastPromptTime = lastPromptTimestamps.get(sessionId);
  const interPromptLatency = lastPromptTime ? currentTime - lastPromptTime : 0;
  
  // Update last prompt timestamp
  lastPromptTimestamps.set(sessionId, currentTime);
  
  // Count tokens in prompt
  const promptTokens = countTokens(prompt, provider, model);
  
  // Call appropriate LLM API based on provider
  let assessment;
  let completionTokens = 0;
  
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
    case 'deepseek':
      assessment = await callDeepseek(prompt, model);
      break;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
  
  // Count tokens in completion
  if (typeof assessment === 'string') {
    completionTokens = countTokens(assessment, provider, model);
  }
  
  // Return assessment and metrics
  return {
    assessment,
    metrics: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      interPromptLatency
    }
  };
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
      
      // Buffer to accumulate incomplete JSON data
      let buffer = '';
      
      response.data.on('data', (chunk) => {
        // Add the new chunk to our buffer
        const chunkStr = chunk.toString();
        buffer += chunkStr;
        
        // Process complete lines from the buffer
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          // Extract a complete line
          const line = buffer.substring(0, newlineIndex).trim();
          buffer = buffer.substring(newlineIndex + 1);
          
          // Skip empty lines
          if (!line) continue;
          
          // Check for end of stream
          if (line.includes('[DONE]')) return;
          
          // Process data lines
          if (line.startsWith('data:')) {
            try {
              // Extract the JSON part
              const jsonStr = line.substring(5).trim();
              if (!jsonStr || jsonStr === '') continue;
              
              // Try to parse the JSON
              const data = JSON.parse(jsonStr);
              
              // Extract content if available
              if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                const content = data.choices[0].delta.content;
                fullText += content;
                onChunk(content);
              }
            } catch (e) {
              // Log the error but don't throw - we'll try again with more data
              console.error('Error parsing streaming data:', e.message);
              // Don't add the problematic line back to the buffer
              continue;
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
      
      // Buffer to accumulate incomplete JSON data
      let buffer = '';
      
      response.data.on('data', (chunk) => {
        // Add the new chunk to our buffer
        const chunkStr = chunk.toString();
        buffer += chunkStr;
        
        // Process complete lines from the buffer
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          // Extract a complete line
          const line = buffer.substring(0, newlineIndex).trim();
          buffer = buffer.substring(newlineIndex + 1);
          
          // Skip empty lines
          if (!line) continue;
          
          // Process data lines
          if (line.startsWith('data:')) {
            try {
              // Extract the JSON part
              const jsonStr = line.substring(5).trim();
              if (!jsonStr || jsonStr === '') continue;
              
              // Try to parse the JSON
              const data = JSON.parse(jsonStr);
              
              // Extract content if available
              if (data.type === 'content_block_delta' && data.delta && data.delta.text) {
                const content = data.delta.text;
                fullText += content;
                onChunk(content);
              }
            } catch (e) {
              // Log the error but don't throw - we'll try again with more data
              console.error('Error parsing streaming data:', e.message);
              // Don't add the problematic line back to the buffer
              continue;
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
 * Call OpenAI Chat API
 * @param {Array} conversation - The conversation history
 * @param {string} model - The model to use
 * @param {boolean} stream - Whether to stream the response
 * @param {function} onChunk - Callback for streaming chunks
 * @returns {Promise<string>} - The response text
 */
async function callOpenAIChatAPI(conversation, model, stream = false, onChunk = null) {
  try {
    const requestBody = {
      model: model,
      messages: conversation,
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
      
      // Buffer to accumulate incomplete JSON data
      let buffer = '';
      
      response.data.on('data', (chunk) => {
        // Add the new chunk to our buffer
        const chunkStr = chunk.toString();
        buffer += chunkStr;
        
        // Process complete lines from the buffer
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          // Extract a complete line
          const line = buffer.substring(0, newlineIndex).trim();
          buffer = buffer.substring(newlineIndex + 1);
          
          // Skip empty lines
          if (!line) continue;
          
          // Check for end of stream
          if (line.includes('[DONE]')) return;
          
          // Process data lines
          if (line.startsWith('data:')) {
            try {
              // Extract the JSON part
              const jsonStr = line.substring(5).trim();
              if (!jsonStr || jsonStr === '') continue;
              
              // Try to parse the JSON
              const data = JSON.parse(jsonStr);
              
              // Extract content if available
              if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                const content = data.choices[0].delta.content;
                fullText += content;
                onChunk(content);
              }
            } catch (e) {
              // Log the error but don't throw - we'll try again with more data
              console.error('Error parsing streaming data:', e.message);
              // Don't add the problematic line back to the buffer
              continue;
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
    console.error('OpenAI Chat API error:', error.response?.data || error.message);
    throw new Error(`OpenAI Chat API error: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Call Claude Chat API
 * @param {Array} conversation - The conversation history
 * @param {string} model - The model to use
 * @param {boolean} stream - Whether to stream the response
 * @param {function} onChunk - Callback for streaming chunks
 * @returns {Promise<string>} - The response text
 */
async function callClaudeChatAPI(conversation, model, stream = false, onChunk = null) {
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
      messages: conversation,
      stream: stream
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': process.env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    };
    
    if (stream && onChunk) {
      // For streaming responses
      try {
        const response = await axios.post(
          'https://api.anthropic.com/v1/messages',
          requestBody,
          {
            headers,
            responseType: 'stream'
          }
        );
        
        let fullText = '';
        
        // Buffer to accumulate incomplete JSON data
        let buffer = '';
        
        response.data.on('data', (chunk) => {
          // Add the new chunk to our buffer
          const chunkStr = chunk.toString();
          buffer += chunkStr;
          
          // Process complete lines from the buffer
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            // Extract a complete line
            const line = buffer.substring(0, newlineIndex).trim();
            buffer = buffer.substring(newlineIndex + 1);
            
            // Skip empty lines
            if (!line) continue;
            
            // Process data lines
            if (line.startsWith('data:')) {
              try {
                // Extract the JSON part
                const jsonStr = line.substring(5).trim();
                if (!jsonStr || jsonStr === '') continue;
                
                // Try to parse the JSON
                const data = JSON.parse(jsonStr);
                
                // Extract content if available
                if (data.type === 'content_block_delta' && data.delta && data.delta.text) {
                  const content = data.delta.text;
                  fullText += content;
                  onChunk(content);
                }
              } catch (e) {
                // Log the error but don't throw - we'll try again with more data
                console.error('Error parsing streaming data:', e.message);
                // Don't add the problematic line back to the buffer
                continue;
              }
            }
          }
        });
        
        return new Promise((resolve) => {
          response.data.on('end', () => {
            resolve(fullText);
          });
        });
      } catch (streamError) {
        // Handle rate limiting specifically for streaming
        if (streamError.response && streamError.response.status === 429) {
          const retryAfter = streamError.response.headers['retry-after'] || 60;
          const errorMessage = `Claude API rate limit exceeded. Please try again in ${retryAfter} seconds.`;
          console.warn('Claude API rate limit error:', errorMessage);
          
          // Send a special message to the client about rate limiting
          if (onChunk) {
            onChunk(`\n\n[ERROR: ${errorMessage}]`);
          }
          
          // Return a graceful error message instead of throwing
          return `I apologize, but I've encountered a rate limit with the Claude API. Please try again in a moment.`;
        }
        
        // For other errors, re-throw
        throw streamError;
      }
    } else {
      // For non-streaming responses
      try {
        const response = await axios.post(
          'https://api.anthropic.com/v1/messages',
          requestBody,
          { headers }
        );
        
        return response.data.content[0].text;
      } catch (nonStreamError) {
        // Handle rate limiting for non-streaming requests
        if (nonStreamError.response && nonStreamError.response.status === 429) {
          const retryAfter = nonStreamError.response.headers['retry-after'] || 60;
          console.warn(`Claude API rate limit exceeded. Please try again in ${retryAfter} seconds.`);
          return `I apologize, but I've encountered a rate limit with the Claude API. Please try again in a moment.`;
        }
        
        // For other errors, re-throw
        throw nonStreamError;
      }
    }
  } catch (error) {
    console.error('Claude Chat API error:', error.response?.data || error.message);
    throw new Error(`Claude Chat API error: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Call Gemini Chat API
 * @param {Array} conversation - The conversation history
 * @param {string} model - The model to use
 * @param {boolean} stream - Whether to stream the response
 * @param {function} onChunk - Callback for streaming chunks
 * @returns {Promise<string>} - The response text
 */
async function callGeminiChatAPI(conversation, model, stream = false, onChunk = null) {
  try {
    const requestBody = {
      contents: conversation,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000
      }
    };
    
    if (stream && onChunk) {
      // For streaming responses
      try {
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${process.env.GEMINI_API_KEY}`,
          requestBody,
          {
            responseType: 'stream'
          }
        );
        
        let fullText = '';
        
        // Buffer to accumulate incomplete JSON data
        let buffer = '';
        
        response.data.on('data', (chunk) => {
          // Add the new chunk to our buffer
          const chunkStr = chunk.toString();
          buffer += chunkStr;
          
          // For Gemini, we need to handle the case where each chunk might be a complete JSON object
          // Try to parse the buffer as a complete JSON object first
          try {
            if (buffer.trim()) {
              const data = JSON.parse(buffer);
              if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
                const content = data.candidates[0].content.parts[0].text;
                fullText += content;
                onChunk(content);
              }
              // Clear the buffer after successful parsing
              buffer = '';
            }
          } catch (e) {
            // If parsing as a complete object fails, try to find complete JSON objects in the buffer
            // This is a simplified approach - in a real implementation, you might need more sophisticated JSON parsing
            try {
              // Look for a complete JSON object with matching braces
              let openBraces = 0;
              let startPos = -1;
              let endPos = -1;
              
              for (let i = 0; i < buffer.length; i++) {
                if (buffer[i] === '{') {
                  if (openBraces === 0) {
                    startPos = i;
                  }
                  openBraces++;
                } else if (buffer[i] === '}') {
                  openBraces--;
                  if (openBraces === 0 && startPos !== -1) {
                    endPos = i + 1;
                    const jsonStr = buffer.substring(startPos, endPos);
                    try {
                      const data = JSON.parse(jsonStr);
                      if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
                        const content = data.candidates[0].content.parts[0].text;
                        fullText += content;
                        onChunk(content);
                      }
                    } catch (innerError) {
                      // If parsing fails, just continue
                      console.error('Error parsing JSON object:', innerError.message);
                    }
                    // Remove the processed part from the buffer
                    buffer = buffer.substring(endPos);
                    // Reset for next object
                    startPos = -1;
                    endPos = -1;
                    i = -1; // Start over with the new buffer
                  }
                }
              }
            } catch (outerError) {
              // If the more sophisticated parsing fails, just keep the buffer for the next chunk
              console.error('Error processing buffer:', outerError.message);
            }
          }
        });
        
        return new Promise((resolve) => {
          response.data.on('end', () => {
            resolve(fullText);
          });
        });
      } catch (streamError) {
        // Handle specific error codes
        if (streamError.response) {
          const status = streamError.response.status;
          let errorMessage = '';
          
          if (status === 404) {
            errorMessage = 'Gemini API endpoint not found. The model or API version may be incorrect.';
          } else if (status === 403) {
            errorMessage = 'Gemini API access forbidden. Please check your API key.';
          } else if (status === 429) {
            errorMessage = 'Gemini API rate limit exceeded. Please try again later.';
          } else {
            errorMessage = `Gemini API error (${status}): ${streamError.response.data?.error?.message || 'Unknown error'}`;
          }
          
          console.warn('Gemini API error:', errorMessage);
          
          // Send a special message to the client about the error
          if (onChunk) {
            onChunk(`\n\n[ERROR: ${errorMessage}]`);
          }
          
          // Return a graceful error message instead of throwing
          return `I apologize, but I've encountered an error with the Gemini API: ${errorMessage}`;
        }
        
        // For other errors, re-throw
        throw streamError;
      }
    } else {
      // For non-streaming responses
      try {
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
          requestBody
        );
        
        return response.data.candidates[0].content.parts[0].text;
      } catch (nonStreamError) {
        // Handle specific error codes
        if (nonStreamError.response) {
          const status = nonStreamError.response.status;
          let errorMessage = '';
          
          if (status === 404) {
            errorMessage = 'Gemini API endpoint not found. The model or API version may be incorrect.';
          } else if (status === 403) {
            errorMessage = 'Gemini API access forbidden. Please check your API key.';
          } else if (status === 429) {
            errorMessage = 'Gemini API rate limit exceeded. Please try again later.';
          } else {
            errorMessage = `Gemini API error (${status}): ${nonStreamError.response.data?.error?.message || 'Unknown error'}`;
          }
          
          console.warn('Gemini API error:', errorMessage);
          return `I apologize, but I've encountered an error with the Gemini API: ${errorMessage}`;
        }
        
        // For other errors, re-throw
        throw nonStreamError;
      }
    }
  } catch (error) {
    console.error('Gemini Chat API error:', error.response?.data || error.message);
    throw new Error(`Gemini Chat API error: ${error.response?.data?.error?.message || error.message}`);
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
      
      // Buffer to accumulate incomplete JSON data
      let buffer = '';
      
      response.data.on('data', (chunk) => {
        // Add the new chunk to our buffer
        const chunkStr = chunk.toString();
        buffer += chunkStr;
        
        // For Gemini, we need to handle the case where each chunk might be a complete JSON object
        // Try to parse the buffer as a complete JSON object first
        try {
          if (buffer.trim()) {
            const data = JSON.parse(buffer);
            if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
              const content = data.candidates[0].content.parts[0].text;
              fullText += content;
              onChunk(content);
            }
            // Clear the buffer after successful parsing
            buffer = '';
          }
        } catch (e) {
          // If parsing as a complete object fails, try to find complete JSON objects in the buffer
          // This is a simplified approach - in a real implementation, you might need more sophisticated JSON parsing
          try {
            // Look for a complete JSON object with matching braces
            let openBraces = 0;
            let startPos = -1;
            let endPos = -1;
            
            for (let i = 0; i < buffer.length; i++) {
              if (buffer[i] === '{') {
                if (openBraces === 0) {
                  startPos = i;
                }
                openBraces++;
              } else if (buffer[i] === '}') {
                openBraces--;
                if (openBraces === 0 && startPos !== -1) {
                  endPos = i + 1;
                  const jsonStr = buffer.substring(startPos, endPos);
                  try {
                    const data = JSON.parse(jsonStr);
                    if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
                      const content = data.candidates[0].content.parts[0].text;
                      fullText += content;
                      onChunk(content);
                    }
                  } catch (innerError) {
                    // If parsing fails, just continue
                    console.error('Error parsing JSON object:', innerError.message);
                  }
                  // Remove the processed part from the buffer
                  buffer = buffer.substring(endPos);
                  // Reset for next object
                  startPos = -1;
                  endPos = -1;
                  i = -1; // Start over with the new buffer
                }
              }
            }
          } catch (outerError) {
            // If the more sophisticated parsing fails, just keep the buffer for the next chunk
            console.error('Error processing buffer:', outerError.message);
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

/**
 * Call Deepseek API
 * @param {string} prompt - The prompt to send to the API
 * @param {string} model - The model to use
 * @param {boolean} stream - Whether to stream the response
 * @param {function} onChunk - Callback for streaming chunks
 * @returns {Promise<string>} - The response text (if not streaming)
 */
async function callDeepseek(prompt, model = 'deepseek-chat', stream = false, onChunk = null) {
  try {
    // Map model names to actual Deepseek model identifiers if needed
    const modelMap = {
      'deepseek-chat': 'deepseek-chat',
      'deepseek-coder': 'deepseek-coder',
      'deepseek-v3': 'deepseek-v3'
    };
    
    const deepseekModel = modelMap[model] || model;
    
    const requestBody = {
      model: deepseekModel,
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
      max_tokens: 1000,
      stream: stream
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    };
    
    if (stream && onChunk) {
      // For streaming responses
      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        requestBody,
        {
          headers,
          responseType: 'stream'
        }
      );
      
      let fullText = '';
      
      // Buffer to accumulate incomplete JSON data
      let buffer = '';
      
      response.data.on('data', (chunk) => {
        // Add the new chunk to our buffer
        const chunkStr = chunk.toString();
        buffer += chunkStr;
        
        // Process complete lines from the buffer
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          // Extract a complete line
          const line = buffer.substring(0, newlineIndex).trim();
          buffer = buffer.substring(newlineIndex + 1);
          
          // Skip empty lines
          if (!line) continue;
          
          // Check for end of stream
          if (line.includes('[DONE]')) return;
          
          // Process data lines
          if (line.startsWith('data:')) {
            try {
              // Extract the JSON part
              const jsonStr = line.substring(5).trim();
              if (!jsonStr || jsonStr === '') continue;
              
              // Try to parse the JSON
              const data = JSON.parse(jsonStr);
              
              // Extract content if available
              if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                const content = data.choices[0].delta.content;
                fullText += content;
                onChunk(content);
              }
            } catch (e) {
              // Log the error but don't throw - we'll try again with more data
              console.error('Error parsing streaming data:', e.message);
              // Don't add the problematic line back to the buffer
              continue;
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
        'https://api.deepseek.com/v1/chat/completions',
        requestBody,
        { headers }
      );
      
      return response.data.choices[0].message.content;
    }
  } catch (error) {
    console.error('Deepseek API error:', error.response?.data || error.message);
    throw new Error(`Deepseek API error: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Call Deepseek Chat API
 * @param {Array} conversation - The conversation history
 * @param {string} model - The model to use
 * @param {boolean} stream - Whether to stream the response
 * @param {function} onChunk - Callback for streaming chunks
 * @returns {Promise<string>} - The response text
 */
async function callDeepseekChatAPI(conversation, model = 'deepseek-chat', stream = false, onChunk = null) {
  try {
    // Map model names to actual Deepseek model identifiers if needed
    const modelMap = {
      'deepseek-chat': 'deepseek-chat',
      'deepseek-coder': 'deepseek-coder',
      'deepseek-v3': 'deepseek-v3'
    };
    
    const deepseekModel = modelMap[model] || model;
    
    const requestBody = {
      model: deepseekModel,
      messages: conversation,
      temperature: 0.7,
      max_tokens: 1000,
      stream: stream
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    };
    
    if (stream && onChunk) {
      // For streaming responses
      try {
        const response = await axios.post(
          'https://api.deepseek.com/v1/chat/completions',
          requestBody,
          {
            headers,
            responseType: 'stream'
          }
        );
        
        let fullText = '';
        
        // Buffer to accumulate incomplete JSON data
        let buffer = '';
        
        response.data.on('data', (chunk) => {
          // Add the new chunk to our buffer
          const chunkStr = chunk.toString();
          buffer += chunkStr;
          
          // Process complete lines from the buffer
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            // Extract a complete line
            const line = buffer.substring(0, newlineIndex).trim();
            buffer = buffer.substring(newlineIndex + 1);
            
            // Skip empty lines
            if (!line) continue;
            
            // Check for end of stream
            if (line.includes('[DONE]')) return;
            
            // Process data lines
            if (line.startsWith('data:')) {
              try {
                // Extract the JSON part
                const jsonStr = line.substring(5).trim();
                if (!jsonStr || jsonStr === '') continue;
                
                // Try to parse the JSON
                const data = JSON.parse(jsonStr);
                
                // Extract content if available
                if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                  const content = data.choices[0].delta.content;
                  fullText += content;
                  onChunk(content);
                }
              } catch (e) {
                // Log the error but don't throw - we'll try again with more data
                console.error('Error parsing streaming data:', e.message);
                // Don't add the problematic line back to the buffer
                continue;
              }
            }
          }
        });
        
        return new Promise((resolve) => {
          response.data.on('end', () => {
            resolve(fullText);
          });
        });
      } catch (streamError) {
        // Handle specific error codes
        if (streamError.response) {
          const status = streamError.response.status;
          let errorMessage = '';
          
          if (status === 402) {
            errorMessage = 'Deepseek API payment required. Please check your account balance.';
          } else if (status === 403) {
            errorMessage = 'Deepseek API access forbidden. Please check your API key.';
          } else if (status === 429) {
            errorMessage = 'Deepseek API rate limit exceeded. Please try again later.';
          } else {
            errorMessage = `Deepseek API error (${status}): ${streamError.response.data?.error?.message || 'Unknown error'}`;
          }
          
          console.warn('Deepseek API error:', errorMessage);
          
          // Send a special message to the client about the error
          if (onChunk) {
            onChunk(`\n\n[ERROR: ${errorMessage}]`);
          }
          
          // Return a graceful error message instead of throwing
          return `I apologize, but I've encountered an error with the Deepseek API: ${errorMessage}`;
        }
        
        // For other errors, re-throw
        throw streamError;
      }
    } else {
      // For non-streaming responses
      try {
        const response = await axios.post(
          'https://api.deepseek.com/v1/chat/completions',
          requestBody,
          { headers }
        );
        
        return response.data.choices[0].message.content;
      } catch (nonStreamError) {
        // Handle specific error codes
        if (nonStreamError.response) {
          const status = nonStreamError.response.status;
          let errorMessage = '';
          
          if (status === 402) {
            errorMessage = 'Deepseek API payment required. Please check your account balance.';
          } else if (status === 403) {
            errorMessage = 'Deepseek API access forbidden. Please check your API key.';
          } else if (status === 429) {
            errorMessage = 'Deepseek API rate limit exceeded. Please try again later.';
          } else {
            errorMessage = `Deepseek API error (${status}): ${nonStreamError.response.data?.error?.message || 'Unknown error'}`;
          }
          
          console.warn('Deepseek API error:', errorMessage);
          return `I apologize, but I've encountered an error with the Deepseek API: ${errorMessage}`;
        }
        
        // For other errors, re-throw
        throw nonStreamError;
      }
    }
  } catch (error) {
    console.error('Deepseek Chat API error:', error.response?.data || error.message);
    throw new Error(`Deepseek Chat API error: ${error.response?.data?.error?.message || error.message}`);
  }
}
