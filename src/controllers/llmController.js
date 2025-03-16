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
    const { text, readingLevel, language, style, model, startTime, stream = true } = req.body;
    
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
        
        fullText = await llmService.processText(text, readingLevel, language, style, model, true, onChunk);
        
        // Calculate latency
        const latency = Date.now() - startTime;
        
        // Send completion event
        res.write(`event: complete\ndata: ${JSON.stringify({ latency })}\n\n`);
      } catch (error) {
        console.error('Streaming error:', error);
        res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      } finally {
        res.end();
      }
    } else {
      // Process with LLM without streaming
      const processedText = await llmService.processText(text, readingLevel, language, style, model, false);
      
      // Calculate latency
      const latency = Date.now() - startTime;
      
      res.json({ 
        processedText,
        latency
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
 * Assess text with LLM
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.assessText = async (req, res) => {
  try {
    const { text, model } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    // Get assessment from LLM
    const assessment = await llmService.assessText(text, model);
    
    res.json({ assessment });
  } catch (error) {
    console.error('Error in assessText controller:', error.message);
    res.status(500).json({ error: error.message });
  }
};
