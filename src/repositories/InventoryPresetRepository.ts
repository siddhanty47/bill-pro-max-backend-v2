/**
 * @file Inventory Preset Repository
 * @description Repository for inventory preset entity operations
 */

import { FilterQuery } from 'mongoose';
import { BaseRepository } from './BaseRepository';
import { InventoryPreset, IInventoryPreset } from '../models';

/**
 * Inventory preset repository class
 */
export class InventoryPresetRepository extends BaseRepository<IInventoryPreset> {
  constructor() {
    super(InventoryPreset);
  }

  /**
   * Find all active presets (summary without items array)
   * @returns Active presets with item count
   */
  async findAllActive() {
    type PresetSummary = {
      _id: string;
      name: string;
      description?: string;
      tags: string[];
      itemCount: number;
      isSystem: boolean;
      isPublic: boolean;
      createdBy?: string;
    };
    const result = await this.aggregate<PresetSummary>([
      { $match: { isActive: true } },
      {
        $project: {
          name: 1,
          description: 1,
          tags: 1,
          itemCount: { $size: '$items' },
          isSystem: 1,
          isPublic: 1,
          createdBy: 1,
        },
      },
      { $sort: { isSystem: -1, name: 1 } },
    ]);
    return result;
  }

  /**
   * Find preset by ID with full items
   * @param id - Preset ID
   * @returns Full preset or null
   */
  async findByIdWithItems(id: string): Promise<IInventoryPreset | null> {
    return this.findById(id);
  }

  /**
   * Find preset by name (case-insensitive)
   * @param name - Preset name
   * @returns Preset or null
   */
  async findByName(name: string): Promise<IInventoryPreset | null> {
    const query: FilterQuery<IInventoryPreset> = {
      name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    };
    return this.findOne(query);
  }
}

export default InventoryPresetRepository;
