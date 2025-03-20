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
    const { text, readingLevel, language, style, model, startTime, stream = true, sessionId } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    // If streaming is requested, set up SSE
    if (stream) {
      // Set headers for Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      
      // Send initial event
      res.write('event: start\ndata: {}\n\n');
      
      try {
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
        const latency = Date.now() - startTime;
        
        // Send completion event with metrics
        res.write(`event: complete\ndata: ${JSON.stringify({ 
          latency,
          promptTokens: result.metrics.promptTokens,
          completionTokens: result.metrics.completionTokens,
          totalTokens: result.metrics.totalTokens,
          interPromptLatency: result.metrics.interPromptLatency
        })}\n\n`);
      } catch (error) {
        console.error('Streaming error:', error);
        res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      } finally {
        res.end();
      }
    } else {
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
      
      // Calculate latency
      const latency = Date.now() - startTime;
      
      res.json({ 
        processedText: result.processedText,
        latency,
        promptTokens: result.metrics.promptTokens,
        completionTokens: result.metrics.completionTokens,
        totalTokens: result.metrics.totalTokens,
        interPromptLatency: result.metrics.interPromptLatency
      });
    }
  } catch (error) {
    console.error('Error in processText controller:', error.message);
    
    // If streaming, send error event
    if (req.body.stream) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: error.message });
    }
  }
};

/**
 * Process chat message with LLM
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.processChat = async (req, res) => {
  try {
    const { message, conversation, model, provider, sessionId, stream = true, startTime } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    if (!conversation || !Array.isArray(conversation)) {
      return res.status(400).json({ error: 'Conversation history is required and must be an array' });
    }
    
    // If streaming is requested, set up SSE
    if (stream) {
      // Set headers for Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      
      // Send initial event
      res.write('event: start\ndata: {}\n\n');
      
      try {
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
          onChunk
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
      } catch (error) {
        console.error('Streaming error:', error);
        res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      } finally {
        res.end();
      }
    } else {
      // Process with LLM without streaming
      const result = await llmService.processChat(
        message,
        conversation,
        model || 'gpt-3.5-turbo',
        provider,
        sessionId || `session-${Date.now()}`,
        false
      );
      
      // Calculate latency
      const latency = startTime ? Date.now() - startTime : 0;
      
      res.json({
        message: result.message,
        latency,
        promptTokens: result.metrics.promptTokens,
        completionTokens: result.metrics.completionTokens,
        totalTokens: result.metrics.totalTokens,
        interPromptLatency: result.metrics.interPromptLatency
      });
    }
  } catch (error) {
    console.error('Error in processChat controller:', error.message);
    
    // If streaming, send error event
    if (req.body.stream) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: error.message });
    }
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
