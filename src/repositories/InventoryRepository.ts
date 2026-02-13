/**
 * @file Inventory Repository
 * @description Repository for inventory entity operations
 */

import { Types, FilterQuery } from 'mongoose';
import { BaseRepository, PaginationOptions, PaginatedResult } from './BaseRepository';
import { Inventory, IInventory } from '../models';

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
      query.availableQuantity = { $gt: 0 };
    }

    return this.findPaginated(query, pagination);
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
   * Reserve items (decrease available, increase rented)
   * @param itemId - Item ID
   * @param quantity - Quantity to reserve
   * @returns Updated item
   */
  async reserveItems(
    itemId: string | Types.ObjectId,
    quantity: number
  ): Promise<IInventory | null> {
    return this.updateOne(
      {
        _id: new Types.ObjectId(itemId.toString()),
        availableQuantity: { $gte: quantity },
      },
      {
        $inc: {
          availableQuantity: -quantity,
          rentedQuantity: quantity,
        },
      }
    );
  }

  /**
   * Return items (increase available, decrease rented)
   * @param itemId - Item ID
   * @param quantity - Quantity to return
   * @returns Updated item
   */
  async returnItems(
    itemId: string | Types.ObjectId,
    quantity: number
  ): Promise<IInventory | null> {
    return this.updateOne(
      {
        _id: new Types.ObjectId(itemId.toString()),
        rentedQuantity: { $gte: quantity },
      },
      {
        $inc: {
          availableQuantity: quantity,
          rentedQuantity: -quantity,
        },
      }
    );
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
      $inc: {
        totalQuantity: quantity,
        availableQuantity: quantity,
      },
    });
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
    const result = await this.aggregate<{
      totalItems: number;
      totalQuantity: number;
      rentedQuantity: number;
      availableQuantity: number;
    }>([
      {
        $match: {
          businessId: new Types.ObjectId(businessId.toString()),
          isActive: true,
        },
      },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: '$totalQuantity' },
          rentedQuantity: { $sum: '$rentedQuantity' },
          availableQuantity: { $sum: '$availableQuantity' },
        },
      },
    ]);

    const stats = result[0] || {
      totalItems: 0,
      totalQuantity: 0,
      rentedQuantity: 0,
      availableQuantity: 0,
    };

    const utilizationRate =
      stats.totalQuantity > 0 ? (stats.rentedQuantity / stats.totalQuantity) * 100 : 0;

    return {
      ...stats,
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
