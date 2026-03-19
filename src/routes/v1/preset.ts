/**
 * @file Preset routes
 * @description API routes for inventory preset management
 */

import { Router } from 'express';
import { InventoryPresetController } from '../../controllers';
import { authenticate, validateBusinessAccess, validateBody, requirePermission } from '../../middleware';
import { createPresetSchema } from '../../types/api';

const presetController = new InventoryPresetController();

/**
 * Standalone preset routes (no business scope)
 * Mounted at /presets
 */
export const standalonePresetRouter = Router();

standalonePresetRouter.use(authenticate);

/**
 * GET /presets
 * List all active presets
 */
standalonePresetRouter.get('/', presetController.listPresets);

/**
 * GET /presets/:id
 * Get preset detail with items
 */
standalonePresetRouter.get('/:id', presetController.getPresetById);

/**
 * Business-scoped preset routes
 * Mounted at /businesses/:businessId/presets
 */
export const businessPresetRouter = Router({ mergeParams: true });

businessPresetRouter.use(authenticate, validateBusinessAccess);

/**
 * POST /businesses/:businessId/presets
 * Create a new preset from business inventory
 */
businessPresetRouter.post(
  '/',
  requirePermission('create', 'inventory'),
  validateBody(createPresetSchema),
  presetController.createPreset
);

export default standalonePresetRouter;
