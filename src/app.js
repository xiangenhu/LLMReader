/**
 * Main Application
 * Sets up the Express application with middleware and routes
 */

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const apiRoutes = require('./routes/api');
const documentService = require('./services/documentService');
const { errorMiddleware } = require('./utils/errorHandler');

// Create Express app
const app = express();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Allow PDF and HTML files
    if (file.mimetype === 'application/pdf' || 
        file.mimetype === 'text/html' || 
        file.mimetype === 'application/xhtml+xml') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and HTML files are allowed'));
    }
  }
});

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Add CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// API Routes
app.use('/api', apiRoutes);

// File upload route
app.post('/upload', upload.single('document'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  // Determine file type
  const fileType = req.file.mimetype === 'application/pdf' ? 'pdf' : 'html';
  
  res.json({ 
    success: true, 
    file: {
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      type: fileType
    }
  });
});

// Fetch document from URL
app.post('/fetch-url', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    const document = await documentService.fetchFromUrl(url);
    
    res.json({
      success: true,
      file: {
        filename: document.filename,
        path: `/uploads/${document.filename}`,
        type: document.type
      }
    });
  } catch (error) {
    console.error('Error fetching from URL:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process HTML content
app.post('/process-html', (req, res) => {
  try {
    const { html } = req.body;
    
    if (!html) {
      return res.status(400).json({ error: 'HTML content is required' });
    }
    
    const processedHtml = documentService.processHtml(html);
    
    res.json({
      success: true,
      html: processedHtml
    });
  } catch (error) {
    console.error('Error processing HTML:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve uploaded files
app.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(__dirname, '..', 'uploads', req.params.filename);
  res.sendFile(filePath);
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Error handling middleware
app.use(errorMiddleware);

module.exports = app;
