/**
 * @file Inventory Repository
 * @description Repository for inventory entity operations
 */

import { Types, FilterQuery, PipelineStage } from 'mongoose';
import { BaseRepository, PaginationOptions, PaginatedResult } from './BaseRepository';
import { Inventory, IInventory, IQuantityTransaction } from '../models';
import { computeRentedFromHistory } from '../utils/inventoryUtils';

/**
 * Inventory filter options
 */
export interface InventoryFilterOptions {
  /** Filter by category */
  category?: string;
  /** Filter by active status */
  isActive?: boolean;
  /** Search term (name) */
  search?: string;
  /** Filter by availability */
  hasAvailable?: boolean;
}

/**
 * Inventory repository class
 */
export class InventoryRepository extends BaseRepository<IInventory> {
  constructor() {
    super(Inventory);
  }

  /**
   * Find inventory items by business ID with filters
   * @param businessId - Business ID
   * @param filters - Filter options
   * @param pagination - Pagination options
   * @returns Paginated inventory items
   */
  async findByBusiness(
    businessId: string | Types.ObjectId,
    filters: InventoryFilterOptions = {},
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<IInventory>> {
    const query: FilterQuery<IInventory> = {
      businessId: new Types.ObjectId(businessId.toString()),
    };

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    if (filters.hasAvailable) {
      return this.findPaginatedWithAvailableFilter(businessId, filters, pagination);
    }

    return this.findPaginated(query, pagination);
  }

  /**
   * Find items with available > 0 by computing rented from history (aggregation).
   */
  private async findPaginatedWithAvailableFilter(
    businessId: string | Types.ObjectId,
    filters: InventoryFilterOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<IInventory>> {
    const { page = 1, pageSize = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination || {};
    const skip = (page - 1) * pageSize;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const matchStage: Record<string, unknown> = {
      businessId: new Types.ObjectId(businessId.toString()),
      isActive: true,
    };
    if (filters.category) matchStage.category = filters.category;
    if (filters.search) matchStage.$text = { $search: filters.search };

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $addFields: {
          rented: {
            $reduce: {
              input: { $ifNull: ['$quantityHistory', []] },
              initialValue: 0,
              in: {
                $add: [
                  '$$value',
                  {
                    $cond: {
                      if: { $eq: [{ $ifNull: ['$$this.rentedDelta', 'NO_VAL'] }, 'NO_VAL'] },
                      then: {
                        $switch: {
                          branches: [
                            { case: { $eq: ['$$this.type', 'challan_delivery'] }, then: '$$this.quantity' },
                            { case: { $eq: ['$$this.type', 'challan_return'] }, then: { $multiply: ['$$this.quantity', -1] } },
                            { case: { $eq: ['$$this.type', 'challan_delivery_reversed'] }, then: { $multiply: ['$$this.quantity', -1] } },
                            { case: { $eq: ['$$this.type', 'challan_return_reversed'] }, then: '$$this.quantity' },
                          ],
                          default: 0,
                        },
                      },
                      else: { $ifNull: ['$$this.rentedDelta', 0] },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      { $addFields: { available: { $max: [0, { $subtract: ['$totalQuantity', '$rented'] }] } } },
      { $match: { available: { $gt: 0 } } },
      {
        $facet: {
          count: [{ $count: 'total' }],
          data: [
            { $sort: { [sortBy]: sortDirection } },
            { $skip: skip },
            { $limit: pageSize },
            { $project: { rented: 0, available: 0 } },
          ],
        },
      },
    ];

    const result = await this.model.aggregate(pipeline).exec();
    const countResult = result[0]?.count?.[0];
    const total = countResult?.total ?? 0;
    const data = (result[0]?.data ?? []) as IInventory[];
    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Find item by ID within a business
   * @param businessId - Business ID
   * @param itemId - Item ID
   * @returns Inventory item or null
   */
  async findByIdInBusiness(
    businessId: string | Types.ObjectId,
    itemId: string | Types.ObjectId
  ): Promise<IInventory | null> {
    return this.findOne({
      _id: new Types.ObjectId(itemId.toString()),
      businessId: new Types.ObjectId(businessId.toString()),
    });
  }

  /**
   * Find item by code within a business
   * @param businessId - Business ID
   * @param code - Inventory code
   * @returns Inventory item or null
   */
  async findByCode(
    businessId: string | Types.ObjectId,
    code: string
  ): Promise<IInventory | null> {
    return this.findOne({
      businessId: new Types.ObjectId(businessId.toString()),
      code: code.toUpperCase(),
    });
  }

  /**
   * Get categories for a business
   * @param businessId - Business ID
   * @returns Array of unique categories
   */
  async getCategories(businessId: string | Types.ObjectId): Promise<string[]> {
    const result = await this.aggregate<{ _id: string }>([
      { $match: { businessId: new Types.ObjectId(businessId.toString()), isActive: true } },
      { $group: { _id: '$category' } },
      { $sort: { _id: 1 } },
    ]);
    return result.map(r => r._id);
  }

  /**
   * Add stock (increase total and available)
   * @param itemId - Item ID
   * @param quantity - Quantity to add
   * @returns Updated item
   */
  async addStock(
    itemId: string | Types.ObjectId,
    quantity: number
  ): Promise<IInventory | null> {
    return this.updateById(itemId, {
      $inc: { totalQuantity: quantity },
    });
  }

  /**
   * Adjust quantity atomically — increments or decrements totalQuantity and pushes
   * a transaction entry to quantityHistory. For scraped/sold (negative delta),
   * validates available (total - rented) from history before update.
   */
  async adjustQuantity(
    businessId: string | Types.ObjectId,
    itemId: string | Types.ObjectId,
    delta: number,
    transaction: IQuantityTransaction
  ): Promise<IInventory | null> {
    const filter: FilterQuery<IInventory> = {
      _id: new Types.ObjectId(itemId.toString()),
      businessId: new Types.ObjectId(businessId.toString()),
    };

    if (delta < 0) {
      const item = await this.findByIdInBusiness(businessId, itemId);
      if (!item) return null;
      const rented = computeRentedFromHistory(item.quantityHistory);
      const available = Math.max(0, item.totalQuantity - rented);
      if (available < Math.abs(delta)) return null;
    }

    return this.updateOne(filter, {
      $inc: { totalQuantity: delta },
      $push: { quantityHistory: transaction },
    });
  }

  /**
   * Push a transaction to quantity history without changing total/available quantity.
   * Used for challan_item_edit (reserve/return changes) audit trail.
   */
  async pushQuantityHistoryEntry(
    businessId: string | Types.ObjectId,
    itemId: string | Types.ObjectId,
    transaction: IQuantityTransaction
  ): Promise<IInventory | null> {
    const filter: FilterQuery<IInventory> = {
      _id: new Types.ObjectId(itemId.toString()),
      businessId: new Types.ObjectId(businessId.toString()),
    };
    const result = await this.model.findOneAndUpdate(
      filter,
      { $push: { quantityHistory: transaction } },
      { new: true }
    );
    return result as IInventory | null;
  }

  /**
   * Get inventory statistics for a business
   * @param businessId - Business ID
   * @returns Inventory statistics
   */
  async getStats(businessId: string | Types.ObjectId): Promise<{
    totalItems: number;
    totalQuantity: number;
    rentedQuantity: number;
    availableQuantity: number;
    utilizationRate: number;
  }> {
    const items = await this.aggregate<{
      totalQuantity: number;
      quantityHistory: IQuantityTransaction[];
    }>([
      {
        $match: {
          businessId: new Types.ObjectId(businessId.toString()),
          isActive: true,
        },
      },
      { $project: { totalQuantity: 1, quantityHistory: 1 } },
    ]);

    let totalQuantity = 0;
    let rentedQuantity = 0;
    for (const item of items) {
      totalQuantity += item.totalQuantity;
      rentedQuantity += computeRentedFromHistory(item.quantityHistory);
    }
    const availableQuantity = Math.max(0, totalQuantity - rentedQuantity);
    const utilizationRate =
      totalQuantity > 0 ? (rentedQuantity / totalQuantity) * 100 : 0;

    return {
      totalItems: items.length,
      totalQuantity,
      rentedQuantity,
      availableQuantity,
      utilizationRate: Math.round(utilizationRate * 100) / 100,
    };
  }

  /**
   * Soft delete item (mark as inactive)
   * @param itemId - Item ID
   * @returns Updated item
   */
  async softDelete(itemId: string | Types.ObjectId): Promise<IInventory | null> {
    return this.updateById(itemId, { isActive: false });
  }
}

export default InventoryRepository;
