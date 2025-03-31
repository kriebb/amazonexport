// src/ScrapePricesStrategyFactory.ts

import { ScrapePricesStrategy } from './ScrapePricesStrategy';
import { PageTracker } from './PageTracker';
import { TestCaptureDecorator } from './scraping/TestCaptureDecorator';

/**
 * Factory for creating ScrapePricesStrategy instances with test capture capabilities.
 * This allows you to enable/disable test capture based on environment or configuration.
 */
export class ScrapePricesStrategyFactory {
  /**
   * Create a ScrapePricesStrategy instance
   */
  public static create(
    orderItemsTemplateUrl: URL, 
    tracker: PageTracker,
    enableTestCapture: boolean = process.env.NODE_ENV !== 'production'
  ): ScrapePricesStrategy {
    // Create the base strategy
    const baseStrategy = new ScrapePricesStrategy(orderItemsTemplateUrl, tracker);
    
    // If test capture is disabled, return the base strategy
    if (!enableTestCapture) {
      return baseStrategy;
    }
    
    // Otherwise, wrap it with the test capture decorator
    const decorator = new TestCaptureDecorator(baseStrategy);
    return decorator.strategy;
  }
}

// Example usage in Main.ts or OrderOrchestrator.ts:
/*
// Instead of:
const enrichPriceOrderProcessor = new OrderProcessor(
  new ScrapePricesStrategy(this.orderUrlTemplate, this.pageTracker)
);

// Use:
const enrichPriceOrderProcessor = new OrderProcessor(
  ScrapePricesStrategyFactory.create(this.orderUrlTemplate, this.pageTracker)
);
*/