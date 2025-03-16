/**
 * LRS Service
 * Handles interactions with Learning Record Store (LRS)
 */

const axios = require('axios');

/**
 * Send xAPI statement to LRS
 * @param {Object} statement - The xAPI statement to send
 * @returns {Promise<Object>} - The LRS response or a local log message
 */
exports.sendStatement = async (statement) => {
  // Check if LRS is configured
  if (!process.env.LRS_ENDPOINT || !process.env.LRS_USERNAME || !process.env.LRS_PASSWORD) {
    console.log('LRS not configured, logging statement locally:', statement);
    return { status: 'logged_locally', message: 'LRS credentials not provided' };
  }
  
  try {
    // Send to LRS
    const response = await axios.post(
      process.env.LRS_ENDPOINT + 'statements',
      statement,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(process.env.LRS_USERNAME + ':' + process.env.LRS_PASSWORD).toString('base64')
        }
      }
    );
    
    console.log('Metrics sent to LRS:', response.data);
    return { status: 'sent_to_lrs', data: response.data };
  } catch (error) {
    console.error('Error sending metrics to LRS:', error.message);
    throw new Error(`LRS error: ${error.response?.data?.message || error.message}`);
  }
};

/**
 * Get statements from LRS
 * @param {Object} query - Query parameters for filtering statements
 * @returns {Promise<Array>} - Array of statements
 */
exports.getStatements = async (query = {}) => {
  // Check if LRS is configured
  if (!process.env.LRS_ENDPOINT || !process.env.LRS_USERNAME || !process.env.LRS_PASSWORD) {
    console.log('LRS not configured, cannot retrieve statements');
    return [];
  }
  
  try {
    // Get statements from LRS
    const response = await axios.get(
      process.env.LRS_ENDPOINT + 'statements',
      {
        params: query,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(process.env.LRS_USERNAME + ':' + process.env.LRS_PASSWORD).toString('base64')
        }
      }
    );
    
    return response.data.statements || [];
  } catch (error) {
    console.error('Error getting statements from LRS:', error.message);
    throw new Error(`LRS error: ${error.response?.data?.message || error.message}`);
  }
};
