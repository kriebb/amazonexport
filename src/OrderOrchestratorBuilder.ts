import fs from 'fs';
import { PageTracker } from './PageTracker';
import { OrderOrchestrator } from './OrderOrchestrator';

export class OrderOrchestratorBuilder {
  private scrapeOrders: boolean = false;
  private scrapePrices: boolean = false;
  private pageTracker: PageTracker;
  private initialOrdersOverviewUrl: URL;
  private orderUrlTemplate: URL;
  private email: string;
  private password: string;
  private pathToOrderDtailsJson: string;
  private pathToOrderDetailsWithPricesJson: string;

  constructor(
    pageTracker: PageTracker,
    initialOrdersOverviewUrl: URL,
    orderUrlTemplate: URL,
    email: string,
    password: string,
    pathToOrderDtailsJson: string,
    pathToOrderDetailsWithPricesJson: string
  ) {
    this.pageTracker = pageTracker;
    this.initialOrdersOverviewUrl = initialOrdersOverviewUrl;
    this.orderUrlTemplate = orderUrlTemplate;
    this.email = email;
    this.password = password;
    this.pathToOrderDtailsJson = pathToOrderDtailsJson;
    this.pathToOrderDetailsWithPricesJson = pathToOrderDetailsWithPricesJson;
  }

  public withShouldScrapeOrders(force: boolean): OrderOrchestratorBuilder {
    this.scrapeOrders = !fs.existsSync(this.pathToOrderDtailsJson);
    if (this.scrapeOrders || force)
      this.scrapeOrders = true;
    return this;
  }

  public withShouldEnrichPrices(force: boolean): OrderOrchestratorBuilder {
    this.scrapePrices = !fs.existsSync(this.pathToOrderDetailsWithPricesJson);
    if (this.scrapePrices || force)
      this.scrapePrices = true;
    return this;
  }

  public build(): OrderOrchestrator {
    return new OrderOrchestrator(
      this.pageTracker,
      this.initialOrdersOverviewUrl,
      this.orderUrlTemplate,
      this.email,
      this.password,
      this.pathToOrderDtailsJson,
      this.pathToOrderDetailsWithPricesJson,
      this.scrapeOrders,
      this.scrapePrices
    );
  }
}