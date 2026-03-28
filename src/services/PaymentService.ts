/**
 * @file Payment Service
 * @description Business logic for payment management
 */

import { Types } from 'mongoose';
import {
  PaymentRepository,
  PaymentFilterOptions,
  BillRepository,
  PartyRepository,
  PaginationOptions,
  PaginatedResult,
} from '../repositories';
import { IPayment, PaymentType, PaymentMethod, PaymentStatus } from '../models';
import { NotFoundError, ValidationError } from '../middleware';
import { logger } from '../utils/logger';
import { AuditLogService } from './AuditLogService';
import { AuditPerformer } from '../types/api';

/**
 * Create payment input
 */
export interface CreatePaymentInput {
  type: PaymentType;
  partyId: string;
  billId?: string;
  purchaseId?: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  date: Date;
  notes?: string;
}

/**
 * Payment Service class
 */
export class PaymentService {
  private paymentRepository: PaymentRepository;
  private billRepository: BillRepository;
  private partyRepository: PartyRepository;
  private auditLogService: AuditLogService;

  constructor() {
    this.paymentRepository = new PaymentRepository();
    this.billRepository = new BillRepository();
    this.partyRepository = new PartyRepository();
    this.auditLogService = new AuditLogService();
  }

  /**
   * Get payments for a business
   * @param businessId - Business ID
   * @param filters - Filter options
   * @param pagination - Pagination options
   * @returns Paginated payments
   */
  async getPayments(
    businessId: string,
    filters: PaymentFilterOptions = {},
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<IPayment>> {
    return this.paymentRepository.findByBusiness(businessId, filters, pagination);
  }

  /**
   * Get payment by ID
   * @param businessId - Business ID
   * @param paymentId - Payment ID
   * @returns Payment
   */
  async getPaymentById(businessId: string, paymentId: string): Promise<IPayment> {
    const payment = await this.paymentRepository.findByIdInBusiness(businessId, paymentId);
    if (!payment) {
      throw new NotFoundError('Payment');
    }
    return payment;
  }

  /**
   * Create a new payment
   * @param businessId - Business ID
   * @param input - Payment data
   * @returns Created payment
   */
  async createPayment(businessId: string, input: CreatePaymentInput, performer?: AuditPerformer): Promise<IPayment> {
    // Validate party exists
    const party = await this.partyRepository.findByIdInBusiness(businessId, input.partyId);
    if (!party) {
      throw new NotFoundError('Party');
    }

    // Validate amount
    if (input.amount <= 0) {
      throw new ValidationError('Amount must be positive');
    }

    // If bill payment, validate and update bill
    if (input.type === 'receivable' && input.billId) {
      const bill = await this.billRepository.findByIdInBusiness(businessId, input.billId);
      if (!bill) {
        throw new NotFoundError('Bill');
      }

      if (bill.status === 'paid') {
        throw new ValidationError('Bill is already fully paid');
      }

      if (bill.status === 'cancelled') {
        throw new ValidationError('Cannot record payment for cancelled bill');
      }

      // Check if payment exceeds balance
      const balance = bill.totalAmount - bill.amountPaid;
      if (input.amount > balance) {
        throw new ValidationError(`Payment amount exceeds balance due (${balance})`);
      }
    }

    // Create payment
    const payment = await this.paymentRepository.create({
      businessId: new Types.ObjectId(businessId),
      type: input.type,
      partyId: new Types.ObjectId(input.partyId),
      billId: input.billId ? new Types.ObjectId(input.billId) : undefined,
      purchaseId: input.purchaseId ? new Types.ObjectId(input.purchaseId) : undefined,
      amount: input.amount,
      currency: 'INR',
      method: input.method,
      reference: input.reference,
      date: input.date,
      status: 'completed',
      notes: input.notes,
    });

    // Update bill if this is a bill payment
    if (input.type === 'receivable' && input.billId) {
      await this.billRepository.recordPayment(input.billId, input.amount);
    }

    logger.info('Payment created', {
      businessId,
      paymentId: payment._id,
      type: input.type,
      amount: input.amount,
      billId: input.billId,
    });

    if (performer) {
      this.auditLogService.logChange({
        businessId,
        documentId: payment._id.toString(),
        documentType: 'payment',
        action: 'created',
        changes: [],
        performedBy: performer,
      });
    }

    return payment;
  }

  /**
   * Get payments for a bill
   * @param billId - Bill ID
   * @returns Array of payments
   */
  async getPaymentsForBill(billId: string): Promise<IPayment[]> {
    return this.paymentRepository.findByBill(billId);
  }

  /**
   * Get payments for a party
   * @param businessId - Business ID
   * @param partyId - Party ID
   * @returns Array of payments
   */
  async getPaymentsForParty(businessId: string, partyId: string): Promise<IPayment[]> {
    return this.paymentRepository.findByParty(businessId, partyId);
  }

  /**
   * Get total payments for a bill
   * @param billId - Bill ID
   * @returns Total amount paid
   */
  async getTotalForBill(billId: string): Promise<number> {
    return this.paymentRepository.getTotalForBill(billId);
  }

  /**
   * Get payment statistics
   * @param businessId - Business ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Payment statistics
   */
  async getStats(
    businessId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalReceived: number;
    totalPaid: number;
    receivableCount: number;
    payableCount: number;
  }> {
    return this.paymentRepository.getStats(businessId, startDate, endDate);
  }
}

export default PaymentService;
