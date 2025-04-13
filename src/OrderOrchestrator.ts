import fs from 'fs';
import { OrderDetails } from './OrderDetails';
import { ScrapeOrdersStrategy } from './ScrapeOrdersStrategy';
import { ScrapePricesStrategy } from './ScrapePricesStrategy';
import { PageTracker } from './PageTracker';
import { getPaginationLinks } from './Utils';
import { OrderProcessor } from './OrderProcessor';

export class OrderOrchestrator {
  constructor(
    private pageTracker: PageTracker,
    private initialOrdersOverviewUrl: URL,
    private orderUrlTemplate: URL,
    private email: string,
    private password: string,
    private pathToOrderDtailsJson: string,
    private pathToOrderDetailsWithPricesJson: string,
    private scrapeOrders: boolean,
    private scrapePrices: boolean
  ) { }


  private async executeScrapeOrders(): Promise<OrderDetails[]> {
    let orders: OrderDetails[] = [];

    const otherOrdersOverviewLinks = await getPaginationLinks(this.pageTracker);
    console.log('Other order overview links:', otherOrdersOverviewLinks);

    const scrapeOrderProcessor = new OrderProcessor(new ScrapeOrdersStrategy(this.pageTracker));
    orders.push(...await scrapeOrderProcessor.execute(orders));

    for (const link of otherOrdersOverviewLinks) {
      await this.pageTracker.getCurrentPage().goto(link, { waitUntil: 'domcontentloaded', timeout: 5000 });
      orders.push(...await scrapeOrderProcessor.execute(orders));
    }

    fs.writeFileSync(this.pathToOrderDtailsJson, JSON.stringify(orders), 'utf8');
    return orders;
  }

  private async executeEnrichWithPrices(orders: OrderDetails[]): Promise<OrderDetails[]> {
    const enrichPriceOrderProcessor = new OrderProcessor(new ScrapePricesStrategy(this.orderUrlTemplate, this.pageTracker));
    orders = await enrichPriceOrderProcessor.execute(orders);

    fs.writeFileSync(this.pathToOrderDetailsWithPricesJson, JSON.stringify(orders), 'utf8');

    return orders;
  }

  private async ensureSession(): Promise<void> {
    if (!this.pageTracker._isLoggedIn) {
      await this.pageTracker.createInitialPage(this.initialOrdersOverviewUrl);
      await this.pageTracker.login(this.email, this.password);
      await this.pageTracker.getCurrentPage().waitForSelector(' .a-pagination', { //entire page should be loaded
        timeout: 10000, // Wait for a maximum of 10 seconds
        state: 'attached'
      });
    }
  }

  public async orechestrate(): Promise<OrderDetails[]> {
    let orders: OrderDetails[] = [];

    // Only ensure session if we need to scrape something
    if (this.scrapeOrders || this.scrapePrices) {
      await this.ensureSession();
    }
    
    // Handle order details
    if (this.scrapeOrders) {
      orders.push(...await this.executeScrapeOrders());
    } else {
      orders.push(...JSON.parse(fs.readFileSync(this.pathToOrderDtailsJson, 'utf8')));
    }
    
    // Handle price enrichment
    if (this.scrapePrices) {
      orders = await this.executeEnrichWithPrices(orders);
    } else {
      orders = JSON.parse(fs.readFileSync(this.pathToOrderDetailsWithPricesJson, 'utf8'));
    }

    return orders;
  }
}