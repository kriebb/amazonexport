import { ItemDetails } from './ItemDetails';

export enum DeliveryStatus {
  Delivered = 'Delivered',
  Returned = 'Returned',
  ProcessingRefund = 'ProcessingRefund',
  Undeliverable = 'Undeliverable',
  Expected = 'Expected',
  PossiblyLost = 'PossiblyLost',
  Refunded = 'Refunded',
  Unknown = 'Unknown'
}

export interface OrderDetails {
  url: URL;
  orderId: string;
  orderTotal: string;
  deliveryStatus:  DeliveryStatus;
  deliveryDate: string;
  items: ItemDetails[];
  orderPlacedDate: string;
}
