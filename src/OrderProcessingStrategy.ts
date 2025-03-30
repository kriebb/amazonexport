import { OrderDetails } from "./OrderDetails";

// Define the Strategy Interface

export interface OrderProcessingStrategy {
  // #region Public Methods (1)
  process(orders: OrderDetails[]): Promise<OrderDetails[]>;

}
