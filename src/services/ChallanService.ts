/**
 * @file Challan Service
 * @description Business logic for challan (delivery/return) management
 */

import { Types } from 'mongoose';
import { ChallanRepository, ChallanFilterOptions, PaginationOptions, PaginatedResult, InventoryRepository, PartyRepository, BillRepository, BusinessRepository } from '../repositories';
import { IChallan, ChallanType, IChallanItem, IDamagedItem } from '../models';
import { NotFoundError, ValidationError, ConflictError } from '../middleware';
import { logger } from '../utils/logger';
import { computeRentedFromHistory } from '../utils/inventoryUtils';
import { InvoiceGenerator } from '../billing/InvoiceGenerator';

/**
 * Create challan item input
 */
export interface CreateChallanItemInput {
  itemId: string;
  itemName: string;
  quantity: number;
}

/**
 * Damaged item input (for return challans)
 */
export interface DamagedItemInput {
  itemId: string;
  itemName: string;
  quantity: number;
  damageRate: number;
  note?: string;
  lossType?: 'damage' | 'short' | 'need_repair';
}

/**
 * Create challan input
 */
export interface CreateChallanInput {
  type: ChallanType;
  partyId: string;
  agreementId: string;
  date: Date;
  items: CreateChallanItemInput[];
  damagedItems?: DamagedItemInput[];
  notes?: string;
  transporterName?: string;
  vehicleNumber?: string;
  cartageCharge?: number;
  loadingCharge?: number;
  unloadingCharge?: number;
}

/**
 * Update challan transportation input
 */
export interface UpdateChallanTransportationInput {
  transporterName?: string;
  vehicleNumber?: string;
  cartageCharge?: number;
  loadingCharge?: number;
  unloadingCharge?: number;
}

/**
 * Challan Service class
 */
export class ChallanService {
  private challanRepository: ChallanRepository;
  private inventoryRepository: InventoryRepository;
  private partyRepository: PartyRepository;
  private billRepository: BillRepository;
  private businessRepository: BusinessRepository;

  constructor() {
    this.challanRepository = new ChallanRepository();
    this.inventoryRepository = new InventoryRepository();
    this.billRepository = new BillRepository();
    this.partyRepository = new PartyRepository();
    this.businessRepository = new BusinessRepository();
  }

  /**
   * Get challans for a business
   * @param businessId - Business ID
   * @param filters - Filter options
   * @param pagination - Pagination options
   * @returns Paginated challans
   */
  async getChallans(
    businessId: string,
    filters: ChallanFilterOptions = {},
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<IChallan>> {
    return this.challanRepository.findByBusiness(businessId, filters, pagination);
  }

  /**
   * Get challan by ID
   * @param businessId - Business ID
   * @param challanId - Challan ID
   * @returns Challan
   */
  async getChallanById(businessId: string, challanId: string): Promise<IChallan> {
    const challan = await this.challanRepository.findByIdInBusiness(businessId, challanId);
    if (!challan) {
      throw new NotFoundError('Challan');
    }
    return challan;
  }

  /**
   * Generate challan PDF
   * @param businessId - Business ID
   * @param challanId - Challan ID
   * @returns PDF buffer and challan number for filename
   */
  async generateChallanPdf(
    businessId: string,
    challanId: string
  ): Promise<{ buffer: Buffer; challanNumber: string }> {
    const challan = await this.getChallanById(businessId, challanId);
    const business = await this.businessRepository.findById(businessId);
    if (!business) {
      throw new NotFoundError('Business');
    }
    const party = await this.partyRepository.findByIdInBusiness(businessId, challan.partyId.toString());
    if (!party) {
      throw new NotFoundError('Party');
    }
    const invoiceGenerator = new InvoiceGenerator();
    const buffer = await invoiceGenerator.generateChallanPDF(challan, business, party);
    return { buffer, challanNumber: challan.challanNumber };
  }

  /**
   * Create a new challan
   * @param businessId - Business ID
   * @param input - Challan data
   * @returns Created challan
   */
  async createChallan(businessId: string, input: CreateChallanInput): Promise<IChallan> {
    // Validate party exists and has the agreement
    const party = await this.partyRepository.findByIdInBusiness(businessId, input.partyId);
    if (!party) {
      throw new NotFoundError('Party');
    }

    // Validate agreement exists
    const agreement = party.agreements.find(a => a.agreementId === input.agreementId);
    if (!agreement) {
      throw new NotFoundError('Agreement');
    }

    if (agreement.status !== 'active') {
      throw new ValidationError('Agreement is not active');
    }

    // Validate items
    if (!input.items.length) {
      throw new ValidationError('At least one item is required');
    }

    // Auto-add items to agreement if not already present
    for (const item of input.items) {
      const isInAgreement = agreement.rates.some(
        r => r.itemId.toString() === item.itemId
      );

      if (!isInAgreement) {
        // Fetch inventory item to get default rate
        const inventoryItem = await this.inventoryRepository.findByIdInBusiness(
          businessId,
          item.itemId
        );
        if (!inventoryItem) {
          throw new NotFoundError(`Inventory item: ${item.itemName}`);
        }

        // Add to agreement with default rate (or 0 if no default)
        const ratePerDay = inventoryItem.defaultRatePerDay ?? 0;
        await this.partyRepository.addAgreementRate(
          party._id,
          input.agreementId,
          { itemId: new Types.ObjectId(item.itemId), ratePerDay }
        );

        logger.info('Auto-added item to agreement', {
          businessId,
          agreementId: input.agreementId,
          itemId: item.itemId,
          itemName: item.itemName,
          ratePerDay,
        });
      }
    }

    // For delivery, check inventory availability (computed from history)
    if (input.type === 'delivery') {
      for (const item of input.items) {
        const inventoryItem = await this.inventoryRepository.findByIdInBusiness(
          businessId,
          item.itemId
        );
        if (!inventoryItem) {
          throw new NotFoundError(`Inventory item: ${item.itemName}`);
        }
        const rented = computeRentedFromHistory(inventoryItem.quantityHistory);
        const available = Math.max(0, inventoryItem.totalQuantity - rented);
        if (available < item.quantity) {
          throw new ValidationError(
            `Insufficient quantity for ${item.itemName}. Available: ${available}`
          );
        }
      }
    }

    // For return, validate items are with the party
    if (input.type === 'return') {
      const itemsWithParty = await this.challanRepository.getItemsWithParty(
        businessId,
        input.partyId
      );
      
      for (const item of input.items) {
        const partyItem = itemsWithParty.find(i => i.itemId === item.itemId);
        if (!partyItem || partyItem.quantity < item.quantity) {
          throw new ValidationError(
            `Cannot return ${item.quantity} of ${item.itemName}. Only ${partyItem?.quantity || 0} with party.`
          );
        }
      }
    }

    // Generate challan number with separate counters for delivery and return
    // Format: D-2025-26-0001 for delivery, R-2025-26-0001 for return
    const challanNumber = await this.challanRepository.getNextChallanNumber(
      businessId,
      input.type,
      input.date
    );

    // Create challan items
    const challanItems: IChallanItem[] = input.items.map(item => ({
      itemId: new Types.ObjectId(item.itemId),
      itemName: item.itemName,
      quantity: item.quantity,
    }));

    // Map damaged items for return challans
    const damagedItems: IDamagedItem[] =
      input.type === 'return' && input.damagedItems?.length
        ? input.damagedItems.map(d => ({
            itemId: new Types.ObjectId(d.itemId),
            itemName: d.itemName,
            quantity: d.quantity,
            damageRate: d.damageRate,
            note: d.note,
            lossType: d.lossType ?? 'damage',
          }))
        : [];

    const challan = await this.challanRepository.create({
      businessId: new Types.ObjectId(businessId),
      challanNumber,
      type: input.type,
      partyId: new Types.ObjectId(input.partyId),
      agreementId: input.agreementId,
      date: input.date,
      items: challanItems,
      damagedItems,
      status: 'draft',
      notes: input.notes,
      transporterName: input.transporterName,
      vehicleNumber: input.vehicleNumber,
      cartageCharge: input.cartageCharge,
      loadingCharge: input.loadingCharge,
      unloadingCharge: input.unloadingCharge,
    });

    logger.info('Challan created', {
      businessId,
      challanId: challan._id,
      challanNumber,
      type: input.type,
    });

    return challan;
  }

  /**
   * Confirm a challan
   * @param businessId - Business ID
   * @param challanId - Challan ID
   * @param confirmedBy - Name of person confirming
   * @returns Confirmed challan
   */
  async confirmChallan(
    businessId: string,
    challanId: string,
    confirmedBy: string
  ): Promise<IChallan> {
    const challan = await this.getChallanById(businessId, challanId);

    if (challan.status !== 'draft') {
      throw new ConflictError(`Challan is already ${challan.status}`);
    }

    // Push history for challan confirm (rented computed from history on client)
    for (const item of challan.items) {
      if (challan.type === 'delivery') {
        const inventoryItem = await this.inventoryRepository.findByIdInBusiness(businessId, item.itemId);
        if (inventoryItem) {
          const rented = computeRentedFromHistory(inventoryItem.quantityHistory);
          const available = Math.max(0, inventoryItem.totalQuantity - rented);
          if (available < item.quantity) {
            throw new ValidationError(`Insufficient quantity for ${item.itemName}. Available: ${available}`);
          }
        }
        await this.inventoryRepository.pushQuantityHistoryEntry(businessId, item.itemId, {
          type: 'challan_delivery',
          quantity: item.quantity,
          rentedDelta: item.quantity,
          date: new Date(challan.date),
          note: `Challan ${challan.challanNumber} confirmed: ${item.itemName} reserved`,
        });
      } else {
        await this.inventoryRepository.pushQuantityHistoryEntry(businessId, item.itemId, {
          type: 'challan_return',
          quantity: item.quantity,
          rentedDelta: -item.quantity,
          date: new Date(challan.date),
          note: `Challan ${challan.challanNumber} confirmed: ${item.itemName} returned`,
        });
      }
    }

    // For return challans: reduce inventory for damage/short loss items (not need_repair)
    if (challan.type === 'return' && challan.damagedItems?.length) {
      for (const d of challan.damagedItems) {
        const lossType = d.lossType ?? 'damage';
        if (lossType === 'damage' || lossType === 'short') {
          const txType = lossType === 'damage' ? 'damaged' : 'short';
          const updated = await this.inventoryRepository.adjustQuantity(
            businessId,
            d.itemId,
            -d.quantity,
            {
              type: txType,
              quantity: d.quantity,
              date: new Date(challan.date),
              note: d.note,
            }
          );
          if (!updated) {
            throw new ValidationError(
              `Insufficient quantity for ${d.itemName} (${lossType}). Cannot reduce inventory.`
            );
          }
        }
      }
    }

    // Confirm the challan
    const confirmed = await this.challanRepository.confirmChallan(challanId, confirmedBy);
    if (!confirmed) {
      throw new NotFoundError('Challan');
    }

    logger.info('Challan confirmed', {
      businessId,
      challanId,
      confirmedBy,
      type: challan.type,
    });

    return confirmed;
  }

  /**
   * Cancel a challan
   * @param businessId - Business ID
   * @param challanId - Challan ID
   * @returns Cancelled challan
   */
  async cancelChallan(businessId: string, challanId: string): Promise<IChallan> {
    const challan = await this.getChallanById(businessId, challanId);

    if (challan.status === 'cancelled') {
      throw new ConflictError('Challan is already cancelled');
    }

    // If challan was confirmed, push reverse history entries
    if (challan.status === 'confirmed') {
      for (const item of challan.items) {
        if (challan.type === 'delivery') {
          await this.inventoryRepository.pushQuantityHistoryEntry(businessId, item.itemId, {
            type: 'challan_delivery_reversed',
            quantity: item.quantity,
            rentedDelta: -item.quantity,
            date: new Date(challan.date),
            note: `Challan ${challan.challanNumber} cancelled: ${item.itemName} unreserved`,
          });
        } else {
          await this.inventoryRepository.pushQuantityHistoryEntry(businessId, item.itemId, {
            type: 'challan_return_reversed',
            quantity: item.quantity,
            rentedDelta: item.quantity,
            date: new Date(challan.date),
            note: `Challan ${challan.challanNumber} cancelled: ${item.itemName} taken back`,
          });
        }
      }

      // Reverse damage/short reductions for return challans
      if (challan.type === 'return' && challan.damagedItems?.length) {
        for (const d of challan.damagedItems) {
          const lossType = d.lossType ?? 'damage';
          if (lossType === 'damage' || lossType === 'short') {
            await this.inventoryRepository.adjustQuantity(
              businessId,
              d.itemId,
              d.quantity,
              {
                type: 'purchase',
                quantity: d.quantity,
                date: new Date(challan.date),
                note: 'Reversal: challan cancelled',
              }
            );
          }
        }
      }
    }

    const cancelled = await this.challanRepository.cancelChallan(challanId);
    if (!cancelled) {
      throw new NotFoundError('Challan');
    }

    logger.info('Challan cancelled', { businessId, challanId });

    return cancelled;
  }

  /**
   * Get challans by party
   * @param businessId - Business ID
   * @param partyId - Party ID
   * @param type - Optional challan type filter
   * @returns Array of challans
   */
  async getChallansByParty(
    businessId: string,
    partyId: string,
    type?: ChallanType
  ): Promise<IChallan[]> {
    return this.challanRepository.findByParty(businessId, partyId, type);
  }

  /**
   * Get challans by date range
   * @param businessId - Business ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Array of challans
   */
  async getChallansByDateRange(
    businessId: string,
    startDate: Date,
    endDate: Date
  ): Promise<IChallan[]> {
    return this.challanRepository.findByDateRange(businessId, startDate, endDate);
  }

  /**
   * Predict the next challan number without creating a challan.
   * Useful for showing users what number the next challan will receive.
   * @param businessId - Business ID
   * @param type - Challan type ('delivery' or 'return')
   * @param date - Date used to determine the financial year
   * @returns Predicted challan number string (e.g. "D-2025-26-0005")
   */
  async getNextChallanNumber(
    businessId: string,
    type: ChallanType,
    date?: Date
  ): Promise<string> {
    return this.challanRepository.getNextChallanNumber(businessId, type, date);
  }

  /**
   * Get items currently with a party, optionally filtered by agreement.
   * @param businessId - Business ID
   * @param partyId - Party ID
   * @param agreementId - Optional agreement ID to scope quantities
   * @returns Items with quantities
   */
  async getItemsWithParty(
    businessId: string,
    partyId: string,
    agreementId?: string
  ): Promise<Array<{ itemId: string; itemName: string; quantity: number }>> {
    return this.challanRepository.getItemsWithParty(businessId, partyId, agreementId);
  }

  /**
   * Update transportation details for a challan
   * @param businessId - Business ID
   * @param challanId - Challan ID
   * @param input - Transportation fields to update
   * @returns Updated challan
   */
  async updateChallanTransportation(
    businessId: string,
    challanId: string,
    input: UpdateChallanTransportationInput
  ): Promise<IChallan> {
    const challan = await this.getChallanById(businessId, challanId);

    const updated = await this.challanRepository.updateById(challan._id, {
      transporterName: input.transporterName,
      vehicleNumber: input.vehicleNumber,
      cartageCharge: input.cartageCharge,
      loadingCharge: input.loadingCharge,
      unloadingCharge: input.unloadingCharge,
    });

    if (!updated) {
      throw new NotFoundError('Challan');
    }

    await this.markOverlappingBillsStale(businessId, updated);

    logger.info('Challan transportation updated', {
      businessId,
      challanId,
    });

    return updated;
  }

  /**
   * Update an item's quantity in a challan
   */
  async updateChallanItem(
    businessId: string,
    challanId: string,
    itemId: string,
    quantity: number
  ): Promise<IChallan> {
    const challan = await this.getChallanById(businessId, challanId);

    const item = challan.items.find(
      (i: IChallanItem) => i.itemId.toString() === itemId
    );
    if (!item) {
      throw new NotFoundError('Challan item');
    }

    const oldQuantity = item.quantity;
    const delta = quantity - oldQuantity;

    // If confirmed, validate and push history
    if (challan.status === 'confirmed' && delta !== 0) {
      const absDelta = Math.abs(delta);
      const rentedDelta =
        challan.type === 'delivery'
          ? delta > 0
            ? absDelta
            : -absDelta
          : delta > 0
            ? -absDelta
            : absDelta;

      if (challan.type === 'delivery' && delta > 0) {
        const inv = await this.inventoryRepository.findByIdInBusiness(businessId, item.itemId);
        if (inv) {
          const rented = computeRentedFromHistory(inv.quantityHistory);
          const available = Math.max(0, inv.totalQuantity - rented);
          if (available < absDelta) throw new ValidationError(`Insufficient quantity for ${item.itemName}`);
        }
      }

      await this.inventoryRepository.pushQuantityHistoryEntry(businessId, item.itemId, {
        type: 'challan_item_edit',
        quantity: absDelta,
        rentedDelta,
        challanType: challan.type,
        date: new Date(challan.date),
        note: `Challan ${challan.challanNumber}: ${item.itemName} ${oldQuantity}→${quantity}`,
      });
    }

    item.quantity = quantity;
    const updated = await (challan as any).save();

    await this.markOverlappingBillsStale(businessId, updated);

    logger.info('Challan item quantity updated', {
      businessId,
      challanId,
      itemId,
      quantity,
    });

    return updated;
  }

  /**
   * Add an item to an existing challan
   */
  async addChallanItem(
    businessId: string,
    challanId: string,
    item: { itemId: string; itemName: string; quantity: number }
  ): Promise<IChallan> {
    const challan = await this.getChallanById(businessId, challanId);

    // If confirmed, validate and push history
    if (challan.status === 'confirmed') {
      const rentedDelta = challan.type === 'delivery' ? item.quantity : -item.quantity;
      if (challan.type === 'delivery') {
        const inv = await this.inventoryRepository.findByIdInBusiness(businessId, item.itemId);
        if (inv) {
          const rented = computeRentedFromHistory(inv.quantityHistory);
          const available = Math.max(0, inv.totalQuantity - rented);
          if (available < item.quantity) throw new ValidationError(`Insufficient quantity for ${item.itemName}`);
        }
      }
      await this.inventoryRepository.pushQuantityHistoryEntry(businessId, item.itemId, {
        type: 'challan_item_edit',
        quantity: item.quantity,
        rentedDelta,
        challanType: challan.type,
        date: new Date(challan.date),
        note: `Challan ${challan.challanNumber}: added ${item.itemName} (${item.quantity})`,
      });
    }

    challan.items.push({
      itemId: new Types.ObjectId(item.itemId),
      itemName: item.itemName,
      quantity: item.quantity,
    } as IChallanItem);

    const updated = await (challan as any).save();
    await this.markOverlappingBillsStale(businessId, updated);

    logger.info('Challan item added', { businessId, challanId, itemId: item.itemId });
    return updated;
  }

  /**
   * Delete an item from an existing challan
   */
  async deleteChallanItem(
    businessId: string,
    challanId: string,
    itemId: string
  ): Promise<IChallan> {
    const challan = await this.getChallanById(businessId, challanId);

    const idx = challan.items.findIndex(
      (i: IChallanItem) => i.itemId.toString() === itemId
    );
    if (idx === -1) {
      throw new NotFoundError('Challan item');
    }
    if (challan.items.length <= 1) {
      throw new ValidationError('Cannot delete the last item from a challan');
    }

    const deletedItem = challan.items[idx];

    // If confirmed, push history for removed item
    if (challan.status === 'confirmed') {
      const rentedDelta = challan.type === 'delivery' ? -deletedItem.quantity : deletedItem.quantity;
      await this.inventoryRepository.pushQuantityHistoryEntry(businessId, deletedItem.itemId, {
        type: 'challan_item_edit',
        quantity: deletedItem.quantity,
        rentedDelta,
        challanType: challan.type,
        date: new Date(challan.date),
        note: `Challan ${challan.challanNumber}: removed ${deletedItem.itemName} (${deletedItem.quantity})`,
      });
    }

    challan.items.splice(idx, 1);
    const updated = await (challan as any).save();
    await this.markOverlappingBillsStale(businessId, updated);

    logger.info('Challan item deleted', { businessId, challanId, itemId });
    return updated;
  }

  /**
   * Replace the damaged items array on a return challan
   */
  async updateChallanDamagedItems(
    businessId: string,
    challanId: string,
    damagedItems: DamagedItemInput[]
  ): Promise<IChallan> {
    const challan = await this.getChallanById(businessId, challanId);

    if (challan.type !== 'return') {
      throw new ValidationError('Damaged items can only be set on return challans');
    }

    const mapped: IDamagedItem[] = damagedItems.map(d => ({
      itemId: new Types.ObjectId(d.itemId),
      itemName: d.itemName,
      quantity: d.quantity,
      damageRate: d.damageRate,
      note: d.note,
      lossType: d.lossType ?? 'damage',
    }));

    // If confirmed, sync inventory: compute delta per item (damage/short only) and adjust
    if (challan.status === 'confirmed') {
      const oldByItem = new Map<string, { qty: number; lossType: string }>();
      for (const d of challan.damagedItems || []) {
        const lt = d.lossType ?? 'damage';
        if (lt === 'damage' || lt === 'short') {
          const key = d.itemId.toString();
          const existing = oldByItem.get(key);
          oldByItem.set(key, {
            qty: (existing?.qty ?? 0) + d.quantity,
            lossType: lt,
          });
        }
      }
      const newByItem = new Map<string, { qty: number; lossType: string; name: string }>();
      for (const d of mapped) {
        const lt = d.lossType ?? 'damage';
        if (lt === 'damage' || lt === 'short') {
          const key = d.itemId.toString();
          const existing = newByItem.get(key);
          newByItem.set(key, {
            qty: (existing?.qty ?? 0) + d.quantity,
            lossType: lt,
            name: d.itemName,
          });
        }
      }
      const allItemIds = new Set([...oldByItem.keys(), ...newByItem.keys()]);
      for (const itemIdStr of allItemIds) {
        const oldVal = oldByItem.get(itemIdStr);
        const newVal = newByItem.get(itemIdStr);
        const oldQty = oldVal?.qty ?? 0;
        const newQty = newVal?.qty ?? 0;
        const delta = newQty - oldQty;
        if (delta === 0) continue;
        const lossType = newVal?.lossType ?? oldVal?.lossType ?? 'damage';
        const itemName = newVal?.name ?? challan.damagedItems?.find(d => d.itemId.toString() === itemIdStr)?.itemName ?? 'Item';
        if (delta > 0) {
          const res = await this.inventoryRepository.adjustQuantity(
            businessId,
            itemIdStr,
            -delta,
            {
              type: 'challan_loss_edit',
              quantity: delta,
              date: new Date(challan.date),
              note: `Challan ${challan.challanNumber}: ${itemName} loss ${oldQty}→${newQty} (${lossType})`,
            }
          );
          if (!res) throw new ValidationError(`Insufficient quantity for ${itemName} (${lossType})`);
        } else {
          await this.inventoryRepository.adjustQuantity(
            businessId,
            itemIdStr,
            Math.abs(delta),
            {
              type: 'challan_loss_edit',
              quantity: Math.abs(delta),
              date: new Date(challan.date),
              note: `Challan ${challan.challanNumber}: reversed ${itemName} loss ${oldQty}→${newQty}`,
            }
          );
        }
      }
    }

    const updated = await this.challanRepository.updateById(challan._id, {
      damagedItems: mapped,
    });

    if (!updated) {
      throw new NotFoundError('Challan');
    }

    await this.markOverlappingBillsStale(businessId, updated);

    logger.info('Challan damaged items updated', { businessId, challanId, count: damagedItems.length });
    return updated;
  }

  /**
   * Mark any bills that overlap with this challan's date/party/agreement as stale.
   */
  private async markOverlappingBillsStale(
    businessId: string,
    challan: IChallan
  ): Promise<void> {
    const count = await this.billRepository.markOverlappingBillsStale(
      businessId,
      challan.partyId.toString(),
      challan.agreementId,
      challan.date
    );
    if (count > 0) {
      logger.info('Marked bills as stale', {
        businessId,
        challanId: challan._id,
        staleBillCount: count,
      });
    }
  }
}

export default ChallanService;
