import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { ScrapePricesStrategy } from '../ScrapePricesStrategy';

describe('Price Extraction Diagnostics', () => {
  let scrapePricesStrategy: ScrapePricesStrategy;

  beforeEach(() => {
    scrapePricesStrategy = new ScrapePricesStrategy(new URL('https://example.com'), { getCurrentPage: () => null } as any);
  });

  // Helper function to load HTML from file
  const loadHtmlFromFile = (filename: string) => {
    const filePath = path.join(__dirname, '..', '..', 'assets', filename);
    return fs.readFileSync(filePath, 'utf-8');
  };

  // Diagnostic test for price extraction
  it('should diagnose price extraction across different HTML structures', () => {
    const htmlFiles = [
      'nopriceset.html',
      'datacomponent_unitprice.html'
      // Add more test files as needed
    ];

    const extractionResults: any[] = [];

    htmlFiles.forEach(filename => {
      const htmlContent = loadHtmlFromFile(filename);
      const dom = new JSDOM(htmlContent);
      
      // Extract shipment elements
      const shipmentElements = scrapePricesStrategy.extractShipmentElements(htmlContent);
      
      shipmentElements.forEach((shipmentElement, index) => {
        const dom = new JSDOM(shipmentElement);
        const shipmentBody = dom.window.document.body;

        // Try all known price selectors
        const selectors = [
          '.yohtmlc-item .a-color-price',
          '[data-component="unitPrice"] .a-text-price .a-offscreen',
          '.a-color-price',
          '.a-text-price'
        ];

        const priceExtractionAttempts = selectors.map(selector => {
          const element = shipmentBody.querySelector(selector);
          return {
            selector,
            found: !!element,
            text: element ? element.textContent?.trim() : null
          };
        });

        // Look for any item links
        const itemLinkSelectors = [
          '.yohtmlc-item .a-link-normal', 
          '[data-component="itemTitle"] .a-link-normal',
          '.a-link-normal'
        ];

        const linkExtractionAttempts = itemLinkSelectors.map(selector => {
          const element = shipmentBody.querySelector(selector);
          return {
            selector,
            found: !!element,
            href: element ? element.getAttribute('href') : null
          };
        });

        extractionResults.push({
          filename,
          shipmentElementIndex: index,
          priceExtractionAttempts,
          linkExtractionAttempts,
          fullHTML: shipmentElement
        });
      });
    });

    // Log detailed extraction results for debugging
    console.log(JSON.stringify(extractionResults, null, 2));

    // Basic assertion to ensure we've found something
    expect(extractionResults.length).toBeGreaterThan(0);
  });
});