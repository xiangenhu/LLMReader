/**
 * LLM Controller
 * Handles requests for LLM processing and assessment
 */

const llmService = require('../services/llmService');

/**
 * Process text with LLM
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.processText = async (req, res) => {
  try {
    const { text, readingLevel, language, style, model, sessionId } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    // Process with LLM without streaming
    const result = await llmService.processText(
      text, 
      readingLevel, 
      language, 
      style, 
      model, 
      false, 
      null, 
      sessionId || `session-${Date.now()}`
    );
    
    res.json({ 
      processedText: result.processedText,
      promptTokens: result.metrics.promptTokens,
      completionTokens: result.metrics.completionTokens,
      totalTokens: result.metrics.totalTokens,
      interPromptLatency: result.metrics.interPromptLatency
    });
  } catch (error) {
    console.error('Error in processText controller:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Process text with LLM and stream the response
 * @param {Object} requestData - The request data
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.processTextStream = async (requestData, res) => {
  try {
    const { text, readingLevel, language, style, model, startTime, sessionId } = requestData;
    
    if (!text) {
      throw new Error('Text is required');
    }
    
    // Process with LLM with streaming
    let fullText = '';
    const onChunk = (chunk) => {
      try {
        res.write(`event: chunk\ndata: ${JSON.stringify({ text: chunk })}\n\n`);
      } catch (e) {
        console.error('Error writing chunk:', e);
      }
    };
    
    const result = await llmService.processText(
      text, 
      readingLevel, 
      language, 
      style, 
      model, 
      true, 
      onChunk, 
      sessionId || `session-${Date.now()}`
    );
    
    fullText = result.processedText;
    
    // Calculate latency
    const latency = startTime ? Date.now() - startTime : 0;
    
    // Send completion event with metrics
    res.write(`event: complete\ndata: ${JSON.stringify({ 
      latency,
      promptTokens: result.metrics.promptTokens,
      completionTokens: result.metrics.completionTokens,
      totalTokens: result.metrics.totalTokens,
      interPromptLatency: result.metrics.interPromptLatency
    })}\n\n`);
    
    // End the response
    res.end();
  } catch (error) {
    console.error('Streaming error:', error);
    // Only write to the response if it hasn't been ended yet
    if (!res.writableEnded) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
    // Don't re-throw the error - handle it completely here
  }
};

/**
 * Process chat message with LLM
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.processChat = async (req, res) => {
  try {
    const { message, conversation, model, provider, readingLevel, language, style, sessionId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    if (!conversation || !Array.isArray(conversation)) {
      return res.status(400).json({ error: 'Conversation history is required and must be an array' });
    }
    
    // Process with LLM without streaming
    const result = await llmService.processChat(
      message,
      conversation,
      model || 'gpt-3.5-turbo',
      provider,
      sessionId || `session-${Date.now()}`,
      false,
      null,
      readingLevel,
      language,
      style
    );
    
    res.json({
      message: result.message,
      promptTokens: result.metrics.promptTokens,
      completionTokens: result.metrics.completionTokens,
      totalTokens: result.metrics.totalTokens,
      interPromptLatency: result.metrics.interPromptLatency
    });
  } catch (error) {
    console.error('Error in processChat controller:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Process chat message with LLM and stream the response
 * @param {Object} requestData - The request data
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.processChatStream = async (requestData, res) => {
  try {
    const { message, conversation, model, provider, readingLevel, language, style, sessionId, startTime } = requestData;
    
    if (!message) {
      throw new Error('Message is required');
    }
    
    if (!conversation || !Array.isArray(conversation)) {
      throw new Error('Conversation history is required and must be an array');
    }
    
    // Process with LLM with streaming
    let fullText = '';
    const onChunk = (chunk) => {
      try {
        res.write(`event: chunk\ndata: ${JSON.stringify({ text: chunk })}\n\n`);
      } catch (e) {
        console.error('Error writing chunk:', e);
      }
    };
    
    const result = await llmService.processChat(
      message,
      conversation,
      model || 'gpt-3.5-turbo',
      provider,
      sessionId || `session-${Date.now()}`,
      true,
      onChunk,
      readingLevel,
      language,
      style
    );
    
    fullText = result.message;
    
    // Calculate latency
    const latency = startTime ? Date.now() - startTime : 0;
    
    // Send completion event with metrics
    res.write(`event: complete\ndata: ${JSON.stringify({ 
      latency,
      promptTokens: result.metrics.promptTokens,
      completionTokens: result.metrics.completionTokens,
      totalTokens: result.metrics.totalTokens,
      interPromptLatency: result.metrics.interPromptLatency
    })}\n\n`);
    
    // End the response
    res.end();
  } catch (error) {
    console.error('Streaming error:', error);
    // Only write to the response if it hasn't been ended yet
    if (!res.writableEnded) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
    // Don't re-throw the error - handle it completely here
  }
};

/**
 * Assess text with LLM
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.assessText = async (req, res) => {
  try {
    const { text, model, sessionId } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    // Get assessment from LLM
    const result = await llmService.assessText(
      text, 
      model, 
      sessionId || `session-${Date.now()}`
    );
    
    res.json({ 
      assessment: result.assessment,
      promptTokens: result.metrics.promptTokens,
      completionTokens: result.metrics.completionTokens,
      totalTokens: result.metrics.totalTokens,
      interPromptLatency: result.metrics.interPromptLatency
    });
  } catch (error) {
    console.error('Error in assessText controller:', error.message);
    res.status(500).json({ error: error.message });
  }
};
