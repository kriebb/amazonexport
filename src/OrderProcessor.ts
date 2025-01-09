import { OrderDetails } from "./OrderDetails";
import { OrderProcessingStrategy } from "./OrderProcessingStrategy";

// Context Class
export class OrderProcessor {
  // #region Properties (1)
  private strategy: OrderProcessingStrategy;

  // #endregion Properties (1)
  // #region Constructors (1)
  constructor(strategy: OrderProcessingStrategy) {
    this.strategy = strategy;
  }

  // #endregion Constructors (1)
  // #region Public Methods (1)
  public async execute(orders: OrderDetails[]): Promise<OrderDetails[]> {
    return this.strategy.process(orders);
  }
}
