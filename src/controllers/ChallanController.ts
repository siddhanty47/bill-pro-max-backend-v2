/**
 * @file Challan Controller
 * @description HTTP request handlers for challan management
 */

import { Request, Response, NextFunction } from 'express';
import { ChallanService } from '../services';
import { paginationSchema } from '../types/api';

/**
 * Challan Controller class
 */
export class ChallanController {
  private challanService: ChallanService;

  constructor() {
    this.challanService = new ChallanService();
  }

  /**
   * Get all challans
   */
  getChallans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;
      const pagination = paginationSchema.parse(req.query);
      const { type, partyId, status, dateFrom, dateTo } = req.query;

      const result = await this.challanService.getChallans(
        businessId,
        {
          type: type as 'delivery' | 'return' | undefined,
          partyId: partyId as string | undefined,
          status: status as 'draft' | 'confirmed' | 'cancelled' | undefined,
          dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
          dateTo: dateTo ? new Date(dateTo as string) : undefined,
        },
        pagination
      );

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        message: 'Challans retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get challan by ID
   */
  getChallanById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, id } = req.params;

      const challan = await this.challanService.getChallanById(businessId, id);

      res.status(200).json({
        success: true,
        data: challan,
        message: 'Challan retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create challan
   */
  createChallan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;

      const challan = await this.challanService.createChallan(businessId, req.body);

      res.status(201).json({
        success: true,
        data: challan,
        message: 'Challan created successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Confirm challan
   */
  confirmChallan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, id } = req.params;
      const { confirmedBy } = req.body;

      const challan = await this.challanService.confirmChallan(businessId, id, confirmedBy);

      res.status(200).json({
        success: true,
        data: challan,
        message: 'Challan confirmed successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Predict the next challan number for a given type and date.
   * Query params: type (delivery|return), date (ISO string, optional).
   */
  getNextChallanNumber = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;
      const { type, date } = req.query;

      if (!type || (type !== 'delivery' && type !== 'return')) {
        res.status(400).json({
          success: false,
          message: 'Query param "type" must be "delivery" or "return"',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const parsedDate = date ? new Date(date as string) : undefined;
      const challanNumber = await this.challanService.getNextChallanNumber(
        businessId,
        type as 'delivery' | 'return',
        parsedDate
      );

      res.status(200).json({
        success: true,
        data: challanNumber,
        message: 'Next challan number predicted successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get items currently with a party (optionally filtered by agreementId query param).
   */
  getItemsWithParty = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, partyId } = req.params;
      const { agreementId } = req.query;

      const items = await this.challanService.getItemsWithParty(
        businessId,
        partyId,
        agreementId as string | undefined
      );

      res.status(200).json({
        success: true,
        data: items,
        message: 'Items with party retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}

export default ChallanController;
