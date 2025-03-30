import { JSDOM } from 'jsdom';

export function prettyPrintHTML(html: string | null | undefined): string {
  if (!html) return "NO HTML";

  try {
    // Method 1: JSDOM-based parsing and cleaning
    const dom = new JSDOM(html, { 
      includeNodeLocations: false 
    });
    const document = dom.window.document;

    // Remove script tags
    const scripts = document.querySelectorAll('script');
    scripts.forEach(script => script.remove());

    // Remove inline event handlers
    const elements = document.querySelectorAll('*');
    elements.forEach(element => {
      Array.from(element.attributes).forEach(attr => {
        if (attr.name.startsWith('on')) {
          element.removeAttribute(attr.name);
        }
      });
    });

    // Serialize cleaned HTML
    return document.body.innerHTML.trim();
  } catch (jsdomError) {
    try {
      // Fallback Method 2: Regex-based cleaning
      let cleanedHtml = html
        // Remove script tags
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        
        // Remove inline event handlers using regex
        .replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*')/gi, '')
        .replace(/\s+on\w+\s*=\s*\w+/gi, '');
      
      return cleanedHtml.trim();
    } catch (regexError) {
      // Final Fallback: Basic sanitization
      console.error('HTML cleaning failed:', jsdomError, regexError);
      
      // Basic sanitization to prevent XSS
      return html
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .trim();
    }
  }
}