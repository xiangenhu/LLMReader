/**
 * API Routes
 * Defines all API endpoints for the application
 */

const express = require('express');
const router = express.Router();
const llmController = require('../controllers/llmController');
const metricsController = require('../controllers/metricsController');

// LLM routes
router.post('/process', llmController.processText);
router.post('/assess', llmController.assessText);

// Metrics routes
router.post('/metrics', metricsController.trackMetrics);

// Config routes
router.get('/config', (req, res) => {
  res.json({
    assessmentUrl: process.env.ASSESSMENT_URL || 'https://splpolyu.skoonline.org/wizard/index.html?wizard=1&teacher=0&Pedagody=["SOCRATIC"]&&DirectSPL=1&DirectRequest='
  });
});

module.exports = router;
