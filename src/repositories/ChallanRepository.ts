/**
 * @file Challan Repository
 * @description Repository for challan entity operations
 */

import { Types, FilterQuery } from 'mongoose';
import { BaseRepository, PaginationOptions, PaginatedResult } from './BaseRepository';
import { Challan, IChallan, ChallanType, ChallanStatus } from '../models';
import { getFinancialYear, generateChallanNumber } from '../utils/helpers';

/**
 * Challan filter options
 */
export interface ChallanFilterOptions {
  /** Filter by type */
  type?: ChallanType;
  /** Filter by party ID */
  partyId?: string | Types.ObjectId;
  /** Filter by status */
  status?: ChallanStatus;
  /** Filter by date range start */
  dateFrom?: Date;
  /** Filter by date range end */
  dateTo?: Date;
}

/**
 * Challan repository class
 */
export class ChallanRepository extends BaseRepository<IChallan> {
  constructor() {
    super(Challan);
  }

  /**
   * Find challans by business ID with filters
   * @param businessId - Business ID
   * @param filters - Filter options
   * @param pagination - Pagination options
   * @returns Paginated challans
   */
  async findByBusiness(
    businessId: string | Types.ObjectId,
    filters: ChallanFilterOptions = {},
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<IChallan>> {
    const query: FilterQuery<IChallan> = {
      businessId: new Types.ObjectId(businessId.toString()),
    };

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.partyId) {
      query.partyId = new Types.ObjectId(filters.partyId.toString());
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
   * Find challan by ID within a business
   * @param businessId - Business ID
   * @param challanId - Challan ID
   * @returns Challan or null
   */
  async findByIdInBusiness(
    businessId: string | Types.ObjectId,
    challanId: string | Types.ObjectId
  ): Promise<IChallan | null> {
    return this.findOne({
      _id: new Types.ObjectId(challanId.toString()),
      businessId: new Types.ObjectId(businessId.toString()),
    });
  }

  /**
   * Find challans by party ID
   * @param businessId - Business ID
   * @param partyId - Party ID
   * @param type - Optional challan type filter
   * @returns Array of challans
   */
  async findByParty(
    businessId: string | Types.ObjectId,
    partyId: string | Types.ObjectId,
    type?: ChallanType
  ): Promise<IChallan[]> {
    const query: FilterQuery<IChallan> = {
      businessId: new Types.ObjectId(businessId.toString()),
      partyId: new Types.ObjectId(partyId.toString()),
      status: 'confirmed',
    };

    if (type) {
      query.type = type;
    }

    return this.find(query, undefined, { sort: { date: -1 } });
  }

  /**
   * Find challans by date range
   * @param businessId - Business ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Array of challans
   */
  async findByDateRange(
    businessId: string | Types.ObjectId,
    startDate: Date,
    endDate: Date
  ): Promise<IChallan[]> {
    return this.find(
      {
        businessId: new Types.ObjectId(businessId.toString()),
        date: { $gte: startDate, $lte: endDate },
        status: 'confirmed',
      },
      undefined,
      { sort: { date: 1 } }
    );
  }

  /**
   * Confirm challan
   * @param challanId - Challan ID
   * @param confirmedBy - Name of person who confirmed
   * @returns Updated challan
   */
  async confirmChallan(
    challanId: string | Types.ObjectId,
    confirmedBy: string
  ): Promise<IChallan | null> {
    return this.updateById(challanId, {
      status: 'confirmed',
      confirmedBy,
      confirmedAt: new Date(),
    });
  }

  /**
   * Cancel challan
   * @param challanId - Challan ID
   * @returns Updated challan
   */
  async cancelChallan(challanId: string | Types.ObjectId): Promise<IChallan | null> {
    return this.updateById(challanId, { status: 'cancelled' });
  }

  /**
   * Get next challan number for a business.
   * Finds the highest existing sequence number and increments it,
   * which is safe even when challans have been deleted (avoids gaps causing collisions).
   * Format: {D|R}-{FY}-{NNNN} (e.g., D-2025-26-0001, R-2025-26-0003)
   *
   * @param businessId - Business ID
   * @param type - Challan type ('delivery' or 'return')
   * @param date - Optional date to determine financial year (defaults to current date)
   * @returns Next challan number for the given type
   */
  async getNextChallanNumber(
    businessId: string | Types.ObjectId,
    type: ChallanType,
    date?: Date
  ): Promise<string> {
    const financialYear = getFinancialYear(date);
    const prefix = type === 'delivery' ? 'D' : 'R';
    const pattern = `^${prefix}-${financialYear}-`;

    const [latest] = await this.find(
      {
        businessId: new Types.ObjectId(businessId.toString()),
        challanNumber: { $regex: pattern },
      },
      undefined,
      { sort: { challanNumber: -1 }, limit: 1 }
    );

    let nextSeq = 1;
    if (latest) {
      const parts = latest.challanNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    return generateChallanNumber(type, nextSeq, financialYear);
  }

  /**
   * Get items currently with a party, optionally scoped to a specific agreement.
   * Aggregates confirmed delivery and return challans to compute net quantities.
   * @param businessId - Business ID
   * @param partyId - Party ID
   * @param agreementId - Optional agreement ID to scope the query
   * @returns Items with net quantities currently with the party
   */
  async getItemsWithParty(
    businessId: string | Types.ObjectId,
    partyId: string | Types.ObjectId,
    agreementId?: string
  ): Promise<Array<{ itemId: string; itemName: string; quantity: number }>> {
    const matchStage: Record<string, unknown> = {
      businessId: new Types.ObjectId(businessId.toString()),
      partyId: new Types.ObjectId(partyId.toString()),
      status: 'confirmed',
    };

    if (agreementId) {
      matchStage.agreementId = agreementId;
    }

    const result = await this.aggregate<{
      itemId: Types.ObjectId;
      itemName: string;
      quantity: number;
    }>([
      { $match: matchStage },
      { $unwind: '$items' },
      {
        $group: {
          _id: { itemId: '$items.itemId', itemName: '$items.itemName' },
          deliveryQty: {
            $sum: { $cond: [{ $eq: ['$type', 'delivery'] }, '$items.quantity', 0] },
          },
          returnQty: {
            $sum: { $cond: [{ $eq: ['$type', 'return'] }, '$items.quantity', 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          itemId: '$_id.itemId',
          itemName: '$_id.itemName',
          quantity: { $subtract: ['$deliveryQty', '$returnQty'] },
        },
      },
      { $match: { quantity: { $gt: 0 } } },
    ]);

    return result.map(r => ({
      itemId: r.itemId.toString(),
      itemName: r.itemName,
      quantity: r.quantity,
    }));
  }
}

export default ChallanRepository;
