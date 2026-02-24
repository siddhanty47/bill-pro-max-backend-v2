/**
 * @file Inventory Controller
 * @description HTTP request handlers for inventory management
 */

import { Request, Response, NextFunction } from 'express';
import { InventoryService } from '../services';
import { paginationSchema } from '../types/api';

/**
 * Inventory Controller class
 */
export class InventoryController {
  private inventoryService: InventoryService;

  constructor() {
    this.inventoryService = new InventoryService();
  }

  /**
   * Get all inventory items
   */
  getInventory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;
      const pagination = paginationSchema.parse(req.query);
      const { category, search, hasAvailable } = req.query;

      const result = await this.inventoryService.getInventory(
        businessId,
        {
          category: category as string | undefined,
          search: search as string | undefined,
          hasAvailable: hasAvailable === 'true',
          isActive: true,
        },
        pagination
      );

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        message: 'Inventory items retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get inventory statistics
   */
  getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;

      const stats = await this.inventoryService.getStats(businessId);

      res.status(200).json({
        success: true,
        data: stats,
        message: 'Inventory statistics retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get inventory item by ID
   */
  getItemById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, id } = req.params;

      const item = await this.inventoryService.getItemById(businessId, id);

      res.status(200).json({
        success: true,
        data: item,
        message: 'Inventory item retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create inventory item
   */
  createItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;

      const item = await this.inventoryService.createItem(businessId, req.body);

      res.status(201).json({
        success: true,
        data: item,
        message: 'Inventory item created successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update inventory item
   */
  updateItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, id } = req.params;

      const item = await this.inventoryService.updateItem(businessId, id, req.body);

      res.status(200).json({
        success: true,
        data: item,
        message: 'Inventory item updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get categories
   */
  getCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;

      const categories = await this.inventoryService.getCategories(businessId);

      res.status(200).json({
        success: true,
        data: categories,
        message: 'Categories retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Adjust inventory quantity (purchase / scraped / sold)
   */
  adjustQuantity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, id } = req.params;

      const item = await this.inventoryService.adjustQuantity(businessId, id, req.body);

      res.status(200).json({
        success: true,
        data: item,
        message: 'Inventory quantity adjusted successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Check if an inventory code exists
   */
  checkCodeExists = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;
      const { code } = req.query;

      if (!code || typeof code !== 'string') {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Code query parameter is required' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const exists = await this.inventoryService.checkInventoryCodeExists(businessId, code);

      res.status(200).json({
        success: true,
        data: { exists },
        message: 'Code check completed',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}

export default InventoryController;
