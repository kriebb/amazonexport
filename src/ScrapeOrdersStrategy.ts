import { Page } from "playwright";
import { OrderProcessingStrategy } from './OrderProcessingStrategy';
import { ItemDetails } from "./ItemDetails";
import { DeliveryStatus, OrderDetails } from "./OrderDetails";
import { PageTracker } from "./PageTracker";



// Concrete Strategy for Scraping Orders
export class ScrapeOrdersStrategy implements OrderProcessingStrategy {
  // #region Constructors (1)
  /**
   *
   */
  constructor(private tracker: PageTracker) {
  }

  // #endregion Constructors (1)
  // #region Public Methods (1)
  public async process(orders: OrderDetails[]): Promise<OrderDetails[]> {
    console.log('Scraping orders...');

    orders = await this.tracker.getCurrentPage().evaluate(() => {
      const orderCards = document.querySelectorAll<HTMLElement>('.order-card');
      console.log('Number of order cards:', orderCards.length);

      const orders: OrderDetails[] = [];
      for (const card of orderCards) {
        const orderIdElement = card.querySelectorAll<HTMLElement>('.yohtmlc-order-id .a-color-secondary')[1];
        const orderPlacedDateElement = card.querySelector<HTMLElement>('.a-column.a-span3 .a-size-base.a-color-secondary');
        const orderTotalElement = card.querySelector<HTMLElement>('.a-column.a-span2 .a-size-base.a-color-secondary');
        const deliveryStatusElement = card.querySelector<HTMLElement>('.js-shipment-info-container, .yohtmlc-shipment-status-primaryText .a-size-medium');
        const itemsElements = card.querySelectorAll<HTMLElement>('.item-box');
        console.log('Number of items:', itemsElements.length);

        if (!deliveryStatusElement) {
          console.log('No deliveryStatusElement found');
          console.log(card.outerHTML);

        }
        const items: ItemDetails[] = [];
        for (const item of itemsElements) {
          const titleElement = item.querySelector<HTMLElement>('.yohtmlc-product-title');
          if (!titleElement) {
            console.log('No title element found');
            console.log(item.outerHTML);
            continue;
          }
          const itemLinkElement = titleElement.parentElement as HTMLAnchorElement;
          if (!itemLinkElement) {
            console.log('No itemLinkElement.parentElement element found');
            console.log(titleElement.outerHTML);
            continue;
          }
          const returnPolicyElement = item.querySelector<HTMLElement>('.a-button.a-button-base .a-button-text'); // Update selector if needed
          if (!returnPolicyElement) {
            console.log('No returnPolicyElement element found');
            console.log(item.outerHTML);
          }
          const itemQty = item.querySelector<HTMLElement>('.product-image__qty'); // Is only there when there is more than 1 item

          items.push(<ItemDetails>{
            title: titleElement.textContent?.trim(),
            href: itemLinkElement.href?.trim(),
            returnPolicy: returnPolicyElement?.textContent?.trim() ?? "No Return Policy found",
            productId: new URL(itemLinkElement.href, window.location.origin).pathname.split('/')[4]?.trim(),
            qty: itemQty?.textContent?.trim() ?? "1",
            price: undefined,
            description: undefined
          });
        };

        orders.push(<OrderDetails>{
          orderId: orderIdElement ? orderIdElement.textContent?.trim() : undefined,
          orderPlacedDate: orderPlacedDateElement ? orderPlacedDateElement.textContent?.trim() : undefined,
          orderTotal: orderTotalElement ? orderTotalElement.textContent?.trim() : undefined,
          items: items,
          deliveryStatus: deliveryStatusElement ? deliveryStatusElement.textContent?.trim() : undefined,
        });
      };
      return orders;
    });

    return orders;
  }

}

