// src/scraping/TestCaptureDecorator.ts

import fs from 'fs';
import path from 'path';
import { ScrapePricesStrategy } from '../ScrapePricesStrategy';
import { OrderDetails } from '../OrderDetails';
import { ItemDetails } from '../ItemDetails';
import { prettyPrintHTML } from '../prettyPrintHTML';
import crypto from 'crypto';

/**
 * This decorator wraps the ScrapePricesStrategy to add automatic test case capture.
 * It monitors for potential issues and saves test data when problems occur.
 */
export class TestCaptureDecorator {
  private originalStrategy: ScrapePricesStrategy;
  private testCaptureEnabled: boolean;
  private testsDirectory: string;
  
  constructor(
    strategy: ScrapePricesStrategy, 
    testCaptureEnabled = true,
    testsDirectory = path.join(process.cwd(), 'src', 'tests', 'captured')
  ) {
    this.originalStrategy = strategy;
    this.testCaptureEnabled = testCaptureEnabled;
    this.testsDirectory = testsDirectory;
    
    // Ensure the tests directory exists
    if (this.testCaptureEnabled) {
      fs.mkdirSync(this.testsDirectory, { recursive: true });
    }
    
    // Wrap the process method to intercept calls
    const originalProcess = this.originalStrategy.process.bind(this.originalStrategy);
    this.originalStrategy.process = async (orders: OrderDetails[]): Promise<OrderDetails[]> => {
      try {
        const result = await originalProcess(orders);
        // Check for potential issues with the results
        this.checkForIssues(orders, result);
        return result;
      } catch (error) {
        // If an error occurs, capture the test case
        this.captureErrorCase(orders, error);
        throw error;
      }
    };
    
    // Wrap the processShipmentElements method
    const originalProcessShipmentElements = this.originalStrategy.processShipmentElements.bind(this.originalStrategy);
    this.originalStrategy.processShipmentElements = async (shipmentElements: string[], order: OrderDetails) => {
      try {
        const result = await originalProcessShipmentElements(shipmentElements, order);
        // Check for issues in the process shipment elements method
        this.checkForShipmentIssues(shipmentElements, order, result);
        return result;
      } catch (error) {
        // If an error occurs, capture the test case
        this.captureShipmentErrorCase(shipmentElements, order, error);
        throw error;
      }
    };
  }
  
  /**
   * Get the decorated strategy
   */
  public get strategy(): ScrapePricesStrategy {
    return this.originalStrategy;
  }
  
  /**
   * Enable or disable test case capture
   */
  public setTestCaptureEnabled(enabled: boolean): void {
    this.testCaptureEnabled = enabled;
  }
  
  /**
   * Check for issues in the order processing results
   */
  private checkForIssues(orders: OrderDetails[], results: OrderDetails[]): void {
    if (!this.testCaptureEnabled) return;
    
    for (let i = 0; i < results.length; i++) {
      const originalOrder = orders[i];
      const processedOrder = results[i];
      
      // Check for items without prices that should have them
      const itemsWithMissingPrices = processedOrder.items.filter(item => !item.price);
      if (itemsWithMissingPrices.length > 0) {
        console.warn(`Warning: Order ${processedOrder.orderId} has ${itemsWithMissingPrices.length} items with missing prices`);
        // We'll capture this when we get the HTML content in processShipmentElements
      }
      
      // Check for different item counts (potential duplication issue)
      if (originalOrder.items.length !== processedOrder.items.length) {
        console.warn(`Warning: Order ${processedOrder.orderId} has different item counts before (${originalOrder.items.length}) and after (${processedOrder.items.length}) processing`);
        // We'll also capture this when we have the HTML content
      }
    }
  }
  
  /**
   * Check for issues in the shipment elements processing
   */
  private checkForShipmentIssues(shipmentElements: string[], order: OrderDetails, resultItems: ItemDetails[]): void {
    if (!this.testCaptureEnabled) return;
    
    // Check for duplicate items
    const itemTitles = resultItems.map(item => item.title);
    const uniqueTitles = new Set(itemTitles);
    
    if (itemTitles.length !== uniqueTitles.size) {
      console.warn(`Warning: Potential duplicate items detected in order ${order.orderId}`);
      this.captureTestCase(
        'duplicate-items',
        order.orderId,
        shipmentElements.join('\n'),
        order,
        resultItems
      );
    }
    
    // Check for missing prices
    const itemsWithoutPrices = resultItems.filter(item => !item.price);
    if (itemsWithoutPrices.length > 0 && itemsWithoutPrices.length !== resultItems.length) {
      // Only capture if some items have prices but others don't
      console.warn(`Warning: Some items have prices but ${itemsWithoutPrices.length} don't in order ${order.orderId}`);
      this.captureTestCase(
        'missing-prices',
        order.orderId,
        shipmentElements.join('\n'),
        order,
        resultItems
      );
    }
    
    // Check for item count mismatch
    if (order.items.length !== resultItems.length) {
      console.warn(`Warning: Item count mismatch in order ${order.orderId}: ${order.items.length} before, ${resultItems.length} after`);
      this.captureTestCase(
        'item-count-mismatch',
        order.orderId,
        shipmentElements.join('\n'),
        order,
        resultItems
      );
    }
  }
  
  /**
   * Capture a test case for later analysis
   */
  private captureTestCase(
    issueType: string,
    orderId: string,
    html: string,
    originalOrder: OrderDetails,
    processedItems: ItemDetails[]
  ): void {
    if (!this.testCaptureEnabled) return;
    
    // Create a unique ID for this test case
    const timestamp = new Date().toISOString().replace(/[:\.]/g, '-');
    const hash = crypto.createHash('md5').update(html).digest('hex').substring(0, 8);
    const testId = `${issueType}-${orderId}-${timestamp}-${hash}`;
    
    // Create a directory for this test case
    const testDir = path.join(this.testsDirectory, testId);
    fs.mkdirSync(testDir, { recursive: true });
    
    try {
      // Save the HTML
      fs.writeFileSync(path.join(testDir, 'shipment-elements.html'), html);
      
      // Save the original order
      fs.writeFileSync(
        path.join(testDir, 'original-order.json'),
        JSON.stringify(originalOrder, null, 2)
      );
      
      // Save the processed items
      fs.writeFileSync(
        path.join(testDir, 'processed-items.json'),
        JSON.stringify(processedItems, null, 2)
      );
      
      // Save info about the issue
      fs.writeFileSync(
        path.join(testDir, 'issue-info.json'),
        JSON.stringify({
          issueType,
          orderId,
          timestamp: new Date().toISOString(),
          itemCountBefore: originalOrder.items.length,
          itemCountAfter: processedItems.length,
          itemsWithPrices: processedItems.filter(item => item.price).length,
          itemsWithoutPrices: processedItems.filter(item => !item.price).length
        }, null, 2)
      );
      
      // Generate a test case file that can be directly used
      this.generateTestCase(testDir, testId, issueType, html, originalOrder, processedItems);
      
      console.log(`Test case captured: ${testDir}`);
    } catch (error) {
      console.error('Failed to capture test case:', error);
    }
  }
  
  /**
   * Generate a complete test case file that can be imported and run
   */
  private generateTestCase(
    testDir: string,
    testId: string,
    issueType: string,
    html: string,
    originalOrder: OrderDetails,
    processedItems: ItemDetails[]
  ): void {
    // Create a test file that can be imported and run
    const testCode = `
import { PriceScrapingTestBench } from '../testbench/PriceScrapingTestBench';
import { URL } from 'url';
import { DeliveryStatus } from '../../OrderDetails';

/**
 * Auto-generated test case for issue: ${issueType}
 * Order ID: ${originalOrder.orderId}
 * Generated: ${new Date().toISOString()}
 */
describe('${testId}', () => {
  it('should correctly process the order', async () => {
    const testBench = new PriceScrapingTestBench();
    
    // Add this test case
    testBench.addTestCase({
      name: '${testId}',
      html: \`${html.replace(/`/g, '\\`')}\`,
      orderBefore: ${JSON.stringify(originalOrder, null, 2).replace(/\"url\":.*?\}/g, '"url": new URL("' + originalOrder.url.toString() + '")')},
      expectedItems: ${JSON.stringify(processedItems, null, 2)}
    });
    
    // Run the test
    const results = await testBench.runTests();
    expect(results.failed).toBe(0);
  });
});
`;

    fs.writeFileSync(path.join(testDir, `${testId}.test.ts`), testCode);
  }
  
  /**
   * Capture an error case
   */
  private captureErrorCase(orders: OrderDetails[], error: any): void {
    if (!this.testCaptureEnabled) return;
    
    // Create a unique ID for this error case
    const timestamp = new Date().toISOString().replace(/[:\.]/g, '-');
    const errorMessage = error.message || 'unknown-error';
    const cleanedErrorMessage = errorMessage.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30);
    const testId = `error-${cleanedErrorMessage}-${timestamp}`;
    
    // Create a directory for this error case
    const testDir = path.join(this.testsDirectory, testId);
    fs.mkdirSync(testDir, { recursive: true });
    
    try {
      // Save the orders
      fs.writeFileSync(
        path.join(testDir, 'orders.json'),
        JSON.stringify(orders, null, 2)
      );
      
      // Save the error
      fs.writeFileSync(
        path.join(testDir, 'error.json'),
        JSON.stringify({
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        }, null, 2)
      );
      
      console.log(`Error case captured: ${testDir}`);
    } catch (captureError) {
      console.error('Failed to capture error case:', captureError);
    }
  }
  
  /**
   * Capture an error in shipment element processing
   */
  private captureShipmentErrorCase(shipmentElements: string[], order: OrderDetails, error: any): void {
    if (!this.testCaptureEnabled) return;
    
    // Create a unique ID for this error case
    const timestamp = new Date().toISOString().replace(/[:\.]/g, '-');
    const errorMessage = error.message || 'unknown-error';
    const cleanedErrorMessage = errorMessage.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30);
    const testId = `shipment-error-${order.orderId}-${cleanedErrorMessage}-${timestamp}`;
    
    // Create a directory for this error case
    const testDir = path.join(this.testsDirectory, testId);
    fs.mkdirSync(testDir, { recursive: true });
    
    try {
      // Save the shipment elements
      fs.writeFileSync(
        path.join(testDir, 'shipment-elements.html'),
        shipmentElements.join('\n')
      );
      
      // Save the order
      fs.writeFileSync(
        path.join(testDir, 'order.json'),
        JSON.stringify(order, null, 2)
      );
      
      // Save the error
      fs.writeFileSync(
        path.join(testDir, 'error.json'),
        JSON.stringify({
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        }, null, 2)
      );
      
      console.log(`Shipment error case captured: ${testDir}`);
    } catch (captureError) {
      console.error('Failed to capture shipment error case:', captureError);
    }
  }
}