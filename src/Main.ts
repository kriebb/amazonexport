import dotenv from 'dotenv';
import { PageTracker } from './PageTracker';
import { OrderOrchestratorBuilder } from './OrderOrchestratorBuilder';
import { GenerateCSVToshlStrategy } from './GenerateCSVToshlStrategy';
import { OrderProcessor } from './OrderProcessor';

// Load environment variables from .env file
const env = dotenv.config();

const pageTrackers: PageTracker[] = [];

const exportOrders = async (
  initialOrdersOverviewUrl: URL,
  orderUrlTemplate: URL,
  email: string,
  password: string,
  pathToOrdersCsv: string,
  pathToOrderDtailsJson: string,
  pathToOrderDetailsWithPricesJson: string,
  headless: boolean,
  forceScrapeOrders: boolean,
  forceScrapePrices: boolean
) => {
  const pageTracker = new PageTracker(headless);

  try {
    console.log(`Starting export for ${initialOrdersOverviewUrl.hostname}`);

    const orderOrchestrator = new OrderOrchestratorBuilder(
      pageTracker,
      initialOrdersOverviewUrl,
      orderUrlTemplate,
      email,
      password,
      pathToOrderDtailsJson,
      pathToOrderDetailsWithPricesJson
    )
      .withShouldScrapeOrders(forceScrapeOrders)
      .withShouldEnrichPrices(forceScrapePrices)
      .build();

    const orders = await orderOrchestrator.orechestrate();

    // Always generate the CSV file
    const writeOrdersToCsvProcessor = new OrderProcessor(new GenerateCSVToshlStrategy(pathToOrdersCsv));
    await writeOrdersToCsvProcessor.execute(orders);

  } catch (error) {
    console.error(`Error during processing for ${initialOrdersOverviewUrl.hostname}:`, error);
  }
  finally {
    pageTracker.dispose();

  }
};

const main = async () => {
  const email = env.parsed!.EMAIL;
  const password = env.parsed!.PASSWORD;
  const headless = env.parsed!.HEADLESS == 'true';
  const forceScrapeOrders = env.parsed!.FORCE_SCRAPE_ORDERS == 'true';
  const forceScrapePrices = env.parsed!.FORCE_SCRAPE_PRICES == 'true';
  const scrapeAmazonDe = env.parsed!.SCRAPE_AMAZON_DE == 'true';
  const scrapeAmazonBe = env.parsed!.SCRAPE_AMAZON_BE == 'true';
  const year = env.parsed!.YEAR;

  if (scrapeAmazonBe)
    // Amazon Belgium
    await exportOrders(
      new URL('https://www.amazon.com.be/your-orders/orders?timeFilter=year-%%YEAR%%&ref_=ppx_yo2ov_dt_b_filter_all_y-%%YEAR%%&language=nl_BE'.replace('%%YEAR%%', year)),
      new URL('https://www.amazon.com.be/gp/your-account/order-details?ie=UTF8&language=nl_BE&orderID=%%ORDER_NUMBER%%&ref=ppx_pop_dt_b_order_details'),
      email,
      password,
      'orders_be.csv',
      'orderdetails_be.json',
      'orderdetailswithprices_be.json',
      headless,
      forceScrapeOrders,
      forceScrapePrices
    );

  if (scrapeAmazonDe)
    // Amazon Germany
    await exportOrders(
      new URL('https://www.amazon.de/your-orders/orders?timeFilter=year-%%YEAR%%&ref_=ppx_yo2ov_dt_b_filter_all_y-%%YEAR%%&language=nl_NL'.replace('%%YEAR%%', year)),
      new URL('https://www.amazon.de/gp/your-account/order-details?ie=UTF8&language=nl_NL&orderID=%%ORDER_NUMBER%%&ref=ppx_pop_dt_b_order_details'),
      email,
      password,
      'orders_de.csv',
      'orderdetails_de.json',
      'orderdetailswithprices_de.json',
      headless,
      forceScrapeOrders,
      forceScrapePrices
    );

};

// Execute the main function
main().catch(reason => {
  console.error(reason);
  process.exit(1);
}).finally(() => {
});