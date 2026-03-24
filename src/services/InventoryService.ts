/**
 * @file Inventory Service
 * @description Business logic for inventory management
 */

import { Types } from 'mongoose';
import { InventoryRepository, InventoryFilterOptions, PaginationOptions, PaginatedResult, PartyRepository } from '../repositories';
import { IInventory, IPurchaseInfo } from '../models';
import { NotFoundError, ValidationError, ConflictError } from '../middleware';
import { logger } from '../utils/logger';
import { computeRentedFromHistory } from '../utils/inventoryUtils';

/**
 * Create inventory item input
 */
export interface CreateInventoryInput {
  code: string;
  name: string;
  category: string;
  totalQuantity: number;
  unit: string;
  description?: string;
  defaultRatePerDay?: number;
  damageRate?: number;
  purchaseInfo?: {
    supplierPartyId?: string;
    supplierName?: string;
    costPerUnit: number;
    date: Date;
    paymentStatus: 'pending' | 'partial' | 'paid';
  };
}

/**
 * Input for adjusting inventory quantity via a transaction
 */
export interface AdjustQuantityInput {
  /** Type of adjustment */
  type: 'purchase' | 'scraped' | 'sold';
  /** Positive integer quantity to adjust */
  quantity: number;
  /** Date the adjustment occurred */
  date: Date;
  /** Optional note describing the adjustment */
  note?: string;
}

/**
 * Update inventory item input
 */
export interface UpdateInventoryInput {
  code?: string;
  name?: string;
  category?: string;
  unit?: string;
  description?: string;
  defaultRatePerDay?: number;
  damageRate?: number;
}

/**
 * Inventory Service class
 */
export class InventoryService {
  private inventoryRepository: InventoryRepository;
  private partyRepository: PartyRepository;

  constructor() {
    this.inventoryRepository = new InventoryRepository();
    this.partyRepository = new PartyRepository();
  }

  /**
   * Get inventory items for a business
   * @param businessId - Business ID
   * @param filters - Filter options
   * @param pagination - Pagination options
   * @returns Paginated inventory items
   */
  async getInventory(
    businessId: string,
    filters: InventoryFilterOptions = {},
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<IInventory>> {
    return this.inventoryRepository.findByBusiness(businessId, filters, pagination);
  }

  /**
   * Get inventory item by ID
   * @param businessId - Business ID
   * @param itemId - Item ID
   * @returns Inventory item
   */
  async getItemById(businessId: string, itemId: string): Promise<IInventory> {
    const item = await this.inventoryRepository.findByIdInBusiness(businessId, itemId);
    if (!item) {
      throw new NotFoundError('Inventory item');
    }
    return item;
  }

  /**
   * Create a new inventory item
   * @param businessId - Business ID
   * @param input - Item data
   * @returns Created item
   */
  async createItem(businessId: string, input: CreateInventoryInput): Promise<IInventory> {
    if (input.totalQuantity < 0) {
      throw new ValidationError('Total quantity cannot be negative');
    }

    // Validate code uniqueness
    const code = input.code.toUpperCase();
    const existingWithCode = await this.inventoryRepository.findByCode(businessId, code);
    if (existingWithCode) {
      throw new ConflictError('An inventory item with this code already exists');
    }

    const purchaseInfo: IPurchaseInfo | undefined = input.purchaseInfo
      ? {
          supplierPartyId: input.purchaseInfo.supplierPartyId
            ? new Types.ObjectId(input.purchaseInfo.supplierPartyId)
            : undefined,
          supplierName: input.purchaseInfo.supplierName,
          costPerUnit: input.purchaseInfo.costPerUnit,
          date: input.purchaseInfo.date,
          paymentStatus: input.purchaseInfo.paymentStatus,
        }
      : undefined;

    const item = await this.inventoryRepository.create({
      businessId: new Types.ObjectId(businessId),
      code,
      name: input.name,
      category: input.category,
      totalQuantity: input.totalQuantity,
      unit: input.unit,
      description: input.description,
      defaultRatePerDay: input.defaultRatePerDay,
      damageRate: input.damageRate,
      purchaseInfo,
      isActive: true,
    });

    logger.info('Inventory item created', { businessId, itemId: item._id, code, name: item.name });

    return item;
  }

  /**
   * Update an inventory item
   * @param businessId - Business ID
   * @param itemId - Item ID
   * @param input - Update data
   * @returns Updated item
   */
  async updateItem(
    businessId: string,
    itemId: string,
    input: UpdateInventoryInput
  ): Promise<IInventory> {
    const item = await this.getItemById(businessId, itemId);

    // Check for duplicate code if changing
    if (input.code && input.code.toUpperCase() !== item.code) {
      const existingWithCode = await this.inventoryRepository.findByCode(businessId, input.code.toUpperCase());
      if (existingWithCode && existingWithCode._id.toString() !== itemId) {
        throw new ConflictError('An inventory item with this code already exists');
      }
    }

    const updateData = {
      ...input,
      code: input.code ? input.code.toUpperCase() : undefined,
    };

    const updated = await this.inventoryRepository.updateById(itemId, updateData);
    if (!updated) {
      throw new NotFoundError('Inventory item');
    }

    logger.info('Inventory item updated', { businessId, itemId });

    return updated;
  }

  /**
   * Delete an inventory item (soft delete)
   * @param businessId - Business ID
   * @param itemId - Item ID
   */
  async deleteItem(businessId: string, itemId: string): Promise<void> {
    const item = await this.getItemById(businessId, itemId);

    const rented = computeRentedFromHistory(item.quantityHistory);
    if (rented > 0) {
      throw new ValidationError('Cannot delete item that is currently rented');
    }

    await this.inventoryRepository.softDelete(itemId);

    logger.info('Inventory item deleted', { businessId, itemId });
  }

  /**
   * Add stock to an item
   * @param businessId - Business ID
   * @param itemId - Item ID
   * @param quantity - Quantity to add
   * @returns Updated item
   */
  async addStock(businessId: string, itemId: string, quantity: number): Promise<IInventory> {
    await this.getItemById(businessId, itemId);

    if (quantity <= 0) {
      throw new ValidationError('Quantity must be positive');
    }

    const updated = await this.inventoryRepository.addStock(itemId, quantity);
    if (!updated) {
      throw new NotFoundError('Inventory item');
    }

    logger.info('Stock added', { businessId, itemId, quantity });

    return updated;
  }

  /**
   * Adjust inventory quantity via a transaction (purchase adds, scraped/sold subtracts).
   * Uses atomic $inc and $push to avoid race conditions.
   * @param businessId - Business ID
   * @param itemId - Item ID
   * @param input - Adjustment details
   * @returns Updated inventory item
   */
  async adjustQuantity(
    businessId: string,
    itemId: string,
    input: AdjustQuantityInput
  ): Promise<IInventory> {
    await this.getItemById(businessId, itemId);

    const delta = input.type === 'purchase' ? input.quantity : -input.quantity;

    const transaction = {
      type: input.type,
      quantity: input.quantity,
      date: input.date,
      note: input.note,
    };

    const updated = await this.inventoryRepository.adjustQuantity(
      businessId,
      itemId,
      delta,
      transaction
    );

    if (!updated) {
      throw new ValidationError('Insufficient available quantity for this adjustment');
    }

    logger.info('Inventory quantity adjusted', {
      businessId,
      itemId,
      type: input.type,
      quantity: input.quantity,
    });

    return updated;
  }

  /**
   * Get inventory statistics
   * @param businessId - Business ID
   * @returns Inventory statistics
   */
  async getStats(businessId: string): Promise<{
    totalItems: number;
    totalQuantity: number;
    rentedQuantity: number;
    availableQuantity: number;
    utilizationRate: number;
  }> {
    const [stats, openingBalances] = await Promise.all([
      this.inventoryRepository.getStats(businessId),
      this.partyRepository.getOpeningBalancesByItem(businessId),
    ]);

    // Add opening balances to rented (but not to available calculation)
    let totalOpeningBalance = 0;
    for (const qty of openingBalances.values()) {
      totalOpeningBalance += qty;
    }

    const rentedQuantity = stats.rentedQuantity + totalOpeningBalance;
    const utilizationRate =
      stats.totalQuantity > 0 ? (rentedQuantity / stats.totalQuantity) * 100 : 0;

    return {
      ...stats,
      rentedQuantity,
      utilizationRate: Math.round(utilizationRate * 100) / 100,
    };
  }

  /**
   * Get categories for a business
   * @param businessId - Business ID
   * @returns Array of category names
   */
  /**
   * Get opening balances per item from active agreements
   * @param businessId - Business ID
   * @returns Record of itemId -> total opening balance
   */
  async getOpeningBalances(businessId: string): Promise<Record<string, number>> {
    const map = await this.partyRepository.getOpeningBalancesByItem(businessId);
    const result: Record<string, number> = {};
    for (const [itemId, qty] of map) {
      result[itemId] = qty;
    }
    return result;
  }

  async getCategories(businessId: string): Promise<string[]> {
    return this.inventoryRepository.getCategories(businessId);
  }

  /**
   * Check if an inventory code already exists in a business
   * @param businessId - Business ID
   * @param code - Inventory code to check
   * @returns True if code exists
   */
  async checkInventoryCodeExists(businessId: string, code: string): Promise<boolean> {
    const existing = await this.inventoryRepository.findByCode(businessId, code.toUpperCase());
    return !!existing;
  }
}

export default InventoryService;
