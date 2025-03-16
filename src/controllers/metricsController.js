/**
 * Metrics Controller
 * Handles requests for metrics tracking and LRS integration
 */

const lrsService = require('../services/lrsService');

/**
 * Track metrics and send to LRS if configured
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.trackMetrics = async (req, res) => {
  try {
    const data = req.body;
    
    if (!data.action || !data.paragraphId) {
      return res.status(400).json({ error: 'Action and paragraphId are required' });
    }
    
    // Create xAPI statement
    const statement = {
      actor: {
        name: 'LLM Reader User',
        mbox: 'mailto:user@example.com'
      },
      verb: {
        id: data.action === 'processed' 
          ? 'http://adlnet.gov/expapi/verbs/completed'
          : 'http://adlnet.gov/expapi/verbs/experienced',
        display: {
          'en-US': data.action === 'processed' ? 'processed' : 'assessed'
        }
      },
      object: {
        id: `http://example.com/llmreader/paragraph/${data.paragraphId}`,
        definition: {
          name: {
            'en-US': `Paragraph ${data.paragraphId}`
          }
        }
      },
      result: {
        extensions: {
          'http://example.com/llmreader/metrics': {
            latency: data.latency,
            readingLevel: data.readingLevel,
            language: data.language,
            style: data.style,
            model: data.model,
            timestamp: new Date().toISOString()
          }
        }
      },
      timestamp: new Date().toISOString()
    };
    
    // Send to LRS if configured
    const lrsResult = await lrsService.sendStatement(statement);
    
    res.json({ 
      success: true,
      lrsResult
    });
  } catch (error) {
    console.error('Error in trackMetrics controller:', error.message);
    // Don't fail the client request if LRS fails
    res.json({ 
      success: true,
      lrsError: error.message
    });
  }
};
