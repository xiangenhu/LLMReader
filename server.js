/**
 * Server Entry Point
 * Starts the Express server
 */

const dotenv = require('dotenv');
const app = require('./src/app');

// Load environment variables from .env file
dotenv.config();

// Set port
const port = process.env.PORT || 3000;

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');
  
  // Log API key status (not the actual keys)
  console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? 'Configured' : 'Not configured');
  console.log('Claude API Key:', process.env.CLAUDE_API_KEY ? 'Configured' : 'Not configured');
  console.log('Gemini API Key:', process.env.GEMINI_API_KEY ? 'Configured' : 'Not configured');
  
  // Log LRS status
  console.log('LRS:', (process.env.LRS_ENDPOINT && process.env.LRS_USERNAME && process.env.LRS_PASSWORD) ? 'Configured' : 'Not configured');
  
  // Log Assessment URL status
  console.log('Assessment URL:', process.env.ASSESSMENT_URL ? 'Configured' : 'Using default');
});
