/**
 * @file Challan Extraction Controller
 * @description HTTP handler for extracting challan data from uploaded photos
 */

import { Request, Response, NextFunction } from 'express';
import { ChallanExtractionService } from '../services/ChallanExtractionService';
import { ValidationError } from '../middleware';
import { logger } from '../utils/logger';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export class ChallanExtractionController {
  private extractionService: ChallanExtractionService;

  constructor() {
    this.extractionService = new ChallanExtractionService();
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

      const result = await this.extractionService.extractAndMatch(
        file.buffer,
        file.mimetype,
        businessId
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
