/**
 * @file Bill Repository
 * @description Repository for bill entity operations
 */

import { Types, FilterQuery } from 'mongoose';
import { BaseRepository, PaginationOptions, PaginatedResult } from './BaseRepository';
import { Bill, IBill, BillStatus } from '../models';

/**
 * Bill filter options
 */
export interface BillFilterOptions {
  /** Filter by party ID */
  partyId?: string | Types.ObjectId;
  /** Filter by status */
  status?: BillStatus;
  /** Filter by date range start */
  dateFrom?: Date;
  /** Filter by date range end */
  dateTo?: Date;
  /** Filter overdue only */
  overdueOnly?: boolean;
}

/**
 * Bill repository class
 */
export class BillRepository extends BaseRepository<IBill> {
  constructor() {
    super(Bill);
  }

  /**
   * Find bills by business ID with filters
   * @param businessId - Business ID
   * @param filters - Filter options
   * @param pagination - Pagination options
   * @returns Paginated bills
   */
  async findByBusiness(
    businessId: string | Types.ObjectId,
    filters: BillFilterOptions = {},
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<IBill>> {
    const query: FilterQuery<IBill> = {
      businessId: new Types.ObjectId(businessId.toString()),
    };

    if (filters.partyId) {
      query.partyId = new Types.ObjectId(filters.partyId.toString());
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) {
        query.createdAt.$gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        query.createdAt.$lte = filters.dateTo;
      }
    }

    if (filters.overdueOnly) {
      query.status = { $nin: ['paid', 'cancelled'] };
      query.dueDate = { $lt: new Date() };
    }

    return this.findPaginated(query, { ...pagination, sortBy: 'createdAt', sortOrder: 'desc' });
  }

  /**
   * Find bill by ID within a business
   * @param businessId - Business ID
   * @param billId - Bill ID
   * @returns Bill or null
   */
  async findByIdInBusiness(
    businessId: string | Types.ObjectId,
    billId: string | Types.ObjectId
  ): Promise<IBill | null> {
    return this.findOne({
      _id: new Types.ObjectId(billId.toString()),
      businessId: new Types.ObjectId(businessId.toString()),
    });
  }

  /**
   * Find bills by party
   * @param businessId - Business ID
   * @param partyId - Party ID
   * @returns Array of bills
   */
  async findByParty(
    businessId: string | Types.ObjectId,
    partyId: string | Types.ObjectId
  ): Promise<IBill[]> {
    return this.find(
      {
        businessId: new Types.ObjectId(businessId.toString()),
        partyId: new Types.ObjectId(partyId.toString()),
      },
      undefined,
      { sort: { createdAt: -1 } }
    );
  }

  /**
   * Find overdue bills
   * @param businessId - Business ID
   * @returns Array of overdue bills
   */
  async findOverdue(businessId: string | Types.ObjectId): Promise<IBill[]> {
    return this.find(
      {
        businessId: new Types.ObjectId(businessId.toString()),
        status: { $nin: ['paid', 'cancelled'] },
        dueDate: { $lt: new Date() },
      },
      undefined,
      { sort: { dueDate: 1 } }
    );
  }

  /**
   * Update bill status
   * @param billId - Bill ID
   * @param status - New status
   * @returns Updated bill
   */
  async updateStatus(
    billId: string | Types.ObjectId,
    status: BillStatus
  ): Promise<IBill | null> {
    const update: Partial<IBill> = { status };
    
    if (status === 'paid') {
      update.paidAt = new Date();
    } else if (status === 'sent') {
      update.sentAt = new Date();
    }

    return this.updateById(billId, update);
  }

  /**
   * Record payment on bill
   * @param billId - Bill ID
   * @param amount - Payment amount
   * @returns Updated bill
   */
  async recordPayment(
    billId: string | Types.ObjectId,
    amount: number
  ): Promise<IBill | null> {
    const bill = await this.findById(billId);
    if (!bill) return null;

    const newAmountPaid = bill.amountPaid + amount;
    const newStatus: BillStatus =
      newAmountPaid >= bill.totalAmount ? 'paid' : 'partial';

    const update: Partial<IBill> = {
      amountPaid: newAmountPaid,
      status: newStatus,
    };

    if (newStatus === 'paid') {
      update.paidAt = new Date();
    }

    return this.updateById(billId, update);
  }

  /**
   * Update PDF URL
   * @param billId - Bill ID
   * @param pdfUrl - PDF URL
   * @returns Updated bill
   */
  async updatePdfUrl(
    billId: string | Types.ObjectId,
    pdfUrl: string
  ): Promise<IBill | null> {
    return this.updateById(billId, { pdfUrl });
  }

  /**
   * Get next bill number for a business
   * @param businessId - Business ID
   * @param year - Year for the sequence
   * @returns Next bill number
   */
  async getNextBillNumber(
    businessId: string | Types.ObjectId,
    year: number = new Date().getFullYear()
  ): Promise<string> {
    const count = await this.count({
      businessId: new Types.ObjectId(businessId.toString()),
      billNumber: { $regex: `^INV-${year}-` },
    });

    return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  /**
   * Get revenue statistics
   * @param businessId - Business ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Revenue statistics
   */
  async getRevenueStats(
    businessId: string | Types.ObjectId,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalBilled: number;
    totalPaid: number;
    totalPending: number;
    billCount: number;
  }> {
    const result = await this.aggregate<{
      totalBilled: number;
      totalPaid: number;
      billCount: number;
    }>([
      {
        $match: {
          businessId: new Types.ObjectId(businessId.toString()),
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $ne: 'cancelled' },
        },
      },
      {
        $group: {
          _id: null,
          totalBilled: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$amountPaid' },
          billCount: { $sum: 1 },
        },
      },
    ]);

    const stats = result[0] || { totalBilled: 0, totalPaid: 0, billCount: 0 };

    return {
      ...stats,
      totalPending: stats.totalBilled - stats.totalPaid,
    };
  }

  /**
   * Find bill by party, agreement, and billing period start
   * Used to check for duplicate bills
   * @param businessId - Business ID
   * @param partyId - Party ID
   * @param agreementId - Agreement ID
   * @param periodStart - Billing period start date
   * @returns Bill or null
   */
  async findByPeriod(
    businessId: string | Types.ObjectId,
    partyId: string | Types.ObjectId,
    agreementId: string,
    periodStart: Date
  ): Promise<IBill | null> {
    return this.findOne({
      businessId: new Types.ObjectId(businessId.toString()),
      partyId: new Types.ObjectId(partyId.toString()),
      agreementId,
      'billingPeriod.start': periodStart,
    });
  }

  /**
   * Mark bills as stale if they overlap with a given challan's party, agreement, and date.
   * @returns Number of bills marked stale
   */
  async markOverlappingBillsStale(
    businessId: string | Types.ObjectId,
    partyId: string | Types.ObjectId,
    agreementId: string,
    challanDate: Date
  ): Promise<number> {
    const result = await this.model.updateMany(
      {
        businessId: new Types.ObjectId(businessId.toString()),
        partyId: new Types.ObjectId(partyId.toString()),
        agreementId,
        'billingPeriod.start': { $lte: challanDate },
        'billingPeriod.end': { $gte: challanDate },
        isStale: { $ne: true },
      },
      { $set: { isStale: true } }
    ).exec();
    return result.modifiedCount;
  }

  /**
   * Delete a bill by ID within a business
   * @param businessId - Business ID
   * @param billId - Bill ID
   * @returns True if deleted, false if not found
   */
  async deleteByIdInBusiness(
    businessId: string | Types.ObjectId,
    billId: string | Types.ObjectId
  ): Promise<boolean> {
    const result = await this.model.deleteOne({
      _id: new Types.ObjectId(billId.toString()),
      businessId: new Types.ObjectId(businessId.toString()),
    }).exec();
    return result.deletedCount > 0;
  }
}

export default BillRepository;
