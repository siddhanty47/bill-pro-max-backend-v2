/**
 * @file Inventory Preset Service
 * @description Business logic for inventory preset management
 */

import { Types } from 'mongoose';
import { InventoryPresetRepository } from '../repositories';
import { InventoryRepository } from '../repositories';
import { IInventoryPreset } from '../models';
import { NotFoundError, ConflictError } from '../middleware';
import { logger } from '../utils/logger';

/**
 * Create preset input
 */
export interface CreatePresetInput {
  name: string;
  description?: string;
  tags?: string[];
  items: Array<{
    code: string;
    name: string;
    category: string;
    unit: string;
    description?: string;
    defaultRatePerDay?: number;
    damageRate?: number;
  }>;
}

/**
 * Import preset result
 */
export interface ImportPresetResult {
  imported: number;
  skipped: number;
  total: number;
  importedItems: Array<{ code: string; name: string }>;
  skippedItems: Array<{ code: string; name: string; reason: string }>;
}

/**
 * Inventory Preset Service class
 */
export class InventoryPresetService {
  private presetRepository: InventoryPresetRepository;
  private inventoryRepository: InventoryRepository;

  constructor() {
    this.presetRepository = new InventoryPresetRepository();
    this.inventoryRepository = new InventoryRepository();
  }

  /**
   * List all active presets (summaries)
   */
  async listPresets() {
    return this.presetRepository.findAllActive();
  }

  /**
   * Get preset by ID with full items
   */
  async getPresetById(id: string): Promise<IInventoryPreset> {
    const preset = await this.presetRepository.findByIdWithItems(id);
    if (!preset) {
      throw new NotFoundError('Inventory preset');
    }
    return preset;
  }

  /**
   * Create a new preset from business inventory selection
   */
  async createPreset(businessId: string, input: CreatePresetInput): Promise<IInventoryPreset> {
    // Validate unique name (case-insensitive)
    const existing = await this.presetRepository.findByName(input.name);
    if (existing) {
      throw new ConflictError('A preset with this name already exists');
    }

    const preset = await this.presetRepository.create({
      name: input.name,
      description: input.description,
      tags: input.tags || [],
      items: input.items.map((item) => ({
        code: item.code.toUpperCase(),
        name: item.name,
        category: item.category,
        unit: item.unit,
        description: item.description,
        defaultRatePerDay: item.defaultRatePerDay,
        damageRate: item.damageRate,
      })),
      isSystem: false,
      isPublic: true,
      createdBy: new Types.ObjectId(businessId),
      isActive: true,
    });

    logger.info('Inventory preset created', { presetId: preset._id, name: preset.name, businessId });

    return preset;
  }

  /**
   * Import preset items into a business inventory
   */
  async importPreset(businessId: string, presetId: string): Promise<ImportPresetResult> {
    const preset = await this.getPresetById(presetId);

    // Fetch all existing inventory items (both active and inactive) for the business
    const activeItems = await this.inventoryRepository.findByBusiness(businessId, { isActive: true }, { page: 1, pageSize: 10000 });
    const inactiveItems = await this.inventoryRepository.findByBusiness(businessId, { isActive: false }, { page: 1, pageSize: 10000 });

    const activeCodes = new Set(activeItems.data.map((item) => item.code.toUpperCase()));
    const inactiveByCode = new Map(inactiveItems.data.map((item) => [item.code.toUpperCase(), item]));

    const importedItems: Array<{ code: string; name: string }> = [];
    const skippedItems: Array<{ code: string; name: string; reason: string }> = [];
    const itemsToInsert: Array<Record<string, unknown>> = [];
    const itemsToReactivate: Array<{ id: string; updates: Record<string, unknown> }> = [];

    for (const presetItem of preset.items) {
      const code = presetItem.code.toUpperCase();
      if (activeCodes.has(code)) {
        skippedItems.push({ code, name: presetItem.name, reason: 'Code already exists' });
      } else if (inactiveByCode.has(code)) {
        // Reactivate previously deleted item
        const inactiveItem = inactiveByCode.get(code)!;
        itemsToReactivate.push({
          id: inactiveItem._id.toString(),
          updates: {
            isActive: true,
            name: presetItem.name,
            category: presetItem.category,
            unit: presetItem.unit,
            description: presetItem.description,
            defaultRatePerDay: presetItem.defaultRatePerDay || 0,
            damageRate: presetItem.damageRate || 0,
          },
        });
        importedItems.push({ code, name: presetItem.name });
      } else {
        itemsToInsert.push({
          businessId: new Types.ObjectId(businessId),
          code,
          name: presetItem.name,
          category: presetItem.category,
          totalQuantity: 0,
          unit: presetItem.unit,
          description: presetItem.description,
          defaultRatePerDay: presetItem.defaultRatePerDay || 0,
          damageRate: presetItem.damageRate || 0,
          isActive: true,
        });
        importedItems.push({ code, name: presetItem.name });
      }
    }

    // Reactivate soft-deleted items
    for (const item of itemsToReactivate) {
      await this.inventoryRepository.updateById(item.id, item.updates);
    }

    if (itemsToInsert.length > 0) {
      await this.inventoryRepository.createMany(itemsToInsert);
    }

    logger.info('Inventory preset imported', {
      businessId,
      presetId,
      presetName: preset.name,
      imported: importedItems.length,
      skipped: skippedItems.length,
    });

    return {
      imported: importedItems.length,
      skipped: skippedItems.length,
      total: preset.items.length,
      importedItems,
      skippedItems,
    };
  }
}

export default InventoryPresetService;
