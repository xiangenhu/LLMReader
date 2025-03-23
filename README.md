# LLM Reader

A Node.js application that helps people read PDFs and HTML documents with customized rendering based on their preferences. LLM Reader displays documents while preserving original formatting, and allows users to process individual paragraphs through a Language Model to adapt the content to their preferred reading level, language, and style.

## Features

- **Document Rendering**: Displays both PDFs and HTML documents, preserving original formatting as much as possible
- **Semantic Unit Processing**: Divides content into semantic units (paragraphs) for individual processing
- **Customizable Reading Experience**: Adapts content based on:
  - Reading level (elementary to graduate)
  - Language translation
  - Writing style (simple, academic, conversational, technical)
- **Content Assessment**: Provides analysis of paragraph content including main topics, difficulty level, terminology, and potential biases
- **Metrics Tracking**: Records interaction metrics (latency, processing time) and can send to a Learning Record Store (LRS)
- **Multiple LLM Support**: Works with various language models:
  - OpenAI GPT-3.5/gpt-4o-mini
  - Anthropic Claude
  - Google Gemini
- **Server-side API Key Management**: Securely stores API keys on the server side
- **Streaming Responses**: Supports streaming responses from LLMs for real-time feedback

## How It Works

1. Upload a PDF or HTML document through the drag-and-drop interface or file selector
2. The document is rendered with each paragraph identified as a semantic unit
3. Choose your reading preferences (level, language, style)
4. Process individual paragraphs or enable auto-processing for the entire document
5. View the adapted content alongside the original document layout
6. Optionally request content assessment for deeper understanding

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Modern web browser (Chrome, Firefox, Safari, Edge)
- API key for at least one supported LLM provider
- A PDF or HTML document for testing (see "Sample Document" section below)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/llm-reader.git
   cd llm-reader
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with your API keys (see `.env.example` for reference):
   ```
   PORT=3000
   OPENAI_API_KEY=your_openai_api_key_here
   CLAUDE_API_KEY=your_claude_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. Start the server:
   ```
   npm start
   ```

5. Open your browser and navigate to `http://localhost:3000`

### Usage

1. Upload a PDF or HTML document
2. Select your preferred LLM provider and model
3. Choose your reading preferences (level, language, style)
4. Enable or disable streaming responses
5. Process paragraphs individually by clicking the "Process" button next to each paragraph, or enable auto-processing
6. For content assessment, click the "Assess" button next to a paragraph

### LRS Integration (Optional)

To track metrics in a Learning Record Store, add the following to your `.env` file:

```
LRS_ENDPOINT=https://lrs.example.com/xapi/
LRS_USERNAME=your_lrs_username_here
LRS_PASSWORD=your_lrs_password_here
```

## Technical Details

LLM Reader is built with:

- **Backend**: Node.js with Express
- **Frontend**: HTML, CSS, JavaScript with jQuery
- **Document Processing**: 
  - PDF.js library for PDF rendering and text extraction
  - Native HTML parsing for HTML documents
- **LLM Integration**: Server-side API connections to OpenAI, Anthropic, and Google
- **Learning Analytics**: xAPI statement format for LRS communication

## Project Structure

```
llm-reader/
├── public/                  # Static files served to the client
│   ├── index.html           # Main HTML file
│   ├── reader.js            # Client-side JavaScript
│   └── sample-document.html # Sample document for testing
├── src/                     # Server-side code
│   ├── controllers/         # Request handlers
│   │   ├── llmController.js # LLM processing controller
│   │   └── metricsController.js # Metrics tracking controller
│   ├── routes/              # API routes
│   │   └── api.js           # API endpoint definitions
│   ├── services/            # Business logic
│   │   ├── llmService.js    # LLM integration service
│   │   └── lrsService.js    # Learning Record Store service
│   ├── utils/               # Utility functions
│   │   └── errorHandler.js  # Error handling utilities
│   └── app.js               # Express application setup
├── uploads/                 # Uploaded files (created at runtime)
├── server.js                # Server entry point
├── package.json             # Project dependencies
├── .env                     # Environment variables (create this file)
├── .env.example             # Example environment variables
├── .gitignore               # Git ignore file
└── README.md                # This file
```

## Privacy Considerations

- API keys are stored securely on the server side
- Document processing happens in the browser
- LLM processing happens on the server
- No data is stored permanently unless LRS tracking is enabled

## Sample Document

A sample HTML document (`public/sample-document.html`) is included in this repository. You can use it to test the LLM Reader application in two ways:

### Using the HTML Document Directly

1. Select "HTML" in the file type toggle
2. Upload the `public/sample-document.html` file directly
3. The document will be rendered in its original HTML format

### Converting the Sample Document to PDF

If you prefer to test the PDF functionality:

#### Using Chrome/Edge:
1. Open `public/sample-document.html` in Chrome or Edge
2. Press Ctrl+P (or Cmd+P on Mac) to open the print dialog
3. Change the destination to "Save as PDF"
4. Click "Save" and choose a location to save the PDF

#### Using Firefox:
1. Open `public/sample-document.html` in Firefox
2. Press Ctrl+P (or Cmd+P on Mac) to open the print dialog
3. Choose "Print to File" and select PDF as the format
4. Click "Save" and choose a location to save the PDF

The sample document contains an academic paper with varying complexity levels, making it ideal for testing different reading preferences in the LLM Reader application.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
