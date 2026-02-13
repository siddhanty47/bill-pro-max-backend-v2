/**
 * @file Payment Repository
 * @description Repository for payment entity operations
 */

import { Types, FilterQuery } from 'mongoose';
import { BaseRepository, PaginationOptions, PaginatedResult } from './BaseRepository';
import { Payment, IPayment, PaymentType, PaymentStatus } from '../models';

/**
 * Payment filter options
 */
export interface PaymentFilterOptions {
  /** Filter by type */
  type?: PaymentType;
  /** Filter by party ID */
  partyId?: string | Types.ObjectId;
  /** Filter by bill ID */
  billId?: string | Types.ObjectId;
  /** Filter by status */
  status?: PaymentStatus;
  /** Filter by date range start */
  dateFrom?: Date;
  /** Filter by date range end */
  dateTo?: Date;
}

/**
 * Payment repository class
 */
export class PaymentRepository extends BaseRepository<IPayment> {
  constructor() {
    super(Payment);
  }

  /**
   * Find payments by business ID with filters
   * @param businessId - Business ID
   * @param filters - Filter options
   * @param pagination - Pagination options
   * @returns Paginated payments
   */
  async findByBusiness(
    businessId: string | Types.ObjectId,
    filters: PaymentFilterOptions = {},
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<IPayment>> {
    const query: FilterQuery<IPayment> = {
      businessId: new Types.ObjectId(businessId.toString()),
    };

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.partyId) {
      query.partyId = new Types.ObjectId(filters.partyId.toString());
    }

    if (filters.billId) {
      query.billId = new Types.ObjectId(filters.billId.toString());
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.dateFrom || filters.dateTo) {
      query.date = {};
      if (filters.dateFrom) {
        query.date.$gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        query.date.$lte = filters.dateTo;
      }
    }

    return this.findPaginated(query, { ...pagination, sortBy: 'date', sortOrder: 'desc' });
  }

  /**
   * Find payment by ID within a business
   * @param businessId - Business ID
   * @param paymentId - Payment ID
   * @returns Payment or null
   */
  async findByIdInBusiness(
    businessId: string | Types.ObjectId,
    paymentId: string | Types.ObjectId
  ): Promise<IPayment | null> {
    return this.findOne({
      _id: new Types.ObjectId(paymentId.toString()),
      businessId: new Types.ObjectId(businessId.toString()),
    });
  }

  /**
   * Find payments by bill
   * @param billId - Bill ID
   * @returns Array of payments
   */
  async findByBill(billId: string | Types.ObjectId): Promise<IPayment[]> {
    return this.find(
      { billId: new Types.ObjectId(billId.toString()) },
      undefined,
      { sort: { date: -1 } }
    );
  }

  /**
   * Find payments by party
   * @param businessId - Business ID
   * @param partyId - Party ID
   * @returns Array of payments
   */
  async findByParty(
    businessId: string | Types.ObjectId,
    partyId: string | Types.ObjectId
  ): Promise<IPayment[]> {
    return this.find(
      {
        businessId: new Types.ObjectId(businessId.toString()),
        partyId: new Types.ObjectId(partyId.toString()),
      },
      undefined,
      { sort: { date: -1 } }
    );
  }

  /**
   * Get total payments for a bill
   * @param billId - Bill ID
   * @returns Total payment amount
   */
  async getTotalForBill(billId: string | Types.ObjectId): Promise<number> {
    const result = await this.aggregate<{ total: number }>([
      {
        $match: {
          billId: new Types.ObjectId(billId.toString()),
          status: 'completed',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    return result[0]?.total || 0;
  }

  /**
   * Get payment statistics
   * @param businessId - Business ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Payment statistics
   */
  async getStats(
    businessId: string | Types.ObjectId,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalReceived: number;
    totalPaid: number;
    receivableCount: number;
    payableCount: number;
  }> {
    const result = await this.aggregate<{
      _id: PaymentType;
      total: number;
      count: number;
    }>([
      {
        $match: {
          businessId: new Types.ObjectId(businessId.toString()),
          date: { $gte: startDate, $lte: endDate },
          status: 'completed',
        },
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const receivable = result.find(r => r._id === 'receivable');
    const payable = result.find(r => r._id === 'payable');

    return {
      totalReceived: receivable?.total || 0,
      totalPaid: payable?.total || 0,
      receivableCount: receivable?.count || 0,
      payableCount: payable?.count || 0,
    };
  }
}

export default PaymentRepository;
