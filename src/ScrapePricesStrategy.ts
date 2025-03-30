import { ElementHandle, Page } from "playwright";
import { OrderProcessingStrategy } from './OrderProcessingStrategy';
import { OrderDetails } from "./OrderDetails";
import { PageTracker } from "./PageTracker";
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { ItemDetails } from "./ItemDetails";
import { prettyPrintHTML } from './prettyPrintHTML';

// Concrete Strategy for Scraping Prices
export class ScrapePricesStrategy implements OrderProcessingStrategy {
  public shipmentsSelector: string = '[data-component="shipments"], .shipment, [data-component="purchasedItems"], .a-box.a-spacing-base';
  public childShipmentSelector: string = '.a-fixed-left-grid-inner, a-fixed-right-grid-inner, .a-fixed-left-grid, .a-fixed-right-grid';
  private logFilePath: string;

  constructor(private orderItemsTemplateUrl: URL, private tracker: PageTracker) {
    this.logFilePath = path.join(__dirname, 'price-scraping-diagnostics.log');
  }

  private logDiagnostics(message: string | object | null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${typeof message === 'string'  ? message : JSON.stringify(message, null, 2)}\n`;
    
    try {
      fs.appendFileSync(this.logFilePath, logMessage);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  public async processShipmentElements(shipmentElements: string[], order: OrderDetails): Promise<ItemDetails[]> {
    const processedItems: ItemDetails[] = [];

    this.logDiagnostics(`Processing ${shipmentElements.length} shipment elements for order ${order.orderId}`);
    this.logDiagnostics(`Original order items: ${JSON.stringify(order.items)}`);

    // Detailed logging of all shipment elements
    shipmentElements.forEach((element, index) => {
      this.logDiagnostics({
        index,
        cleanedHTML: prettyPrintHTML(element),
        originalHTML: element
      });
    });

    for (let shipmentElement of shipmentElements) {
      try {
        const dom = new JSDOM(shipmentElement);
        const shipmentElementBody = dom.window.document.body;
        
        // Extensive price selector attempts
        const priceSelectors = [
          '.a-price-whole',
          '.a-price-fraction',
          '.a-offscreen',
          '.a-color-price',
          '[data-component="unitPrice"] .a-text-price',
          '.yohtmlc-item .a-color-price',
          '.item-price',
          '.a-price .a-offscreen'
        ];

        let extractedPrice: string | undefined = this.extractPrice(shipmentElementBody, priceSelectors);


        // Item link and product ID extraction
        const itemLinkSelectors = [
          '.yohtmlc-item .a-link-normal', 
          '[data-component="itemTitle"] .a-link-normal',
          '.a-link-normal',
          'a[href*="/dp/"]',
          'a[href*="/product/"]',
          '.product-image a'
        ];

        let itemLink: string | null = null;
        let productId: string | null | undefined;
        let itemTitle: string | undefined;

        for (const selector of itemLinkSelectors) {
          const linkElement = shipmentElementBody.querySelector(selector);
          if (linkElement) {
            itemLink = linkElement.getAttribute('href');
            itemTitle = linkElement.textContent?.trim();
            if (itemLink) {
              productId = this.extractProductIdFromUrl(itemLink);
              break;
            }
          }
        }

        // Quantity extraction
        const qtySelectors = [
          '.product-image__qty',
          '.a-badge-text',
          '.item-quantity'
        ];
        let itemQty: string = "1";
        for (const selector of qtySelectors) {
          const qtyElement = shipmentElementBody.querySelector(selector);
          if (qtyElement) {
            itemQty = qtyElement.textContent?.trim() ?? "1";
            break;
          }
        }

        // Detailed logging of extraction attempts
        this.logDiagnostics({
          orderId: order.orderId,
          extractedPrice,
          itemLink,
          productId,
          itemTitle,
          itemQty
        });

        // If productId is found, try to match with order items
        if (productId || itemTitle) {
          const matchingOrderItem = order.items.find(item => 
            // Try multiple matching strategies
            (productId && item.productId?.trim() === productId?.trim()) ||
            (itemTitle && item.title && item.title.includes(itemTitle))
          );

          if (matchingOrderItem) {
            // Update the matched item
            matchingOrderItem.price = extractedPrice ?? matchingOrderItem.price;
            matchingOrderItem.qty = itemQty;
            processedItems.push(matchingOrderItem);
          } else {
            // If no match found, log detailed information
            this.logDiagnostics(`No matching order item found for productId: ${productId}, itemTitle: ${itemTitle}`);
            this.logDiagnostics(`Available order items: ${JSON.stringify(order.items)}`);
          }
        }

      } catch (error) {
        console.error('Error processing shipment element:', error);
        this.logDiagnostics(`Error processing shipment element: ${error}`);
      }
    }

    this.logDiagnostics(`Processed ${processedItems.length} items for order ${order.orderId}`);

    // If no items processed, return original items
    return processedItems.length > 0 ? processedItems : order.items;
  }

  public async process(orders: OrderDetails[]): Promise<OrderDetails[]> {
    this.logDiagnostics(`Starting price scraping for ${orders.length} orders`);

    for (let order of orders) {
      try {
        const orderDetailsUrl: URL = new URL(this.orderItemsTemplateUrl.href.replace('%%ORDER_NUMBER%%', order.orderId || ''));
        this.logDiagnostics(`Navigating to order details URL: ${orderDetailsUrl.href}`);

        await this.tracker.getCurrentPage().goto(orderDetailsUrl.href, { waitUntil: 'load', timeout: 5000 });
        await this.tracker.getCurrentPage().waitForSelector(this.shipmentsSelector, { timeout: 5000 });
        order.url = orderDetailsUrl;

        const pageContent = await this.tracker.getCurrentPage().content();

        const shipmentElements = this.extractShipmentElements(pageContent);
        this.logDiagnostics(`Found ${shipmentElements.length} shipment elements`);

        order.items = await this.processShipmentElements(shipmentElements, order);
      }
      catch (error) {
        console.error('Error while processing order details:', error);
        this.logDiagnostics(`Error processing order ${order.orderId}: ${error}`);
      }
    }
    return orders;
  }

  extractShipmentElements = (pageContent: string) => {
    const shipmentElements: string[] = [];

    try {
      const dom = new JSDOM(pageContent);
      const document = dom.window.document;

      // Extended selectors to capture more potential shipment elements
      const shipmentSelectors = [
        '[data-component="shipments"]', 
        '.shipment', 
        '[data-component="purchasedItems"]', 
        '.a-box.a-spacing-base',
        '.order-items-container'
      ];

      shipmentSelectors.forEach(selector => {
        const pageShipmentElements = document.querySelectorAll<HTMLElement | SVGElement>(selector);
        pageShipmentElements.forEach(pageShipmentElement => {
          const possibleChilds = pageShipmentElement.querySelectorAll<HTMLElement | SVGElement>(this.childShipmentSelector);
          if (possibleChilds.length > 0) {
            possibleChilds.forEach(child => {
              shipmentElements.push(child.innerHTML.trim());
            });
          } else {
            shipmentElements.push(pageShipmentElement.innerHTML.trim());
          }
        });
      });
    }
    catch (error) {
      console.error('Error while extracting shipment elements:', error);
      this.logDiagnostics(`Shipment element extraction error: ${error}`);
    }
    return shipmentElements;
  }

  extractProductIdFromUrl(itemUri: string | undefined): string | null | undefined {
    if (!itemUri) return undefined;
    
    try {
      // Normalize the URL
      const fullUrl = itemUri.startsWith('http') 
        ? itemUri 
        : `https://www.amazon.com.be${itemUri}`;

      const url = new URL(fullUrl);
      const pathParts = url.pathname.split('/').filter(part => part);
      
      // Common Amazon URL patterns
      const productIdCandidates = [
        url.searchParams.get('productId'),  // Check query params first
        pathParts[pathParts.indexOf('dp') + 1],  // After 'dp'
        pathParts.find(part => /^[A-Z0-9]{10,}$/.test(part)),  // Any part with 10+ alphanumeric chars
        pathParts[3],  // Often the product ID
        pathParts[4],  // Backup for 'product' in path
      ];

      const validProductId = productIdCandidates.find(id => 
        id && 
        id !== 'product' && 
        id !== 'dp' && 
        /^[A-Z0-9]+$/.test(id)
      );

      this.logDiagnostics(`Product ID extraction for ${itemUri}: ${validProductId}`);
      return validProductId;
    } catch (error) {
      console.error('Invalid URL for product ID:', itemUri);
      this.logDiagnostics(`Product ID extraction error for ${itemUri}: ${error}`);
      return undefined;
    }
  }
  extractPrice(shipmentElementBody: HTMLElement,priceSelectors: string[]): string | undefined {
    /*let price: string | undefined = undefined;
    const priceElement = shipmentElement.querySelector('.yohtmlc-item .a-color-price , [data-component="unitPrice"] .a-text-price .a-offscreen');
    if (priceElement) {
      price = (priceElement?.textContent)?.trim();
    }
    else {
      console.log('No price element found in' + this.prettyPrintHTML(shipmentElement.outerHTML));
    }
    return price;*/

    let  extractedPrice: string | undefined = undefined;
    for (const selector of priceSelectors) {
      const priceElement = shipmentElementBody.querySelector(selector);
      if (priceElement) {
        extractedPrice = priceElement.textContent?.trim();
        if (extractedPrice) {
          this.logDiagnostics(`Found price with selector: ${selector}, Price: ${extractedPrice}`);
          break;
        }
      }
    }
    return extractedPrice  == null ? undefined : extractedPrice;
  }
}