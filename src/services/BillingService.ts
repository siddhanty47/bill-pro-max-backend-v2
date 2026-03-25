/**
 * @file Billing Service
 * @description Business logic for billing and invoice management
 */

import { Types } from 'mongoose';
import {
  BillRepository,
  BillFilterOptions,
  ChallanRepository,
  PartyRepository,
  BusinessRepository,
  PaymentRepository,
  InventoryRepository,
  PaginationOptions,
  PaginatedResult,
} from '../repositories';
import { IBill, BillStatus, IParty, IChallan } from '../models';
import { BillingCalculator } from '../billing';
import {
  BillingCalculation,
  CalculationOptions,
  BillingPeriod,
  PaymentSummary,
  ProfitabilityReport,
  Agreement,
  ChallanForBilling,
  PartyForBilling,
} from '../types/domain';
import { NotFoundError, ValidationError, ConflictError } from '../middleware';
import { logger } from '../utils/logger';
import { getFinancialYear, generateBillNumber } from '../utils/helpers';
import { addDays, getMonthStart, getMonthEnd, getPreviousMonthPeriod } from '../billing/utils/dateUtils';
import { calculateTax, calculateDiscount, roundTo } from '../billing/utils/mathUtils';
import { InvoiceGenerator } from '../billing/InvoiceGenerator';
import { addSendInvoiceEmailJob } from '../jobs';
import { NotificationService } from './NotificationService';

/**
 * Generate bill input
 */
export interface GenerateBillInput {
  billDate?: Date;
  partyId: string;
  agreementId: string;
  billingPeriod: {
    start: Date;
    end: Date;
  };
  billSequence?: number;
  taxMode?: 'intra' | 'inter';
  taxRate?: number;
  sgstRate?: number;
  cgstRate?: number;
  igstRate?: number;
  discountRate?: number;
  notes?: string;
}

/**
 * Billing Service class
 */
export class BillingService {
  private billRepository: BillRepository;
  private challanRepository: ChallanRepository;
  private partyRepository: PartyRepository;
  private businessRepository: BusinessRepository;
  private paymentRepository: PaymentRepository;
  private inventoryRepository: InventoryRepository;
  private billingCalculator: BillingCalculator;

  constructor() {
    this.billRepository = new BillRepository();
    this.challanRepository = new ChallanRepository();
    this.partyRepository = new PartyRepository();
    this.businessRepository = new BusinessRepository();
    this.paymentRepository = new PaymentRepository();
    this.inventoryRepository = new InventoryRepository();
    this.billingCalculator = new BillingCalculator();
  }

  /**
   * Get bills for a business
   * @param businessId - Business ID
   * @param filters - Filter options
   * @param pagination - Pagination options
   * @returns Paginated bills
   */
  async getBills(
    businessId: string,
    filters: BillFilterOptions = {},
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<IBill>> {
    return this.billRepository.findByBusiness(businessId, filters, pagination);
  }

  /**
   * Get bill by ID
   * @param businessId - Business ID
   * @param billId - Bill ID
   * @returns Bill
   */
  async getBillById(businessId: string, billId: string): Promise<IBill> {
    const bill = await this.billRepository.findByIdInBusiness(businessId, billId);
    if (!bill) {
      throw new NotFoundError('Bill');
    }
    return bill;
  }

  /**
   * Generate a bill for a party and period
   * @param businessId - Business ID
   * @param input - Bill generation input
   * @returns Created bill
   */
  async generateBill(businessId: string, input: GenerateBillInput): Promise<IBill> {
    // Check if bill already exists for this period
    const existingBill = await this.billRepository.findByPeriod(
      businessId,
      input.partyId,
      input.agreementId,
      input.billingPeriod.start
    );
    if (existingBill) {
      throw new ConflictError(
        'Bill already exists for this period. Delete the existing bill to regenerate.'
      );
    }

    // Get party and validate agreement
    const business = await this.businessRepository.findById(businessId);
    if (!business || !business.isActive) {
      throw new NotFoundError('Business');
    }

    const party = await this.partyRepository.findByIdInBusiness(businessId, input.partyId);
    if (!party) {
      throw new NotFoundError('Party');
    }

    const agreement = party.agreements.find(a => a.agreementId === input.agreementId);
    if (!agreement) {
      throw new NotFoundError('Agreement');
    }

    // Get all challans up to period end for opening carry + in-period slab calculations
    const challans = await this.challanRepository.findByPartyAgreementUpToDate(
      businessId,
      input.partyId,
      input.agreementId,
      input.billingPeriod.end
    );

    const partyChallans = challans.filter(c => c.status === 'confirmed');
    const inPeriodPartyChallans = partyChallans.filter(c => {
      const challanDate = new Date(c.date);
      return challanDate >= input.billingPeriod.start && challanDate <= input.billingPeriod.end;
    });

    const deliveryChallans = partyChallans.filter(c => c.type === 'delivery');
    const returnChallans = partyChallans.filter(c => c.type === 'return');

    // Convert to billing format
    const partyForBilling: PartyForBilling = {
      _id: party._id,
      name: party.name,
      contact: {
        email: party.contact.email,
        phone: party.contact.phone,
      },
    };

    // Look up item names for agreement rates (needed for opening-balance-only items)
    const rateItemIds = agreement.rates.map(r => r.itemId);
    const inventoryItems = await this.inventoryRepository.find({
      _id: { $in: rateItemIds },
    });
    const itemNameMap = new Map(inventoryItems.map(i => [i._id.toString(), i.name]));

    const agreementForBilling: Agreement = {
      agreementId: agreement.agreementId,
      startDate: agreement.startDate,
      billingCycle: agreement.terms.billingCycle,
      paymentDueDays: agreement.terms.paymentDueDays,
      rates: agreement.rates.map(r => ({
        itemId: r.itemId,
        itemName: itemNameMap.get(r.itemId.toString()) ?? '',
        ratePerDay: r.ratePerDay,
        openingBalance: r.openingBalance ?? 0,
      })),
    };

    const challansForBilling: ChallanForBilling[] = partyChallans.map(c => ({
      _id: c._id,
      type: c.type,
      date: c.date,
      items: c.items.map(i => ({
        itemId: i.itemId,
        itemName: i.itemName,
        quantity: i.quantity,
      })),
    }));

    const period: BillingPeriod = {
      start: input.billingPeriod.start,
      end: input.billingPeriod.end,
    };

    const options: CalculationOptions = {
      includeTax: false,
      includeDiscount: false,
      applyLateFees: false,
      roundTo: 2,
      currency: 'INR',
    };

    // Calculate billing
    const calculation = this.billingCalculator.calculatePeriodBilling(
      partyForBilling,
      agreementForBilling,
      period,
      challansForBilling.filter(c => c.type === 'delivery'),
      challansForBilling.filter(c => c.type === 'return'),
      options
    );

    // Transportation charges are added to taxable subtotal (before GST).
    const transportationBreakup: Array<{
      challanNumber: string;
      challanType: 'delivery' | 'return';
      cartageCharge: number;
      loadingCharge: number;
      unloadingCharge: number;
      totalCharge: number;
    }> = [];
    let transportationSubtotal = 0;

    for (const challan of inPeriodPartyChallans) {
      const cartage = challan.cartageCharge || 0;
      const loading = challan.loadingCharge || 0;
      const unloading = challan.unloadingCharge || 0;
      const total = cartage + loading + unloading;
      if (total > 0) {
        transportationBreakup.push({
          challanNumber: challan.challanNumber,
          challanType: challan.type,
          cartageCharge: cartage,
          loadingCharge: loading,
          unloadingCharge: unloading,
          totalCharge: total,
        });
        transportationSubtotal += total;
      }
    }

    // Damage charges from return challans in-period
    const inPeriodReturnChallans = inPeriodPartyChallans.filter(c => c.type === 'return');
    const allDamageItems: Array<{
      itemId: string;
      itemName: string;
      quantity: number;
      damageRate: number;
      amount: number;
      note?: string;
      lossType?: 'damage' | 'short' | 'need_repair';
      challanNumber?: string;
    }> = [];

    for (const challan of inPeriodReturnChallans) {
      const damagedItems = (challan as any).damagedItems || [];
      for (const d of damagedItems) {
        const amount = roundTo(d.quantity * d.damageRate, 2);
        allDamageItems.push({
          itemId: d.itemId.toString(),
          itemName: d.itemName,
          quantity: d.quantity,
          damageRate: d.damageRate,
          amount,
          note: d.note,
          lossType: d.lossType ?? 'damage',
          challanNumber: challan.challanNumber,
        });
      }
    }

    const damageChargesSubtotal = allDamageItems.reduce((sum, d) => sum + d.amount, 0);

    const subtotalBeforeTax = roundTo(
      calculation.subtotal + transportationSubtotal + damageChargesSubtotal,
      2
    );
    const legacyDefaultTaxRate = business.settings.defaultTaxRate ?? 0;
    const defaultSgstRate = business.settings.defaultSgstRate ?? legacyDefaultTaxRate / 2;
    const defaultCgstRate = business.settings.defaultCgstRate ?? legacyDefaultTaxRate / 2;
    const defaultIgstRate = business.settings.defaultIgstRate ?? legacyDefaultTaxRate;

    const taxMode = input.taxMode ?? 'intra';
    const sgstRate =
      taxMode === 'intra'
        ? input.sgstRate ?? (input.taxRate !== undefined ? input.taxRate / 2 : defaultSgstRate)
        : 0;
    const cgstRate =
      taxMode === 'intra'
        ? input.cgstRate ?? (input.taxRate !== undefined ? input.taxRate / 2 : defaultCgstRate)
        : 0;
    const igstRate =
      taxMode === 'inter'
        ? input.igstRate ?? (input.taxRate !== undefined ? input.taxRate : defaultIgstRate)
        : 0;

    const sgstAmount = roundTo(calculateTax(subtotalBeforeTax, sgstRate, 2), 2);
    const cgstAmount = roundTo(calculateTax(subtotalBeforeTax, cgstRate, 2), 2);
    const igstAmount = roundTo(calculateTax(subtotalBeforeTax, igstRate, 2), 2);
    const taxAmount = roundTo(sgstAmount + cgstAmount + igstAmount, 2);
    const effectiveTaxRate = roundTo(sgstRate + cgstRate + igstRate, 2);
    const discountRate = input.discountRate ?? 0;
    const discountAmount = roundTo(
      calculateDiscount(subtotalBeforeTax, discountRate, 2),
      2
    );
    const totalAmount = roundTo(
      subtotalBeforeTax + taxAmount - discountAmount,
      2
    );

    // Generate bill number (format: PartyCode-SiteCode-FY-Month-NNNN)
    let billNumber: string;
    if (input.billSequence != null) {
      const fy = getFinancialYear(input.billingPeriod.start);
      const month = String(input.billingPeriod.start.getMonth() + 1).padStart(2, '0');
      billNumber = generateBillNumber(party.code.toUpperCase(), agreement.siteCode.toUpperCase(), fy, month, input.billSequence);
      const exists = await this.billRepository.existsByBillNumber(businessId, billNumber);
      if (exists) {
        throw new ValidationError('Bill number already in use');
      }
    } else {
      billNumber = await this.billRepository.getNextBillNumber(
        businessId,
        party.code,
        agreement.siteCode,
        input.billingPeriod.start
      );
    }

    // Calculate due date
    const dueDate = addDays(new Date(), agreement.terms.paymentDueDays);

    // Bill date: from input or fallback to period end
    const billDate = input.billDate
      ? new Date(input.billDate)
      : new Date(input.billingPeriod.end);

    // Create bill
    const bill = await this.billRepository.create({
      businessId: new Types.ObjectId(businessId),
      billNumber,
      partyId: new Types.ObjectId(input.partyId),
      agreementId: input.agreementId,
      billingPeriod: {
        start: input.billingPeriod.start,
        end: input.billingPeriod.end,
      },
      billDate,
      items: calculation.items.map(i => ({
        itemId: new Types.ObjectId(i.itemId.toString()),
        itemName: i.itemName,
        quantity: i.quantity,
        ratePerDay: i.ratePerDay,
        totalDays: i.totalDays,
        amount: i.subtotal,
        slabStart: i.slabStart,
        slabEnd: i.slabEnd,
      })),
      subtotal: subtotalBeforeTax,
      taxRate: effectiveTaxRate,
      taxMode,
      sgstRate,
      cgstRate,
      igstRate,
      sgstAmount,
      cgstAmount,
      igstAmount,
      taxAmount,
      discountRate,
      discountAmount,
      totalAmount,
      currency: calculation.currency,
      status: 'draft',
      dueDate,
      amountPaid: 0,
      notes: input.notes,
      transportationCharges: transportationSubtotal,
      damageItems: allDamageItems.map(d => ({
        itemId: new Types.ObjectId(d.itemId),
        itemName: d.itemName,
        quantity: d.quantity,
        damageRate: d.damageRate,
        amount: d.amount,
        note: d.note,
        lossType: d.lossType,
        challanNumber: d.challanNumber,
      })),
      damageCharges: damageChargesSubtotal,
      transportationBreakup,
      isStale: false,
    });

    logger.info('Bill generated', {
      businessId,
      billId: bill._id,
      billNumber,
      partyId: input.partyId,
      transportationSubtotal,
      damageChargesSubtotal,
      totalAmount,
    });

    return bill;
  }

  /**
   * Get the predicted next bill number for a party + agreement + period.
   */
  async getNextBillNumber(
    businessId: string,
    partyId: string,
    agreementId: string,
    periodStart: Date
  ): Promise<string> {
    const party = await this.partyRepository.findByIdInBusiness(businessId, partyId);
    if (!party) {
      throw new NotFoundError('Party');
    }

    const agreement = party.agreements.find(a => a.agreementId === agreementId);
    if (!agreement) {
      throw new NotFoundError('Agreement');
    }

    return this.billRepository.getNextBillNumber(
      businessId,
      party.code,
      agreement.siteCode,
      periodStart
    );
  }

  /**
   * Generate bills for all active agreements (monthly billing)
   * @param businessId - Business ID
   * @param period - Billing period (defaults to previous month)
   * @returns Array of generated bills
   */
  async generateMonthlyBills(
    businessId: string,
    period?: BillingPeriod
  ): Promise<IBill[]> {
    const billingPeriod = period || getPreviousMonthPeriod();

    // Get all parties with active agreements
    const parties = await this.partyRepository.findWithActiveAgreements(businessId);

    const generatedBills: IBill[] = [];

    for (const party of parties) {
      const activeAgreement = party.agreements.find(a => a.status === 'active');
      if (!activeAgreement) continue;

      try {
        const bill = await this.generateBill(businessId, {
          partyId: party._id.toString(),
          agreementId: activeAgreement.agreementId,
          billingPeriod: {
            start: billingPeriod.start,
            end: billingPeriod.end,
          },
          billDate: new Date(billingPeriod.end),
        });
        generatedBills.push(bill);
      } catch (error) {
        logger.error('Failed to generate bill for party', {
          businessId,
          partyId: party._id,
          error,
        });
      }
    }

    logger.info('Monthly bills generated', {
      businessId,
      count: generatedBills.length,
      period: billingPeriod,
    });

    return generatedBills;
  }

  /**
   * Get overdue bills
   * @param businessId - Business ID
   * @returns Array of overdue bills
   */
  async getOverdueBills(businessId: string): Promise<IBill[]> {
    return this.billRepository.findOverdue(businessId);
  }

  /**
   * Mark bills as overdue
   * @param businessId - Business ID
   * @returns Number of bills marked as overdue
   */
  async markOverdueBills(businessId: string): Promise<number> {
    const overdueBills = await this.billRepository.findOverdue(businessId);
    
    let count = 0;
    for (const bill of overdueBills) {
      if (bill.status !== 'overdue') {
        await this.billRepository.updateStatus(bill._id, 'overdue');
        count++;
      }
    }

    logger.info('Bills marked as overdue', { businessId, count });

    return count;
  }

  /**
   * Update bill status
   * @param businessId - Business ID
   * @param billId - Bill ID
   * @param status - New status
   * @returns Updated bill
   */
  async updateBillStatus(
    businessId: string,
    billId: string,
    status: BillStatus
  ): Promise<IBill> {
    await this.getBillById(businessId, billId);

    const updated = await this.billRepository.updateStatus(billId, status);
    if (!updated) {
      throw new NotFoundError('Bill');
    }

    logger.info('Bill status updated', { businessId, billId, status });

    return updated;
  }

  /**
   * Generate invoice PDF for a bill
   * @param businessId - Business ID
   * @param billId - Bill ID
   * @returns PDF buffer
   */
  async generateBillPdf(businessId: string, billId: string): Promise<Buffer> {
    const bill = await this.getBillById(businessId, billId);
    const business = await this.businessRepository.findById(businessId);
    if (!business) {
      throw new NotFoundError('Business');
    }
    const party = await this.partyRepository.findById(bill.partyId.toString());
    if (!party) {
      throw new NotFoundError('Party');
    }
    const invoiceGenerator = new InvoiceGenerator();
    return invoiceGenerator.generateInvoicePDF(bill, business, party);
  }

  /**
   * Update bill PDF URL
   * @param billId - Bill ID
   * @param pdfUrl - PDF URL
   * @returns Updated bill
   */
  async updateBillPdfUrl(billId: string, pdfUrl: string): Promise<IBill> {
    const updated = await this.billRepository.updatePdfUrl(billId, pdfUrl);
    if (!updated) {
      throw new NotFoundError('Bill');
    }
    return updated;
  }

  /**
   * Delete a bill
   * @param businessId - Business ID
   * @param billId - Bill ID
   * @param force - If true, allow deletion of any status (default: false)
   */
  async deleteBill(businessId: string, billId: string, force = false): Promise<void> {
    const bill = await this.getBillById(businessId, billId);

    // Only allow deletion of draft or cancelled bills, unless force is true
    if (!force && bill.status !== 'draft' && bill.status !== 'cancelled') {
      throw new ValidationError(
        `Cannot delete a bill with status '${bill.status}'. Only draft or cancelled bills can be deleted.`
      );
    }

    const deleted = await this.billRepository.deleteByIdInBusiness(businessId, billId);
    if (!deleted) {
      throw new NotFoundError('Bill');
    }

    logger.info('Bill deleted', { businessId, billId, billNumber: bill.billNumber });
  }

  /**
   * Get payment summary for a business
   * @param businessId - Business ID
   * @returns Payment summary
   */
  async getPaymentSummary(businessId: string): Promise<PaymentSummary> {
    const bills = await this.billRepository.find({
      businessId: new Types.ObjectId(businessId),
      status: { $ne: 'cancelled' },
    });

    const payments = await this.paymentRepository.find({
      businessId: new Types.ObjectId(businessId),
    });

    const billsForCalc = bills.map(b => ({
      _id: b._id,
      totalAmount: b.totalAmount,
      status: b.status,
      dueDate: b.dueDate,
    }));

    const paymentsForCalc = payments.map(p => ({
      type: p.type,
      amount: p.amount,
      status: p.status,
      billId: p.billId?.toString(),
      purchaseId: p.purchaseId?.toString(),
    }));

    return this.billingCalculator.calculatePaymentSummary(billsForCalc, paymentsForCalc);
  }

  /**
   * Get revenue statistics
   * @param businessId - Business ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Revenue statistics
   */
  async getRevenueStats(
    businessId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalBilled: number;
    totalPaid: number;
    totalPending: number;
    billCount: number;
  }> {
    return this.billRepository.getRevenueStats(businessId, startDate, endDate);
  }

  /**
   * Send a bill via email and update its status to 'sent'
   * @param businessId - Business ID
   * @param billId - Bill ID
   */
  async sendBillEmail(businessId: string, billId: string): Promise<void> {
    const bill = await this.getBillById(businessId, billId);

    if (bill.status === 'cancelled') {
      throw new ValidationError('Cannot send a cancelled bill');
    }

    const party = await this.partyRepository.findById(bill.partyId.toString());
    if (!party) {
      throw new NotFoundError('Party');
    }

    if (!party.contact.email) {
      throw new ValidationError('Party does not have an email address');
    }

    // Try to queue via Bull (requires Redis). If Redis is down, send directly.
    try {
      await addSendInvoiceEmailJob({
        businessId,
        billId,
        partyId: bill.partyId.toString(),
        email: party.contact.email,
      });
      logger.info('Bill email queued', { businessId, billId, email: party.contact.email });
    } catch (queueError) {
      logger.warn('Bull queue unavailable, sending email directly', {
        error: queueError instanceof Error ? queueError.message : queueError,
      });

      const business = await this.businessRepository.findById(businessId);
      if (!business) {
        throw new NotFoundError('Business');
      }

      // Generate PDF (best-effort)
      let pdfBuffer: Buffer | undefined;
      try {
        const invoiceGenerator = new InvoiceGenerator();
        pdfBuffer = await invoiceGenerator.generateInvoicePDF(bill, business, party);
      } catch (pdfError) {
        logger.warn('Failed to generate PDF for direct send', {
          error: pdfError instanceof Error ? pdfError.message : pdfError,
        });
      }

      const notificationService = new NotificationService();
      const result = await notificationService.sendInvoiceEmail(party, bill, business, pdfBuffer);

      if (!result.success) {
        throw new ValidationError(`Failed to send email: ${result.error}`);
      }

      logger.info('Bill email sent directly', { businessId, billId, email: party.contact.email });
    }

    // Update status from draft to sent
    if (bill.status === 'draft') {
      await this.billRepository.updateStatus(billId, 'sent');
    }
  }
}

export default BillingService;
