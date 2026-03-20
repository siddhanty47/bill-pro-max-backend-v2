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
import { roundTo, calculateTax, calculateDiscount } from './utils/mathUtils';

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
    const dayMs = 24 * 60 * 60 * 1000;
    const periodStart = this.startOfDay(period.start);
    const periodEnd = this.startOfDay(period.end);
    const periodEndExclusive = this.addDays(periodEnd, 1);

    const itemTimelineMap = new Map<
      string,
      {
        itemName: string;
        ratePerDay: number;
        eventsByDate: Map<number, number>;
      }
    >();

    const appendEvents = (challans: ChallanForBilling[], sign: 1 | -1) => {
      challans.forEach(challan => {
        let challanDate = this.startOfDay(challan.date);
        // For returns, shift the quantity reduction to the next day
        // so that the return date is billed at the pre-return quantity
        if (sign === -1) {
          challanDate = this.addDays(challanDate, 1);
        }
        const challanDay = challanDate.getTime();

        challan.items.forEach(item => {
          const itemId = item.itemId.toString();
          const existing = itemTimelineMap.get(itemId) || {
            itemName: item.itemName,
            ratePerDay: this.getItemRateFromAgreement(itemId, agreement),
            eventsByDate: new Map<number, number>(),
          };

          if (!existing.itemName) {
            existing.itemName = item.itemName;
          }
          if (!existing.ratePerDay) {
            existing.ratePerDay = this.getItemRateFromAgreement(itemId, agreement);
          }

          const delta = roundTo(
            (existing.eventsByDate.get(challanDay) || 0) + sign * item.quantity,
            this.config.roundingPrecision
          );
          existing.eventsByDate.set(challanDay, delta);
          itemTimelineMap.set(itemId, existing);
        });
      });
    };

    appendEvents(deliveryChallans, 1);
    appendEvents(returnChallans, -1);

    const slabItems: CalculatedBillItem[] = [];

    Array.from(itemTimelineMap.entries()).forEach(([itemId, timeline]) => {
      const sortedDays = Array.from(timeline.eventsByDate.keys()).sort((a, b) => a - b);
      if (sortedDays.length === 0) return;

      // TODO(future-optimization): Persist per-agreement monthly opening balances (FY scoped)
      // and compute opening using snapshot + delta challans instead of full-history scans.
      let currentQuantity = sortedDays
        .filter(day => day < periodStart.getTime())
        .reduce((sum, day) => {
          return roundTo(sum + (timeline.eventsByDate.get(day) || 0), this.config.roundingPrecision);
        }, 0);

      const inPeriodDays = sortedDays.filter(
        day => day >= periodStart.getTime() && day <= periodEnd.getTime()
      );
      const boundaries = [
        periodStart.getTime(),
        ...inPeriodDays,
        periodEndExclusive.getTime(),
      ].sort((a, b) => a - b);

      const uniqueBoundaries = Array.from(new Set(boundaries));

      for (let idx = 0; idx < uniqueBoundaries.length - 1; idx++) {
        const boundary = uniqueBoundaries[idx];
        const nextBoundary = uniqueBoundaries[idx + 1];

        currentQuantity = roundTo(
          currentQuantity + (timeline.eventsByDate.get(boundary) || 0),
          this.config.roundingPrecision
        );
        if (currentQuantity < 0) {
          currentQuantity = 0;
        }

        const slabDays = Math.max(0, Math.round((nextBoundary - boundary) / dayMs));
        if (currentQuantity <= 0 || slabDays <= 0) {
          continue;
        }

        const slabStart = new Date(boundary);
        const slabEnd = this.addDays(new Date(nextBoundary), -1);
        const subtotal = roundTo(
          currentQuantity * timeline.ratePerDay * slabDays,
          this.config.roundingPrecision
        );

        slabItems.push({
          itemId,
          itemName: timeline.itemName,
          quantity: currentQuantity,
          ratePerDay: timeline.ratePerDay,
          totalDays: slabDays,
          subtotal,
          slabStart,
          slabEnd,
        });
      }
    });

    return slabItems;
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

  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
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
