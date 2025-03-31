// src/tests/testbench/PriceScrapingTestBench.ts

import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { ScrapePricesStrategy } from '../../ScrapePricesStrategy';
import { DeliveryStatus, OrderDetails } from '../../OrderDetails';
import { ItemDetails } from '../../ItemDetails';
import { PageTracker } from '../../PageTracker';

interface TestCase {
  name: string;
  html: string;
  orderBefore: OrderDetails;
  expectedItems: ItemDetails[];
  skip?: boolean;
  only?: boolean;
}

/**
 * A dynamic test bench for the ScrapePricesStrategy
 * 
 * This test bench allows you to:
 * 1. Add test cases with HTML snippets and expected results
 * 2. Run all tests or specific ones
 * 3. Save failing HTML to disk for debugging
 * 4. Capture test cases from live runs when issues are detected
 */
export class PriceScrapingTestBench {
  private testCases: TestCase[] = [];
  private fixturesDir: string;
  private failuresDir: string;
  private strategy: ScrapePricesStrategy;
  
  constructor(fixturesDir: string = 'tests/fixtures/price-scraping', failuresDir: string = 'tests/failures/price-scraping') {
    this.fixturesDir = path.resolve(fixturesDir);
    this.failuresDir = path.resolve(failuresDir);
    
    // Ensure directories exist
    fs.mkdirSync(this.fixturesDir, { recursive: true });
    fs.mkdirSync(this.failuresDir, { recursive: true });
    
    // Create the strategy with a dummy tracker
    const dummyTracker = { getCurrentPage: () => ({}) } as PageTracker;
    this.strategy = new ScrapePricesStrategy(new URL('https://example.com'), dummyTracker);
  }
  
  /**
   * Add a test case manually
   */
  public addTestCase(testCase: TestCase): void {
    this.testCases.push(testCase);
  }
  
  /**
   * Add a test case from files in the fixtures directory
   */
  public addTestCaseFromFixture(name: string): void {
    const htmlPath = path.join(this.fixturesDir, `${name}.html`);
    const orderBeforePath = path.join(this.fixturesDir, `${name}.input.json`);
    const expectedItemsPath = path.join(this.fixturesDir, `${name}.expected.json`);
    
    if (!fs.existsSync(htmlPath) || !fs.existsSync(orderBeforePath) || !fs.existsSync(expectedItemsPath)) {
      throw new Error(`Missing fixture files for test case ${name}`);
    }
    
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const orderBefore = JSON.parse(fs.readFileSync(orderBeforePath, 'utf-8'));
    const expectedItems = JSON.parse(fs.readFileSync(expectedItemsPath, 'utf-8'));
    
    this.addTestCase({
      name,
      html,
      orderBefore,
      expectedItems
    });
  }
  
  /**
   * Save HTML content to the failures directory for debugging
   */
  private saveFailureDetails(testCase: TestCase, actualItems: ItemDetails[]): void {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const failureDir = path.join(this.failuresDir, `${testCase.name}-${timestamp}`);
    fs.mkdirSync(failureDir, { recursive: true });
    
    // Save the HTML content
    fs.writeFileSync(path.join(failureDir, 'content.html'), testCase.html);
    
    // Save the input order
    fs.writeFileSync(
      path.join(failureDir, 'order-before.json'), 
      JSON.stringify(testCase.orderBefore, null, 2)
    );
    
    // Save the actual items
    fs.writeFileSync(
      path.join(failureDir, 'actual-items.json'), 
      JSON.stringify(actualItems, null, 2)
    );
    
    // Save the expected items
    fs.writeFileSync(
      path.join(failureDir, 'expected-items.json'), 
      JSON.stringify(testCase.expectedItems, null, 2)
    );
    
    // Save a diff report (simplified)
    const diffReport = this.generateDiffReport(testCase.expectedItems, actualItems);
    fs.writeFileSync(
      path.join(failureDir, 'diff-report.txt'),
      diffReport
    );
  }
  
  /**
   * Generate a simple diff report between expected and actual items
   */
  private generateDiffReport(expected: ItemDetails[], actual: ItemDetails[]): string {
    let report = 'DIFF REPORT\n===========\n\n';
    
    // Check for length differences
    report += `Expected ${expected.length} items, got ${actual.length} items\n\n`;
    
    // Check for missing or extra items
    const expectedTitles = new Set(expected.map(item => item.title));
    const actualTitles = new Set(actual.map(item => item.title));
    
    const missingTitles = [...expectedTitles].filter(title => !actualTitles.has(title));
    const extraTitles = [...actualTitles].filter(title => !expectedTitles.has(title));
    
    if (missingTitles.length > 0) {
      report += 'MISSING ITEMS:\n';
      missingTitles.forEach(title => report += `- ${title}\n`);
      report += '\n';
    }
    
    if (extraTitles.length > 0) {
      report += 'EXTRA ITEMS:\n';
      extraTitles.forEach(title => report += `- ${title}\n`);
      report += '\n';
    }
    
    // Check for price differences
    report += 'PRICE DIFFERENCES:\n';
    let hasPriceDiffs = false;
    
    expected.forEach(expectedItem => {
      const actualItem = actual.find(item => item.title === expectedItem.title);
      if (actualItem && actualItem.price !== expectedItem.price) {
        report += `- "${expectedItem.title}": expected price "${expectedItem.price}", got "${actualItem.price}"\n`;
        hasPriceDiffs = true;
      }
    });
    
    if (!hasPriceDiffs) {
      report += 'No price differences found in matching items\n';
    }
    
    return report;
  }
  
  /**
   * Capture a live failure as a test case
   */
  public captureFailure(
    name: string, 
    html: string, 
    orderBefore: OrderDetails, 
    expectedItems: ItemDetails[]
  ): void {
    const caseName = `captured-${name}-${Date.now()}`;
    const caseDir = path.join(this.fixturesDir, caseName);
    fs.mkdirSync(caseDir, { recursive: true });
    
    // Save the fixtures
    fs.writeFileSync(path.join(this.fixturesDir, `${caseName}.html`), html);
    fs.writeFileSync(path.join(this.fixturesDir, `${caseName}.input.json`), JSON.stringify(orderBefore, null, 2));
    fs.writeFileSync(path.join(this.fixturesDir, `${caseName}.expected.json`), JSON.stringify(expectedItems, null, 2));
    
    console.log(`Captured test case "${caseName}" for future testing`);
  }
  
  /**
   * Run all test cases
   */
  public async runTests(): Promise<{passed: number, failed: number, skipped: number}> {
    let passed = 0;
    let failed = 0;
    let skipped =
    0;
    
    const onlyTests = this.testCases.filter(tc => tc.only);
    const testsToRun = onlyTests.length > 0 ? onlyTests : this.testCases;
    
    console.log(`Running ${testsToRun.length} test cases...`);
    
    for (const testCase of testsToRun) {
      if (testCase.skip) {
        console.log(`SKIPPED: ${testCase.name}`);
        skipped++;
        continue;
      }
      
      try {
        console.log(`Running test case: ${testCase.name}`);
        
        // Extract shipment elements from the HTML
        const shipmentElements = this.strategy.extractShipmentElements(testCase.html);
        
        // Process the shipment elements with the order
        const actualItems = await this.strategy.processShipmentElements(shipmentElements, testCase.orderBefore);
        
        // Verify the results
        let testPassed = true;
        
        // 1. Check item count
        if (actualItems.length !== testCase.expectedItems.length) {
          console.error(`✘ Expected ${testCase.expectedItems.length} items, but got ${actualItems.length}`);
          testPassed = false;
        }
        
        // 2. Check that all expected items are present with correct prices
        for (const expectedItem of testCase.expectedItems) {
          const actualItem = actualItems.find(item => item.title === expectedItem.title);
          
          if (!actualItem) {
            console.error(`✘ Expected item "${expectedItem.title}" not found in actual items`);
            testPassed = false;
            continue;
          }
          
          if (actualItem.price !== expectedItem.price) {
            console.error(`✘ Expected price "${expectedItem.price}" for item "${expectedItem.title}", but got "${actualItem.price}"`);
            testPassed = false;
          }
        }
        
        // 3. Check for extra items not in expected list
        for (const actualItem of actualItems) {
          const expectedItem = testCase.expectedItems.find(item => item.title === actualItem.title);
          
          if (!expectedItem) {
            console.error(`✘ Unexpected item found: "${actualItem.title}"`);
            testPassed = false;
          }
        }
        
        if (testPassed) {
          console.log(`✓ ${testCase.name} passed`);
          passed++;
        } else {
          console.error(`✘ ${testCase.name} failed`);
          this.saveFailureDetails(testCase, actualItems);
          failed++;
        }
      } catch (error) {
        console.error(`✘ ${testCase.name} failed with error: ${error}`);
        failed++;
      }
    }
    
    console.log(`\nTest Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
    return { passed, failed, skipped };
  }
  
  /**
   * Create a regression test for the duplicate items issue
   */
  public static createDuplicateItemsRegressionTest(): TestCase {
    // This is a simplified example - for a real test, you'd use actual HTML content
    const html = `
      <div class="shipment">
        <div class="a-fixed-left-grid-inner">
          <div class="product-info">
            <div class="a-row">
              <div class="yohtmlc-item">
                <a class="a-link-normal" href="/dp/B0ABC123DE">
                  <div class="yohtmlc-product-title">Hoerev Set van 4 herenondergoed</div>
                </a>
                <span class="a-color-price">€22,99</span>
              </div>
            </div>
          </div>
          
          <!-- Duplicate item information (different HTML structure) -->
          <div class="product-info">
            <div class="a-row">
              <div class="yohtmlc-item">
                <a class="a-link-normal" href="/dp/B0ABC123DE">
                  <div class="yohtmlc-product-title">Hoerev Set van 4 herenondergoed</div>
                </a>
                <span class="a-color-price">€22,99</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // The order as it exists before processing
    const orderBefore: OrderDetails = {
      orderId: "405-7547290-2317108",
      orderTotal: "€ 56,81",
      orderPlacedDate: "21 maart 2025",
      deliveryStatus: DeliveryStatus.Delivered, // DeliveryStatus.Delivered
      deliveryDate: "24 maart",
      url: new URL("https://www.amazon.com.be/gp/your-account/order-details?orderID=405-7547290-2317108"),
      items: [
        {
          title: "Hoerev Set van 4 herenondergoed",
          returnPolicy: "Je item bekijken",
          price: undefined, // Price is not yet defined
          productId: "B0ABC123DE",
          href: "https://www.amazon.com.be/dp/B0ABC123DE",
          qty: "1"
        }
      ]
    };
    
    // The expected items after processing (deduplicated)
    const expectedItems: ItemDetails[] = [
      {
        title: "Hoerev Set van 4 herenondergoed",
        returnPolicy: "Je item bekijken",
        price: "€22,99", // Price is now populated
        productId: "B0ABC123DE",
        href: "https://www.amazon.com.be/dp/B0ABC123DE",
        qty: "1"
      }
    ];
    
    return {
      name: "deduplicate-items-regression",
      html,
      orderBefore,
      expectedItems
    };
  }
}