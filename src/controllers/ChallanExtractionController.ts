/**
 * @file Challan Extraction Controller
 * @description HTTP handler for extracting challan data from uploaded photos
 */

import { Request, Response, NextFunction } from 'express';
import { ChallanExtractionService, ExtractionContext } from '../services/ChallanExtractionService';
import { PartyService, InventoryService } from '../services';
import { ValidationError } from '../middleware';
import { logger } from '../utils/logger';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export class ChallanExtractionController {
  private extractionService: ChallanExtractionService;
  private partyService: PartyService;
  private inventoryService: InventoryService;

  constructor() {
    this.extractionService = new ChallanExtractionService();
    this.partyService = new PartyService();
    this.inventoryService = new InventoryService();
  }

  extractFromPhoto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;
      const file = req.file;

      logger.info('Challan photo extraction request received', {
        businessId,
        hasFile: !!file,
        fileSize: file?.size,
        fileMimeType: file?.mimetype,
        fileOriginalName: file?.originalname,
      });

      if (!file) {
        throw new ValidationError('No photo uploaded. Please attach a challan photo.');
      }

      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw new ValidationError(`Invalid file type: ${file.mimetype}. Please upload a JPEG, PNG, or WebP image.`);
      }

      if (file.size > MAX_FILE_SIZE) {
        throw new ValidationError(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum size is 5MB.`);
      }

      // Fetch business context in parallel
      const [partiesResult, inventoryResult] = await Promise.all([
        this.partyService.getParties(businessId, {}, { page: 1, pageSize: 500 }),
        this.inventoryService.getInventory(businessId, {}, { page: 1, pageSize: 500 }),
      ]);

      const context: ExtractionContext = {
        parties: partiesResult.data.map((p) => ({
          id: p._id.toString(),
          name: p.name,
          sites: p.sites.map((s) => ({ name: s.address, code: s.code })),
        })),
        inventoryItems: inventoryResult.data.map((i) => ({
          id: i._id.toString(),
          code: i.code,
          name: i.name,
          description: i.description || undefined,
        })),
        agreements: partiesResult.data.flatMap((p) =>
          p.agreements.map((a) => ({
            id: a.agreementId,
            partyId: p._id.toString(),
            siteCode: a.siteCode,
            status: a.status,
          }))
        ),
      };

      logger.info('Business context fetched for extraction', {
        businessId,
        partiesCount: context.parties.length,
        inventoryItemsCount: context.inventoryItems.length,
        agreementsCount: context.agreements.length,
      });

      const result = await this.extractionService.extractFromPhoto(
        file.buffer,
        file.mimetype,
        context
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'Challan data extracted successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}
