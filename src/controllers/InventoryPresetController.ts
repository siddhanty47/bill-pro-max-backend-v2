/**
 * @file Inventory Preset Controller
 * @description HTTP request handlers for inventory preset management
 */

import { Request, Response, NextFunction } from 'express';
import { InventoryPresetService } from '../services';

/**
 * Inventory Preset Controller class
 */
export class InventoryPresetController {
  private presetService: InventoryPresetService;

  constructor() {
    this.presetService = new InventoryPresetService();
  }

  /**
   * List all active presets
   */
  listPresets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const presets = await this.presetService.listPresets();

      res.status(200).json({
        success: true,
        data: presets,
        message: 'Presets retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get preset by ID with full items
   */
  getPresetById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      const preset = await this.presetService.getPresetById(id);

      res.status(200).json({
        success: true,
        data: preset,
        message: 'Preset retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create a new preset
   */
  createPreset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;

      const preset = await this.presetService.createPreset(businessId, req.body);

      res.status(201).json({
        success: true,
        data: preset,
        message: 'Preset created successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}

export default InventoryPresetController;
