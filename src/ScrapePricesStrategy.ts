import { ElementHandle, Page } from "playwright";
import { OrderProcessingStrategy } from './OrderProcessingStrategy';
import { OrderDetails } from "./OrderDetails";
import { PageTracker } from "./PageTracker";
import fs from 'fs';
import { ItemDetails } from "./ItemDetails";
import { JSDOM } from 'jsdom';

// Concrete Strategy for Scraping Prices
export class ScrapePricesStrategy implements OrderProcessingStrategy {
  public shipmentsSelector: string = '[data-component="shipments"], .shipment, [data-component="purchasedItems"]';
  public childShipmentSelector: string = '.a-fixed-left-grid-inner, a-fixed-right-grid-inner';


  // #region Constructors (1)
  /**
   *
   */
  constructor(private orderItemsTemplateUrl: URL, private tracker: PageTracker) {
  }

  // #endregion Constructors (1)
  // #region Public Methods (1)

  public async processShipmentElements(shipmentElements: string[], order: OrderDetails): Promise<ItemDetails[]> {
    for (let shipmentElement of shipmentElements) {
      try {
        var dom = new JSDOM(shipmentElement);

        var shipmentElementBody = dom.window.document.body;
        const itemLink = shipmentElementBody.querySelector('.yohtmlc-item .a-link-normal, [data-component="itemTitle"] .a-link-normal');
        let itemUri: string | undefined = undefined;
        let productId: string | undefined = undefined;

        itemUri = (await itemLink?.getAttribute('href')) ?? undefined;
        productId = await this.extractProductIdFromUrl(itemUri);



        let price: string | undefined = await this.extractPrice(shipmentElementBody);


        for (let item of order.items) {
          if (item.productId?.trim() === productId?.trim()) {
            item.price = price?.trim() ?? 'Price not found';
          }
        };
      } catch (error) {
        console.error('Error while processing shipment element:' + error + " " + shipmentElement);
      }


    }

    return order.items;
  }

  public async process(orders: OrderDetails[]): Promise<OrderDetails[]> {
    console.log('Fetching shipment prices and enriching items...');

    for (let order of orders) {

      try {
        const orderDetailsUrl: URL = new URL(this.orderItemsTemplateUrl.href.replace('%%ORDER_NUMBER%%', order.orderId || ''));
        console.log('Navigating to order details URL:', orderDetailsUrl.href);
        await this.tracker.getCurrentPage().goto(orderDetailsUrl.href, { waitUntil: 'load', timeout: 5000 });
        await this.tracker.getCurrentPage().waitForSelector(this.shipmentsSelector, { timeout: 5000 });
        order.url = orderDetailsUrl;

        const pageContent = await this.tracker.getCurrentPage().content();
        console.log('Page content:');
        console.log(pageContent);

        const shipmentElements = this.extractShipmentElements(pageContent);
        console.log('Shipment elements:');
        console.log(shipmentElements);

        console.log('Processing shipment elements...');
        order.items = await this.processShipmentElements(shipmentElements, order);

      }
      catch (error) {
        throw new Error('Error while processing order details: ' + error);

      }
    }
    return orders;

  }
  extractShipmentElements = (pageContent: string) => {
    const shipmentElements: string[] = [];

    try {

      const dom = new JSDOM(pageContent);
      const document = dom.window.document;

      const pageShipmentElements = document.querySelectorAll<HTMLElement | SVGElement>(this.shipmentsSelector);
      for (const pageShipmentElement of pageShipmentElements) {
        const possibleChilds = pageShipmentElement.querySelectorAll<HTMLElement | SVGElement>(this.childShipmentSelector);
        if (possibleChilds.length > 0) {
          possibleChilds.forEach(child => {
            shipmentElements.push(child.innerHTML.trim());
          });
        } else {
          shipmentElements.push(pageShipmentElement.innerHTML.trim());
        }
      }

    }
    catch (error) {
      console.error('Error while extracting shipment elements:' + error + ' for page Content:' + pageContent);
    }
    return shipmentElements;

  }
  extractProductIdFromUrl(itemUri: string | undefined): string | undefined {
    if (!itemUri) return undefined;
    let productId: string | undefined = undefined;
    try {
      productId = itemUri.split("/")[4];
      if (productId === "product") {
        productId = itemUri.split("/")[5];
      }
      if (productId === undefined) {
        console.log('No product id found in item link:', itemUri);
      }
      if (productId.indexOf("?") !== -1) {
        productId = productId.split("?")[0];
      }
    } catch (error) {
      console.error('Invalid URL:', itemUri);
      return undefined;
    }
    return productId;
  };

  extractPrice(shipmentElement: HTMLElement): string | undefined {
    let price: string | undefined = undefined;
    const priceElement = shipmentElement.querySelector('.yohtmlc-item .a-color-price , [data-component="unitPrice"] .a-text-price .a-offscreen');
    if (priceElement) {
      price = (priceElement?.textContent)?.trim();
    }
    else {
      console.log('No price element found in' + this.prettyPrintHTML(shipmentElement.outerHTML));
    }
    return price;
  }




  prettyPrintHTML = (html: string | null | undefined): string => {
    if (!html) return "NO HTML";

    // Create a new DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove all <script> tags
    const scripts = doc.querySelectorAll('script');
    scripts.forEach(script => script.remove());

    // Remove all inline event handlers
    const elements = doc.querySelectorAll('*');
    elements.forEach(element => {
      Array.from(element.attributes).forEach(attr => {
        if (attr.name.startsWith('on')) {
          element.removeAttribute(attr.name);
        }
      });
    });

    // Serialize the document back to a string
    const serializer = new XMLSerializer();
    const formattedHTML = serializer.serializeToString(doc);

    return formattedHTML;
  };
}