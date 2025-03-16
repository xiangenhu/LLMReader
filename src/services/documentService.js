/**
 * Document Service
 * Handles fetching and processing documents from URLs
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Fetch a document from a URL
 * @param {string} url - The URL to fetch the document from
 * @returns {Promise<Object>} - Object containing the document content, type, and filename
 */
exports.fetchFromUrl = async (url) => {
  try {
    // Determine if the URL is likely a PDF or HTML
    const isPdf = url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('pdf');
    
    // Set appropriate response type
    const responseType = isPdf ? 'arraybuffer' : 'text';
    
    // Fetch the document
    const response = await axios.get(url, {
      responseType,
      headers: {
        'User-Agent': 'LLM-Reader/1.0'
      }
    });
    
    // Generate a unique filename
    const fileExtension = isPdf ? '.pdf' : '.html';
    const filename = `${uuidv4()}${fileExtension}`;
    const uploadDir = path.join(__dirname, '..', '..', 'uploads');
    const filePath = path.join(uploadDir, filename);
    
    // Ensure uploads directory exists
    try {
      await fs.mkdir(uploadDir, { recursive: true });
    } catch (err) {
      console.log('Uploads directory already exists or could not be created');
    }
    
    // Save the file
    try {
      if (isPdf) {
        await fs.writeFile(filePath, response.data);
      } else {
        await fs.writeFile(filePath, response.data, 'utf8');
      }
    } catch (err) {
      console.error('Error saving file:', err);
      throw new Error(`Failed to save file: ${err.message}`);
    }
    
    return {
      content: response.data,
      type: isPdf ? 'pdf' : 'html',
      filename,
      path: filePath
    };
  } catch (error) {
    console.error('Error fetching document from URL:', error.message);
    throw new Error(`Failed to fetch document: ${error.message}`);
  }
};

/**
 * Process HTML content to add IDs to elements that need them
 * @param {string} html - The HTML content to process
 * @returns {string} - The processed HTML with IDs added
 */
exports.processHtml = (html) => {
  // Create a temporary DOM element to parse the HTML
  const parser = new (require('jsdom').JSDOM)();
  const doc = parser.window.document;
  
  // Create a container and set the HTML
  const container = doc.createElement('div');
  container.innerHTML = html;
  
  // Find all paragraph-like elements
  const paragraphElements = container.querySelectorAll('p, div, section, article, h1, h2, h3, h4, h5, h6, li');
  
  // Add IDs to elements that don't have them
  let idCounter = 0;
  paragraphElements.forEach((element) => {
    // Skip empty elements or those that only contain other paragraph elements
    if (element.textContent.trim() === '' || 
        element.querySelectorAll('p, div, section, article, h1, h2, h3, h4, h5, h6, li').length > 0) {
      return;
    }
    
    // Add ID if missing
    if (!element.id) {
      element.id = `paragraph-${idCounter++}`;
    }
    
    // Add data attribute for processing
    element.setAttribute('data-llm-processable', 'true');
  });
  
  return container.innerHTML;
};
