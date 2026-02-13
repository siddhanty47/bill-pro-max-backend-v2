/**
 * @file GSTIN Controller
 * @description HTTP request handler for GSTIN lookup.
 * Provides an endpoint to fetch GST registration details
 * for a given GSTIN number via gstincheck.co.in API.
 */

import { Request, Response, NextFunction } from 'express';
import { GstinService } from '../services';
import { logger } from '../utils/logger';

/**
 * GSTIN Controller class
 *
 * Handles HTTP requests for GSTIN lookup operations.
 * Used by both party and business forms to auto-fill
 * details from a GSTIN number.
 */
export class GstinController {
  private gstinService: GstinService;

  constructor() {
    this.gstinService = new GstinService();
  }

  /**
   * Lookup GSTIN details
   *
   * Fetches business registration details for the given GSTIN number.
   * Returns legal name, trade name, address, status, and other details
   * that can be used to auto-fill party/business creation forms.
   *
   * @route GET /businesses/:businessId/gstin/:gstinNumber
   */
  lookupGstin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { gstinNumber } = req.params;

      if (!gstinNumber) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'GSTIN number is required' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const details = await this.gstinService.lookupGstin(gstinNumber);

      res.status(200).json({
        success: true,
        data: details,
        message: 'GSTIN details fetched successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}

export default GstinController;
