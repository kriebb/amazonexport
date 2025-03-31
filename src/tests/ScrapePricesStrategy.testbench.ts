// src/tests/ScrapePricesStrategy.testbench.ts

import { PriceScrapingTestBench } from './testbench/PriceScrapingTestBench';
import fs from 'fs';
import path from 'path';
import { ScrapePricesStrategy } from '../ScrapePricesStrategy';
import { JSDOM } from 'jsdom';
import { OrderDetails } from '../OrderDetails';
import { DeliveryStatus } from '../OrderDetails';

/**
 * This test demonstrates how to use the test bench to create comprehensive
 * tests for the ScrapePricesStrategy, including regression tests for
 * specific issues like the duplicate items problem.
 */
describe('ScrapePricesStrategy with TestBench', () => {
  let testBench: PriceScrapingTestBench;
  
  beforeAll(() => {
    // Create the test bench
    testBench = new PriceScrapingTestBench();
    
    // Add the duplicate items regression test
    testBench.addTestCase(PriceScrapingTestBench.createDuplicateItemsRegressionTest());
    
    // Add more test cases as needed
    // You could load these from fixture files
    try {
      // Example of loading test cases from the fixtures directory
      const fixtureDir = path.join(__dirname, 'fixtures', 'price-scraping');
      
      if (fs.existsSync(fixtureDir)) {
        const files = fs.readdirSync(fixtureDir);
        const testCases = files
          .filter(file => file.endsWith('.html'))
          .map(file => file.replace('.html', ''));
        
        for (const testCase of testCases) {
          testBench.addTestCaseFromFixture(testCase);
        }
      }
    } catch (error) {
      console.warn('Could not load fixture test cases:', error);
    }
    
    // Or add them manually
    testBench.addTestCase({
      name: 'single-item-extraction',
      html: `
        <div class="shipment">
          <div class="a-fixed-left-grid-inner">
            <div class="product-info">
              <div class="a-row">
                <div class="yohtmlc-item">
                  <a class="a-link-normal" href="/dp/B09CYM5QW8">
                    <div class="yohtmlc-product-title">Test Product</div>
                  </a>
                  <span class="a-color-price">€19,99</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `,
      orderBefore: {
        orderId: "123-4567890-1234567",
        orderTotal: "€ 19,99",
        orderPlacedDate: "1 maart 2025",
        deliveryStatus: DeliveryStatus.Delivered,
        deliveryDate: "3 maart",
        url: new URL("https://www.amazon.com.be/gp/your-account/order-details?orderID=123-4567890-1234567"),
        items: [
          {
            title: "Test Product",
            returnPolicy: "Je item bekijken",
            price: undefined,
            productId: "B09CYM5QW8",
            href: "https://www.amazon.com.be/dp/B09CYM5QW8",
            qty: "1"
          }
        ]
      },
      expectedItems: [
        {
          title: "Test Product",
          returnPolicy: "Je item bekijken",
          price: "€19,99",
          productId: "B09CYM5QW8",
          href: "https://www.amazon.com.be/dp/B09CYM5QW8",
          qty: "1"
        }
      ]
    });
  });
  
  it('should run all test cases successfully', async () => {
    const results = await testBench.runTests();
    expect(results.failed).toBe(0);
  });
  
  // You can also add more specific tests
  it('should extract prices correctly from various HTML structures', () => {
    const strategy = new ScrapePricesStrategy(
      new URL('https://example.com'),
      { getCurrentPage: () => ({}) } as any
    );
    
    // Test the extractPrice method directly
    const htmlCases = [
      {
        name: 'a-price-whole element',
        html: '<div><span class="a-price-whole">123</span></div>',
        expectedPrice: '123'
      },
      {
        name: 'a-offscreen element',
        html: '<div><span class="a-offscreen">€67,89</span></div>',
        expectedPrice: '€67,89'
      },
      {
        name: 'a-color-price element',
        html: '<div><span class="a-color-price">€10,00</span></div>',
        expectedPrice: '€10,00'
      }
    ];
    
    for (const testCase of htmlCases) {
      const dom = new JSDOM(testCase.html);
      const body = dom.window.document.body;
      
      const price = strategy.extractPrice(body, [
        '.a-price-whole',
        '.a-price-fraction',
        '.a-offscreen',
        '.a-color-price',
        '[data-component="unitPrice"] .a-text-price',
        '.yohtmlc-item .a-color-price',
        '.item-price',
        '.a-price .a-offscreen'
      ]);
      
      expect(price).toBe(testCase.expectedPrice);
    }
  });
  
  /**
   * This test demonstrates how to capture a real-world failure for future testing
   */
  it('should support capturing failures from real-world examples', () => {
    const captureFailure = false; // Set to true when you want to capture
    
    if (captureFailure) {
      const html = fs.readFileSync(path.join(__dirname, 'samples', 'problematic-page.html'), 'utf8');
      const orderDetails: OrderDetails = {
        orderId: "sample-order-id",
        orderTotal: "€ 100,00",
        orderPlacedDate: "1 maart 2025",
        deliveryStatus: DeliveryStatus.Delivered,
        deliveryDate: "5 maart",
        url: new URL("https://example.com"),
        items: [
          {
            title: "Sample Product",
            returnPolicy: "Return Policy",
            price: undefined,
            productId: "SAMPLE123",
            href: "https://example.com/product",
            qty: "1"
          }
        ]
      };
      
      const expectedItems = [
        {
          title: "Sample Product",
          returnPolicy: "Return Policy",
          price: "€49,99",
          productId: "SAMPLE123",
          href: "https://example.com/product",
          qty: "1"
        }
      ];
      
      testBench.captureFailure(
        "problematic-page",
        html,
        orderDetails,
        expectedItems
      );
    }
    
    // Just a placeholder assertion for when captureFailure is false
    expect(true).toBe(true);
  });
});