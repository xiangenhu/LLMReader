/**
 * API Routes
 * Defines all API endpoints for the application
 */

const express = require('express');
const router = express.Router();
const llmController = require('../controllers/llmController');
const metricsController = require('../controllers/metricsController');

// Store active sessions
const activeSessions = new Map();

// LLM routes
router.post('/process', (req, res) => {
  // Store the request body in the active sessions map
  const sessionId = req.body.sessionId || `session-${Date.now()}`;
  activeSessions.set(sessionId, req.body);
  
  // Return a success response immediately
  res.status(200).json({ success: true, sessionId });
});
router.get('/process/stream', (req, res) => {
  const sessionId = req.query.sessionId;
  
  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid or missing session ID' });
  }
  
  // Get the stored request data
  const requestData = activeSessions.get(sessionId);
  
  // Set headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  // Send initial event
  res.write('event: start\ndata: {}\n\n');
  
  // Process the text with streaming
  llmController.processTextStream(requestData, res)
    .catch(error => {
      console.error('Error in text processing stream:', error);
      // Only write to the response if it hasn't been ended yet
      if (!res.writableEnded) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    })
    .finally(() => {
      // Clean up the session data
      activeSessions.delete(sessionId);
    });
});
router.post('/chat', (req, res) => {
  // Store the request body in the active sessions map
  const sessionId = req.body.sessionId || `session-${Date.now()}`;
  activeSessions.set(sessionId, req.body);
  
  // Return a success response immediately
  res.status(200).json({ success: true, sessionId });
});
router.get('/chat/stream', (req, res) => {
  const sessionId = req.query.sessionId;
  
  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid or missing session ID' });
  }
  
  // Get the stored request data
  const requestData = activeSessions.get(sessionId);
  
  // Set headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  // Send initial event
  res.write('event: start\ndata: {}\n\n');
  
  // Process the chat with streaming
  llmController.processChatStream(requestData, res)
    .catch(error => {
      console.error('Error in chat stream:', error);
      // Only write to the response if it hasn't been ended yet
      if (!res.writableEnded) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    })
    .finally(() => {
      // Clean up the session data
      activeSessions.delete(sessionId);
    });
});
router.post('/assess', llmController.assessText);

// Metrics routes
router.post('/metrics', metricsController.trackMetrics);

// Config routes
router.get('/config', (req, res) => {
  res.json({
    assessmentUrl: process.env.ASSESSMENT_URL || 'https://exp.skoonline.org/wizard/index.html?wizard=1&teacher=0&DirectSPL=1&DirectRequest='
  });
});

module.exports = router;
