/**
 * Token Counter Utility
 * Provides functions to count tokens for different LLM providers
 */

const tiktoken = require('js-tiktoken');

// Cache for encoders to avoid recreating them
const encoderCache = {};

/**
 * Count tokens for OpenAI models
 * @param {string} text - The text to count tokens for
 * @param {string} model - The model name
 * @returns {number} - The token count
 */
function countOpenAITokens(text, model) {
  try {
    // Ensure text is a string
    if (text === undefined || text === null) {
      console.warn('Received undefined or null text in countOpenAITokens');
      return 0;
    }
    
    // Convert to string if not already
    const textStr = String(text);
    
    // Determine encoding based on model
    let encodingName = 'cl100k_base'; // Default for newer models
    
    if (model && model.includes('gpt-3.5-turbo')) {
      encodingName = 'cl100k_base';
    } else if (model && model.includes('gpt-4')) {
      encodingName = 'cl100k_base';
    } else if (model && model.includes('text-davinci')) {
      encodingName = 'p50k_base';
    }
    
    // Get or create encoder
    if (!encoderCache[encodingName]) {
      try {
        encoderCache[encodingName] = tiktoken.getEncoding(encodingName);
      } catch (encError) {
        console.warn(`Failed to get encoding ${encodingName}, falling back to approximation`, encError);
        return approximateTokenCount(textStr);
      }
    }
    
    const encoder = encoderCache[encodingName];
    const tokens = encoder.encode(textStr);
    
    return tokens.length;
  } catch (error) {
    console.error('Error counting OpenAI tokens:', error);
    // Fallback to approximate count
    return approximateTokenCount(text);
  }
}

/**
 * Count tokens for Claude models (approximation)
 * @param {string} text - The text to count tokens for
 * @returns {number} - The approximate token count
 */
function countClaudeTokens(text) {
  // Claude uses a similar tokenizer to GPT models
  // This is an approximation
  try {
    // Ensure text is a string
    if (text === undefined || text === null) {
      console.warn('Received undefined or null text in countClaudeTokens');
      return 0;
    }
    
    // Convert to string if not already
    const textStr = String(text);
    
    if (!encoderCache['cl100k_base']) {
      try {
        encoderCache['cl100k_base'] = tiktoken.getEncoding('cl100k_base');
      } catch (encError) {
        console.warn('Failed to get encoding for Claude tokens, falling back to approximation', encError);
        return approximateTokenCount(textStr);
      }
    }
    
    const encoder = encoderCache['cl100k_base'];
    const tokens = encoder.encode(textStr);
    
    return tokens.length;
  } catch (error) {
    console.error('Error counting Claude tokens:', error);
    return approximateTokenCount(text);
  }
}

/**
 * Count tokens for Gemini models (approximation)
 * @param {string} text - The text to count tokens for
 * @returns {number} - The approximate token count
 */
function countGeminiTokens(text) {
  // Gemini uses a different tokenizer, but this is a reasonable approximation
  try {
    // Ensure text is a string
    if (text === undefined || text === null) {
      console.warn('Received undefined or null text in countGeminiTokens');
      return 0;
    }
    
    // Convert to string if not already
    const textStr = String(text);
    
    if (!encoderCache['cl100k_base']) {
      try {
        encoderCache['cl100k_base'] = tiktoken.getEncoding('cl100k_base');
      } catch (encError) {
        console.warn('Failed to get encoding for Gemini tokens, falling back to approximation', encError);
        return approximateTokenCount(textStr);
      }
    }
    
    const encoder = encoderCache['cl100k_base'];
    const tokens = encoder.encode(textStr);
    
    return tokens.length;
  } catch (error) {
    console.error('Error counting Gemini tokens:', error);
    return approximateTokenCount(text);
  }
}

/**
 * Approximate token count based on word count
 * @param {string} text - The text to count tokens for
 * @returns {number} - The approximate token count
 */
function approximateTokenCount(text) {
  // Ensure text is a string
  if (text === undefined || text === null) {
    console.warn('Received undefined or null text in approximateTokenCount');
    return 0;
  }
  
  // Convert to string if not already
  const textStr = String(text);
  
  // A very rough approximation: ~1.3 tokens per word
  const words = textStr.split(/\s+/).length;
  return Math.ceil(words * 1.3);
}

/**
 * Count tokens based on provider
 * @param {string} text - The text to count tokens for
 * @param {string} provider - The provider (openai, anthropic, google)
 * @param {string} model - The model name
 * @returns {number} - The token count
 */
function countTokens(text, provider, model) {
  switch (provider) {
    case 'openai':
      return countOpenAITokens(text, model);
    case 'anthropic':
      return countClaudeTokens(text);
    case 'google':
      return countGeminiTokens(text);
    default:
      return approximateTokenCount(text);
  }
}

module.exports = {
  countTokens,
  countOpenAITokens,
  countClaudeTokens,
  countGeminiTokens,
  approximateTokenCount
};
