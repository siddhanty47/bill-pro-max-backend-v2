/**
 * @file Inventory routes
 * @description API routes for inventory management
 */

import { Router } from 'express';
import { InventoryController } from '../../controllers';
import { authenticate, validateBusinessAccess, validateBody, requirePermission } from '../../middleware';
import { createInventorySchema, updateInventorySchema, adjustQuantitySchema } from '../../types/api';

const router = Router({ mergeParams: true });
const inventoryController = new InventoryController();

// Apply authentication and business access validation to all routes
router.use(authenticate, validateBusinessAccess);

/**
 * GET /businesses/:businessId/inventory
 * Get all inventory items for a business
 */
router.get(
  '/',
  requirePermission('read', 'inventory'),
  inventoryController.getInventory
);

/**
 * POST /businesses/:businessId/inventory
 * Create a new inventory item
 */
router.post(
  '/',
  requirePermission('create', 'inventory'),
  validateBody(createInventorySchema),
  inventoryController.createItem
);

/**
 * GET /businesses/:businessId/inventory/stats
 * Get inventory statistics
 */
router.get(
  '/stats',
  requirePermission('read', 'inventory'),
  inventoryController.getStats
);

/**
 * GET /businesses/:businessId/inventory/check-code
 * Check if an inventory code already exists
 */
router.get(
  '/check-code',
  requirePermission('read', 'inventory'),
  inventoryController.checkCodeExists
);

/**
 * GET /businesses/:businessId/inventory/categories
 * Get inventory categories
 */
router.get(
  '/categories',
  requirePermission('read', 'inventory'),
  inventoryController.getCategories
);

/**
 * POST /businesses/:businessId/inventory/:id/adjust-quantity
 * Adjust inventory quantity (purchase / scraped / sold)
 */
router.post(
  '/:id/adjust-quantity',
  requirePermission('update', 'inventory'),
  validateBody(adjustQuantitySchema),
  inventoryController.adjustQuantity
);

/**
 * GET /businesses/:businessId/inventory/:id
 * Get a specific inventory item
 */
router.get(
  '/:id',
  requirePermission('read', 'inventory'),
  inventoryController.getItemById
);

/**
 * PATCH /businesses/:businessId/inventory/:id
 * Update an inventory item
 */
router.patch(
  '/:id',
  requirePermission('update', 'inventory'),
  validateBody(updateInventorySchema),
  inventoryController.updateItem
);

export default router;
