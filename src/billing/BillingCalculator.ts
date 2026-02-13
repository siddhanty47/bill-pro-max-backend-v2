/**
 * @file Billing Calculator
 * @description Main class for handling rental billing calculations
 */

import {
  BillingCalculation,
  BillingConfig,
  BillingPeriod,
  CalculatedBillItem,
  CalculationOptions,
  InventoryUtilization,
  PaymentSummary,
  ProfitabilityReport,
  Agreement,
  ChallanForBilling,
  PartyForBilling,
  BillForCalculation,
} from '../types/domain';
import { calculateDaysBetween } from './utils/dateUtils';
import { roundTo, calculateTax, calculateDiscount, addWithPrecision } from './utils/mathUtils';

/**
 * Default billing configuration
 */
const DEFAULT_CONFIG: BillingConfig = {
  defaultTaxRate: 18,
  defaultDiscountRate: 0,
  roundingPrecision: 2,
  currency: 'INR',
  lateFeeRate: 0.05,
};

/**
 * Billing Calculator class
 * Handles all rental billing calculations
 */
export class BillingCalculator {
  private config: BillingConfig;

  /**
   * Create a new BillingCalculator
   * @param config - Billing configuration
   */
  constructor(config?: Partial<BillingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate billing for a specific period based on delivered/returned items
   * @param party - Client party
   * @param agreement - Agreement with terms and rates
   * @param period - Billing period
   * @param deliveryChallans - Delivery challans in the period
   * @param returnChallans - Return challans in the period
   * @param options - Calculation options
   * @returns Billing calculation result
   */
  calculatePeriodBilling(
    party: PartyForBilling,
    agreement: Agreement,
    period: BillingPeriod,
    deliveryChallans: ChallanForBilling[],
    returnChallans: ChallanForBilling[],
    options: CalculationOptions
  ): BillingCalculation {
    // Calculate item-wise rental days and amounts
    const billItems = this.calculateRentalDaysPerItem(
      deliveryChallans,
      returnChallans,
      agreement,
      period
    );

    // Calculate subtotal
    const subtotal = billItems.reduce((sum, item) => sum + item.subtotal, 0);

    // Apply tax and discount
    const taxRate = options.includeTax ? this.config.defaultTaxRate : 0;
    const taxAmount = options.includeTax
      ? calculateTax(subtotal, taxRate, this.config.roundingPrecision)
      : 0;

    const discountRate = options.includeDiscount ? this.config.defaultDiscountRate : 0;
    const discountAmount = options.includeDiscount
      ? calculateDiscount(subtotal, discountRate, this.config.roundingPrecision)
      : 0;

    // Calculate total
    const totalAmount = subtotal + taxAmount - discountAmount;

    return {
      billId: `bill_${Date.now()}`,
      partyId: party._id,
      agreementId: agreement.agreementId,
      billingPeriod: period,
      items: billItems,
      subtotal: roundTo(subtotal, this.config.roundingPrecision),
      taxRate,
      taxAmount: roundTo(taxAmount, this.config.roundingPrecision),
      discountRate,
      discountAmount: roundTo(discountAmount, this.config.roundingPrecision),
      totalAmount: roundTo(totalAmount, this.config.roundingPrecision),
      currency: this.config.currency,
      calculatedAt: new Date(),
    };
  }

  /**
   * Calculate rental days per item based on delivery and return challans
   * @param deliveryChallans - Delivery challans
   * @param returnChallans - Return challans
   * @param agreement - Agreement with rates
   * @param period - Billing period
   * @returns Array of calculated bill items
   */
  private calculateRentalDaysPerItem(
    deliveryChallans: ChallanForBilling[],
    returnChallans: ChallanForBilling[],
    agreement: Agreement,
    period: BillingPeriod
  ): CalculatedBillItem[] {
    const itemRentalMap = new Map<
      string,
      {
        itemName: string;
        totalQuantity: number;
        totalDays: number;
        rate: number;
      }
    >();

    // Process delivery challans
    deliveryChallans.forEach(challan => {
      if (challan.type !== 'delivery') return;

      challan.items.forEach(item => {
        const itemId = item.itemId.toString();
        const rate = this.getItemRateFromAgreement(itemId, agreement);
        const deliveryDate = new Date(challan.date);

        // Calculate days from delivery to end of period (or return date)
        const returnDate = this.findReturnDateForItem(itemId, returnChallans, deliveryDate);
        const effectiveEndDate =
          returnDate && returnDate <= period.end ? returnDate : period.end;
        const effectiveStartDate =
          deliveryDate >= period.start ? deliveryDate : period.start;
        const rentalDays = Math.max(
          0,
          calculateDaysBetween(effectiveStartDate, effectiveEndDate)
        );

        const existing = itemRentalMap.get(itemId) || {
          itemName: item.itemName,
          totalQuantity: 0,
          totalDays: 0,
          rate,
        };

        existing.totalQuantity += item.quantity;
        existing.totalDays = Math.max(existing.totalDays, rentalDays);
        itemRentalMap.set(itemId, existing);
      });
    });

    // Convert to bill items
    return Array.from(itemRentalMap.entries()).map(([itemId, data]) => ({
      itemId,
      itemName: data.itemName,
      quantity: data.totalQuantity,
      ratePerDay: data.rate,
      totalDays: data.totalDays,
      subtotal: roundTo(
        data.totalQuantity * data.rate * data.totalDays,
        this.config.roundingPrecision
      ),
    }));
  }

  /**
   * Get item rate from agreement
   * @param itemId - Item ID
   * @param agreement - Agreement
   * @returns Rate per day
   */
  private getItemRateFromAgreement(itemId: string, agreement: Agreement): number {
    const rate = agreement.rates.find(r => r.itemId.toString() === itemId);
    return rate ? rate.ratePerDay : 0;
  }

  /**
   * Find return date for a specific item
   * @param itemId - Item ID
   * @param returnChallans - Return challans
   * @param afterDate - Date after which to look for returns
   * @returns Return date or null
   */
  private findReturnDateForItem(
    itemId: string,
    returnChallans: ChallanForBilling[],
    afterDate: Date
  ): Date | null {
    for (const challan of returnChallans) {
      if (challan.type !== 'return') continue;
      if (new Date(challan.date) >= afterDate) {
        const returnItem = challan.items.find(item => item.itemId.toString() === itemId);
        if (returnItem) {
          return new Date(challan.date);
        }
      }
    }
    return null;
  }

  /**
   * Calculate inventory utilization for a given period
   * @param inventory - Inventory items
   * @param deliveryChallans - Delivery challans in period
   * @param returnChallans - Return challans in period
   * @returns Array of inventory utilization data
   */
  calculateInventoryUtilization(
    inventory: Array<{
      _id: string;
      name: string;
      totalQuantity: number;
    }>,
    deliveryChallans: ChallanForBilling[],
    returnChallans: ChallanForBilling[]
  ): InventoryUtilization[] {
    return inventory.map(item => {
      const deliveredQty = this.getTotalDeliveredQuantity(item._id, deliveryChallans);
      const returnedQty = this.getTotalReturnedQuantity(item._id, returnChallans);
      const currentlyRented = deliveredQty - returnedQty;

      const utilizationPercentage =
        item.totalQuantity > 0 ? (currentlyRented / item.totalQuantity) * 100 : 0;

      return {
        itemId: item._id,
        itemName: item.name,
        totalQuantity: item.totalQuantity,
        rentedQuantity: currentlyRented,
        availableQuantity: item.totalQuantity - currentlyRented,
        utilizationPercentage: roundTo(utilizationPercentage, 2),
        revenueGenerated: 0, // Would need billing data to calculate
      };
    });
  }

  /**
   * Get total delivered quantity for an item
   * @param itemId - Item ID
   * @param deliveryChallans - Delivery challans
   * @returns Total delivered quantity
   */
  private getTotalDeliveredQuantity(
    itemId: string,
    deliveryChallans: ChallanForBilling[]
  ): number {
    return deliveryChallans
      .filter(challan => challan.type === 'delivery')
      .reduce((total, challan) => {
        const item = challan.items.find(i => i.itemId.toString() === itemId);
        return total + (item ? item.quantity : 0);
      }, 0);
  }

  /**
   * Get total returned quantity for an item
   * @param itemId - Item ID
   * @param returnChallans - Return challans
   * @returns Total returned quantity
   */
  private getTotalReturnedQuantity(
    itemId: string,
    returnChallans: ChallanForBilling[]
  ): number {
    return returnChallans
      .filter(challan => challan.type === 'return')
      .reduce((total, challan) => {
        const item = challan.items.find(i => i.itemId.toString() === itemId);
        return total + (item ? item.quantity : 0);
      }, 0);
  }

  /**
   * Calculate payment summary
   * @param bills - All bills
   * @param payments - All payments
   * @returns Payment summary
   */
  calculatePaymentSummary(
    bills: BillForCalculation[],
    payments: Array<{
      type: 'receivable' | 'payable';
      amount: number;
      status: string;
      billId?: string;
      purchaseId?: string;
    }>
  ): PaymentSummary {
    const totalReceivable = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);

    const receivablePayments = payments.filter(p => p.type === 'receivable');
    const totalReceived = receivablePayments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);

    const totalPending = receivablePayments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0);

    // Calculate overdue
    const now = new Date();
    const totalOverdue = bills
      .filter(bill => bill.status !== 'paid' && bill.status !== 'cancelled' && new Date(bill.dueDate) < now)
      .reduce((sum, bill) => sum + bill.totalAmount, 0);

    const payablePayments = payments.filter(p => p.type === 'payable');
    const totalPaid = payablePayments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingPayable = payablePayments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      totalReceivable: roundTo(totalReceivable, this.config.roundingPrecision),
      totalReceived: roundTo(totalReceived, this.config.roundingPrecision),
      totalPending: roundTo(totalPending, this.config.roundingPrecision),
      totalOverdue: roundTo(totalOverdue, this.config.roundingPrecision),
      totalPayable: roundTo(totalPaid + pendingPayable, this.config.roundingPrecision),
      totalPaid: roundTo(totalPaid, this.config.roundingPrecision),
      pendingPayable: roundTo(pendingPayable, this.config.roundingPrecision),
    };
  }

  /**
   * Calculate profitability report for a period
   * @param bills - Bills in the period
   * @param purchases - Purchases for cost calculation
   * @param period - Analysis period
   * @returns Profitability report
   */
  calculateProfitabilityReport(
    bills: BillForCalculation[],
    purchases: Array<{ date: Date; totalCost: number }>,
    period: BillingPeriod
  ): ProfitabilityReport {
    const totalRevenue = bills
      .filter(bill => bill.status === 'paid')
      .reduce((sum, bill) => sum + bill.totalAmount, 0);

    const totalExpenses = purchases
      .filter(purchase => {
        const purchaseDate = new Date(purchase.date);
        return purchaseDate >= period.start && purchaseDate <= period.end;
      })
      .reduce((sum, purchase) => sum + purchase.totalCost, 0);

    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      period,
      totalRevenue: roundTo(totalRevenue, this.config.roundingPrecision),
      totalExpenses: roundTo(totalExpenses, this.config.roundingPrecision),
      netProfit: roundTo(netProfit, this.config.roundingPrecision),
      profitMargin: roundTo(profitMargin, 2),
      itemWiseProfitability: [], // Would need detailed item analysis
    };
  }

  /**
   * Calculate late fees for overdue bill
   * @param overdueAmount - Overdue amount
   * @param overdueDays - Number of overdue days
   * @returns Late fee amount
   */
  calculateLateFees(overdueAmount: number, overdueDays: number): number {
    const lateFeeRate = this.config.lateFeeRate || 0.05;
    const lateFee = overdueAmount * (lateFeeRate / 100) * overdueDays;
    return roundTo(lateFee, this.config.roundingPrecision);
  }

  /**
   * Update billing configuration
   * @param newConfig - New configuration values
   */
  updateConfig(newConfig: Partial<BillingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current billing configuration
   * @returns Current configuration
   */
  getConfig(): BillingConfig {
    return { ...this.config };
  }
}

export default BillingCalculator;
