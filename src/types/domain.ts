/**
 * @file Domain types
 * @description Core domain types for business logic
 */

import { Types } from 'mongoose';

/**
 * Billing period interface
 */
export interface BillingPeriod {
  /** Period start date */
  start: Date;
  /** Period end date */
  end: Date;
  /** Total days in period */
  totalDays?: number;
}

/**
 * Billing configuration interface
 */
export interface BillingConfig {
  /** Default tax rate (percentage) */
  defaultTaxRate: number;
  /** Default discount rate (percentage) */
  defaultDiscountRate: number;
  /** Rounding precision */
  roundingPrecision: number;
  /** Currency code */
  currency: string;
  /** Late fee rate (percentage per day) */
  lateFeeRate?: number;
}

/**
 * Calculation options interface
 */
export interface CalculationOptions {
  /** Include tax in calculation */
  includeTax: boolean;
  /** Include discount in calculation */
  includeDiscount: boolean;
  /** Apply late fees */
  applyLateFees: boolean;
  /** Rounding precision */
  roundTo: number;
  /** Currency code */
  currency: string;
}

/**
 * Calculated bill item interface
 */
export interface CalculatedBillItem {
  /** Item ID */
  itemId: string | Types.ObjectId;
  /** Item name */
  itemName: string;
  /** Quantity */
  quantity: number;
  /** Rate per day */
  ratePerDay: number;
  /** Total days */
  totalDays: number;
  /** Subtotal for this item */
  subtotal: number;
  /** Slab period start date (optional for legacy calculations) */
  slabStart?: Date;
  /** Slab period end date (optional for legacy calculations) */
  slabEnd?: Date;
}

/**
 * Billing calculation result interface
 */
export interface BillingCalculation {
  /** Bill ID */
  billId: string;
  /** Party ID */
  partyId: string | Types.ObjectId;
  /** Agreement ID */
  agreementId: string;
  /** Billing period */
  billingPeriod: BillingPeriod;
  /** Calculated items */
  items: CalculatedBillItem[];
  /** Subtotal before tax and discount */
  subtotal: number;
  /** Tax rate */
  taxRate: number;
  /** Tax amount */
  taxAmount: number;
  /** Discount rate */
  discountRate: number;
  /** Discount amount */
  discountAmount: number;
  /** Total amount */
  totalAmount: number;
  /** Currency */
  currency: string;
  /** Calculation timestamp */
  calculatedAt: Date;
}

/**
 * Inventory utilization interface
 */
export interface InventoryUtilization {
  /** Item ID */
  itemId: string | Types.ObjectId;
  /** Item name */
  itemName: string;
  /** Total quantity */
  totalQuantity: number;
  /** Rented quantity */
  rentedQuantity: number;
  /** Available quantity */
  availableQuantity: number;
  /** Utilization percentage */
  utilizationPercentage: number;
  /** Revenue generated */
  revenueGenerated: number;
}

/**
 * Payment summary interface
 */
export interface PaymentSummary {
  /** Total receivable amount */
  totalReceivable: number;
  /** Total received amount */
  totalReceived: number;
  /** Total pending amount */
  totalPending: number;
  /** Total overdue amount */
  totalOverdue: number;
  /** Total payable amount */
  totalPayable: number;
  /** Total paid amount */
  totalPaid: number;
  /** Pending payable amount */
  pendingPayable: number;
}

/**
 * Item profitability interface
 */
export interface ItemProfitability {
  /** Item ID */
  itemId: string | Types.ObjectId;
  /** Item name */
  itemName: string;
  /** Revenue generated */
  revenue: number;
  /** Purchase cost */
  cost: number;
  /** Profit */
  profit: number;
  /** Profit margin percentage */
  profitMargin: number;
}

/**
 * Profitability report interface
 */
export interface ProfitabilityReport {
  /** Report period */
  period: BillingPeriod;
  /** Total revenue */
  totalRevenue: number;
  /** Total expenses */
  totalExpenses: number;
  /** Net profit */
  netProfit: number;
  /** Profit margin percentage */
  profitMargin: number;
  /** Item-wise profitability */
  itemWiseProfitability: ItemProfitability[];
}

/**
 * Agreement rate for billing
 */
export interface AgreementRate {
  /** Item ID */
  itemId: string | Types.ObjectId;
  /** Item name (for bill line items) */
  itemName?: string;
  /** Rate per day */
  ratePerDay: number;
  /** Opening quantity at site when agreement starts */
  openingBalance?: number;
}

/**
 * Agreement for billing
 */
export interface Agreement {
  /** Agreement ID */
  agreementId: string;
  /** Agreement start date */
  startDate: Date;
  /** Billing cycle */
  billingCycle: 'monthly' | 'weekly' | 'yearly';
  /** Payment due days */
  paymentDueDays: number;
  /** Item rates */
  rates: AgreementRate[];
}

/**
 * Challan for billing
 */
export interface ChallanForBilling {
  /** Challan ID */
  _id: string | Types.ObjectId;
  /** Challan type */
  type: 'delivery' | 'return';
  /** Challan date */
  date: Date;
  /** Items */
  items: Array<{
    itemId: string | Types.ObjectId;
    itemName: string;
    quantity: number;
  }>;
}

/**
 * Party for billing
 */
export interface PartyForBilling {
  /** Party ID */
  _id: string | Types.ObjectId;
  /** Party name */
  name: string;
  /** Contact info */
  contact: {
    email?: string;
    phone: string;
  };
}

/**
 * Bill for calculations
 */
export interface BillForCalculation {
  /** Bill ID */
  _id: string | Types.ObjectId;
  /** Total amount */
  totalAmount: number;
  /** Bill status */
  status: string;
  /** Due date */
  dueDate: Date;
}
