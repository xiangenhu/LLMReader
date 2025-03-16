# LLM Reader Browser Extension

A browser extension that enhances your reading experience by allowing you to process text from any webpage or PDF with Large Language Models (LLMs).

## Features

- **Text Selection Processing**: Select any text on a webpage and process it with an LLM
- **Paragraph Detection**: Automatically expands selection to include full paragraphs or sections with visual feedback
- **PDF Support**: Works with PDF files viewed in the browser
- **Multiple LLM Providers**: Supports OpenAI, Anthropic, and Google AI models
- **Customizable Settings**: Adjust reading level, language, and style preferences
- **Keyboard Shortcuts**: Process text quickly with keyboard shortcuts
- **Text-Only Extraction**: Extract only text content, ignoring buttons, images, and other non-text elements
- **Dim Unread Text**: Visually highlight text that has been read by dimming unread content
- **SPL Assessment**: Send selected text to SPL assessment tool for educational analysis

## Installation

### Development Mode

1. Clone or download this repository
2. Open Chrome/Edge/Firefox and navigate to the extensions page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Firefox: `about:addons`
3. Enable "Developer mode"
4. Click "Load unpacked" (Chrome/Edge) or "Load Temporary Add-on" (Firefox)
5. Select the `extension` folder from this repository

### From Web Store (Coming Soon)

The extension will be available in browser web stores after initial testing.

## Usage

1. **Configure Settings**:
   - Click the extension icon in your browser toolbar
   - Enter your API key for your preferred LLM provider
   - Adjust reading preferences (level, language, style)
   - Enable/disable paragraph expansion
   - Save settings

2. **Process Text**:
   - Method 1: Select text on any webpage and it will be automatically processed (if auto-process is enabled)
   - Method 2: Select text and press Ctrl+Shift+P to process
   - Method 3: Select text and right-click to use the context menu

3. **View Results**:
   - Processed text appears in a sidebar
   - Toggle between original and processed versions
   - Close the sidebar with the X button or by pressing Escape

## API Keys

This extension requires an API key from one of the supported LLM providers:

- **OpenAI**: Get an API key from [OpenAI Platform](https://platform.openai.com/)
- **Anthropic**: Get an API key from [Anthropic Console](https://console.anthropic.com/)
- **Google AI**: Get an API key from [Google AI Studio](https://makersuite.google.com/)

Your API key is stored locally in your browser and is only sent to the respective API service when processing text.

## Privacy

- All text processing happens via direct API calls to the selected provider
- No data is stored on any servers
- API keys are stored securely in your browser's local storage
- No tracking or analytics are included in this extension

## Detailed Features

### Paragraph Expansion

The extension can automatically expand your text selection to include the entire paragraph. This is useful when you want to process a complete thought or section rather than just a sentence or fragment.

When you select text on a webpage or PDF:
1. The extension detects the selection
2. If paragraph expansion is enabled, it attempts to find the complete paragraph containing your selection
3. A brief notification appears when the selection is expanded
4. The entire paragraph is sent for processing

#### PDF Support

The paragraph detection feature works with PDFs as well as regular webpages. When you select text in a PDF document:

- The extension uses specialized detection algorithms for PDF content
- It analyzes the layout and spacing of text elements to identify paragraph boundaries
- It works with both browser-native PDF viewers and PDF.js-based viewers
- It can detect paragraphs even when the PDF has complex formatting

This makes it easy to process complete thoughts from academic papers, reports, and other PDF documents.

You can toggle this feature on/off in the extension settings.

### Text-Only Extraction

When enabled, this feature extracts only the text content from the selected element, ignoring buttons, images, and other non-text elements. This is particularly useful for:

- Webpages with complex layouts and interactive elements
- Content with embedded media that you don't want to include
- Articles with advertisements or other distractions

The text-only extraction intelligently filters out UI elements while preserving the meaningful content, making it easier to focus on the actual text.

### Dim Unread Text

This feature provides a visual aid for reading by:

- Dimming all text on the page initially
- Highlighting text as you click and read it
- Persisting your reading progress across page reloads

This makes it easier to track what you've already read, especially in long documents or articles. The visual distinction helps you focus on new content and avoid re-reading sections you've already covered.

### SPL Assessment

The SPL (Structured Pedagogy Learning) Assessment feature allows you to:

- Send selected text to an educational assessment tool
- Analyze content using Socratic teaching methods
- Get pedagogical insights about the selected text

When enabled, clicking on text will not only process it with your chosen LLM but also open the SPL assessment tool in a new tab with your selected text pre-loaded. This is particularly useful for educators, students, and researchers who want to analyze text from an educational perspective.

The SPL assessment URL is configurable through the server's `.env` file using the `ASSESSMENT_URL` variable. By default, it uses:
```
ASSESSMENT_URL=https://splpolyu.skoonline.org/wizard/index.html?wizard=1&teacher=0&Pedagody=["SOCRATIC"]&&DirectSPL=1&DirectRequest=
```

This allows administrators to change the assessment tool URL without modifying the extension code.

## Development

This extension is built using standard web technologies:

- HTML/CSS for the user interface
- JavaScript for functionality
- PDF.js for PDF rendering
- Chrome Extension API / Browser Extension API
- DOM Range API for paragraph detection

To modify or extend the extension:

1. Edit the files in the `extension` directory
2. Reload the extension in your browser to test changes
3. For substantial changes, increment the version number in `manifest.json`

## License

[MIT License](LICENSE)
