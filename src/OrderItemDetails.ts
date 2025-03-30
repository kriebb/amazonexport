export interface OrderItemDetails {
  orderId: string;
  orderPlacedDate: string;
  orderTotal: string;
  orderUrl: URL;
  deliveryStatus: string;
  itemTitle: string;
  itemUrl: string;
  itemReturnPolicy: string;
  itemPrice: string | undefined;
  itemQty: string;
  itemProductId: string;
}
