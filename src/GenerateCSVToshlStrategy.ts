import { DeliveryStatus, OrderDetails } from "./OrderDetails";
import { OrderItemDetails } from "./OrderItemDetails";
import { OrderProcessingStrategy } from "./OrderProcessingStrategy";
import fs from 'fs';
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';

// Concrete Strategy for Generating CSV
export class GenerateCSVToshlStrategy implements OrderProcessingStrategy {
  // #region Constructors (1)

  /**
   *
   */
  constructor(private filePath: string) {
  }

  // #endregion Constructors (1)

  // #region Public Methods (1)

  public async process(orders: OrderDetails[]): Promise<OrderDetails[]> {
    const orderItems: OrderItemDetails[] = [];
    orders.forEach(async order => {
      order.items.forEach(async item => {
        orderItems.push({
          orderId: order.orderId.trim() || "",
          orderPlacedDate: order.orderPlacedDate.trim() || "",
          orderTotal: order.orderTotal.trim() || "",
          orderUrl: order.url,
          deliveryStatus: order.deliveryStatus.trim() || "",
          itemTitle: item.title,
          itemUrl: item.href,
          itemReturnPolicy: item.returnPolicy,
          itemPrice: item.price,
          itemQty: item.qty,
          itemProductId: item.productId,
        });
      });
    });

    console.log(orderItems);
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }

    const csvWriter = createCsvWriter({
      path: this.filePath,
      header: [
        { id: 'orderDate', title: 'Order Date' },
        { id: 'itemDescription', title: 'Order Descriptions' },
        { id: 'itemPrice', title: 'Item Price' },
        { id: 'itemQty', title: 'Item Qty' },
        { id: 'currency', title: 'Currency' },
        { id: 'orderTotal', title: 'Order Total' },
      ]
    });

    // Group items by order ID to handle multi-item orders correctly
    const orderGroups = this.groupItemsByOrder(orderItems);
    
    const records = [];
    
    for (const [orderId, items] of Object.entries(orderGroups)) {
      const orderTotal = this.parseInt(items[0].orderTotal);
      
      // Calculate total of items with known prices
      const itemsWithPrices = items.filter(item => item.itemPrice !== undefined);
      const knownPricesTotal = itemsWithPrices.reduce(
        (sum, item) => sum + (this.parseInt(item.itemQty) * this.parseInt(item.itemPrice!)), 
        0
      );
      
      // Calculate remaining amount for items without prices
      const itemsWithoutPrices = items.filter(item => item.itemPrice === undefined);
      const remainingAmount = Math.max(0, orderTotal - knownPricesTotal);
      
      // Distribute remaining amount among items without prices
      const itemsWithoutPricesCount = itemsWithoutPrices.length;
      let distributedAmount = 0;
      
      // Process items with prices first
      for (const item of itemsWithPrices) {
        records.push(this.createCsvRecord(item, this.parseInt(item.itemPrice!) * this.parseInt(item.itemQty), orderTotal));
      }
      
      // Then distribute remaining amount to items without prices
      for (let i = 0; i < itemsWithoutPricesCount; i++) {
        const item = itemsWithoutPrices[i];
        let itemAmount;
        
        if (i === itemsWithoutPricesCount - 1) {
          // Last item gets whatever is left to ensure exact total
          itemAmount = remainingAmount - distributedAmount;
        } else {
          // Distribute evenly among items
          itemAmount = remainingAmount / itemsWithoutPricesCount;
          distributedAmount += itemAmount;
        }
        
        records.push(this.createCsvRecord(item, itemAmount, orderTotal));
      }
    }

    await csvWriter.writeRecords(records);
    console.log('CSV file written successfully:', this.filePath);
    console.log('Generating CSV for orders:', orders);
    return orders;
  }

  /**
   * Group order items by order ID to handle multi-item orders
   */
  private groupItemsByOrder(orderItems: OrderItemDetails[]): Record<string, OrderItemDetails[]> {
    const groups: Record<string, OrderItemDetails[]> = {};
    
    for (const item of orderItems) {
      if (!groups[item.orderId]) {
        groups[item.orderId] = [];
      }
      groups[item.orderId].push(item);
    }
    
    return groups;
  }
  
  /**
   * Create a CSV record for an item with the correct price allocation
   */
  private createCsvRecord(item: OrderItemDetails, itemPrice: number, orderTotal: number) {
    return {
      orderDate: this.formatDate(item.orderPlacedDate),
      itemDescription: this.parseDeliveryStatus(item.itemReturnPolicy, item.deliveryStatus).status + ' ' 
                       + item.itemTitle + ' [' + item.orderUrl?.href + '] - ' + item.orderId,
      itemPrice: itemPrice,
      itemQty: this.parseInt(item.itemQty),
      currency: 'EUR',
      orderTotal: orderTotal
    };
  }

  parseInt = (moneyStr: string): number => {
    // Remove the currency symbol and any non-numeric characters
    if (!moneyStr) return 0;
    const cleanedStr = moneyStr.replace(/[^\d,.-]/g, '').replace(',', '.');
    // Convert the cleaned string to a number
    const moneyValue = parseFloat(cleanedStr);
    // Return the numerical value
    return isNaN(moneyValue) ? 0 : moneyValue;
  }

  formatDate = (dateStr: string | null): string => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    const months: { [key: string]: string; } = {
      januari: '01',
      februari: '02',
      maart: '03',
      april: '04',
      mei: '05',
      juni: '06',
      juli: '07',
      augustus: '08',
      september: '09',
      oktober: '10',
      november: '11',
      december: '12'
    };

    // Remove any leading or trailing whitespace
    dateStr = dateStr.trim();

    // Check if the date is in the format "DD month YYYY"
    const dateParts = dateStr.split(' ');
    if (dateParts.length === 3) {
      const day = dateParts[0].padStart(2, '0');
      const month = months[dateParts[1].toLowerCase()];
      const year = dateParts[2];
      if (month) {
        return `${year}-${month}-${day}`;
      }
    }

    // Check if the date is in the format "month DD, YYYY"
    const regex = /(\w+)\s+(\d{1,2}),\s+(\d{4})/;
    const match = dateStr.match(regex);
    if (match) {
      const month = months[match[1].toLowerCase()];
      const day = match[2].padStart(2, '0');
      const year = match[3];
      if (month) {
        return `${year}-${month}-${day}`;
      }
    }

    // If the date format is not recognized or month is undefined, return the original string
    return dateStr;
  }

  parseDeliveryStatus = (statusStr: string | null, statusStr2: string | null): { status: DeliveryStatus, date?: string } => {
    if (!statusStr && !statusStr2) return { status: DeliveryStatus.Unknown };

    statusStr = statusStr?.trim().toLowerCase() + " " + statusStr2?.trim().toLowerCase();

    const deliveryDateRegex = /(\d{1,2}) (\w+)$/;
    const match = statusStr.match(deliveryDateRegex);
    let deliveryDate: string | undefined;

    if (match) {
      const day = match[1].padStart(2, '0');
      const month = this.formatDate(`01 ${match[2]} 2024`).split('-')[1]; // Extract month number
      deliveryDate = `2024-${month}-${day}`;
    }

    if (statusStr.includes('bezorgd op') || statusStr.includes('geleverd op')) {
      return { status: DeliveryStatus.Delivered, date: deliveryDate };
    } else if (statusStr.includes('retourzending voltooid') || statusStr.includes('retour verwerkt')) {
      return { status: DeliveryStatus.Returned, date: deliveryDate };
    } else if (statusStr.includes('terugbetaling wordt verwerkt') || statusStr.includes('terugbetaling in behandeling')) {
      return { status: DeliveryStatus.ProcessingRefund, date: deliveryDate };
    } else if (statusStr.includes('onbezorgbaar') || statusStr.includes('niet leverbaar')) {
      return { status: DeliveryStatus.Undeliverable, date: deliveryDate };
    } else if (statusStr.includes('werd verwacht op') || statusStr.includes('verwacht op')) {
      return { status: DeliveryStatus.Expected, date: deliveryDate };
    } else if (statusStr.includes('je pakket is mogelijk zoekgeraakt') || statusStr.includes('pakket mogelijk zoekgeraakt')) {
      return { status: DeliveryStatus.PossiblyLost, date: deliveryDate };
    } else if (statusStr.includes('gerestitueerd') || statusStr.includes('terugbetaald')) {
      return { status: DeliveryStatus.Refunded, date: deliveryDate };
    } else {
      console.log('Unknown delivery status:', statusStr);
      return { status: DeliveryStatus.Unknown, date: deliveryDate };
    }
  };

  // #endregion Public Methods (1)
}