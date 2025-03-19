/**
 * UI Handler - Handles UI-specific functionality
 */

class UIHandler {
    constructor(reader) {
        this.reader = reader;
    }
    
    initCollapsibleSections() {
        // Add click handler for all collapsible headers
        $(document).on('click', '.collapsible-header', function() {
            $(this).toggleClass('collapsed');
            $(this).closest('.collapsible').find('.collapsible-content').slideToggle(200);
        });
    }
    
    applyDimming() {
        try {
            const iframe = document.getElementById('document-iframe');
            if (!iframe || !iframe.contentDocument) {
                return;
            }
            
            // Get all paragraphs in the document
            const paragraphs = iframe.contentDocument.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, div, section, article');
            
            // Apply dimming to all paragraphs that haven't been read
            paragraphs.forEach((paragraph, index) => {
                if (!this.reader.readParagraphs.has(index)) {
                    paragraph.style.opacity = '0.5';
                    paragraph.style.transition = 'opacity 0.3s ease';
                    
                    // Add click handler to restore opacity when clicked
                    paragraph.addEventListener('click', () => {
                        paragraph.style.opacity = '1';
                        this.reader.readParagraphs.add(index);
                    });
                }
            });
        } catch (error) {
            console.error('Error applying dimming:', error);
        }
    }
    
    removeDimming() {
        try {
            const iframe = document.getElementById('document-iframe');
            if (!iframe || !iframe.contentDocument) {
                return;
            }
            
            // Get all paragraphs in the document
            const paragraphs = iframe.contentDocument.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, div, section, article');
            
            // Remove dimming from all paragraphs
            paragraphs.forEach(paragraph => {
                paragraph.style.opacity = '1';
            });
        } catch (error) {
            console.error('Error removing dimming:', error);
        }
    }
}
