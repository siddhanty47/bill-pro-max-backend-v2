/**
 * @file Bill Controller
 * @description HTTP request handlers for bill/invoice management
 */

import { Request, Response, NextFunction } from 'express';
import { BillingService, PaymentService } from '../services';
import { paginationSchema } from '../types/api';

/**
 * Bill Controller class
 */
export class BillController {
  private billingService: BillingService;

  constructor() {
    this.billingService = new BillingService();
  }

  /**
   * Get all bills
   */
  getBills = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;
      const pagination = paginationSchema.parse(req.query);
      const { partyId, status, dateFrom, dateTo, overdueOnly } = req.query;

      const result = await this.billingService.getBills(
        businessId,
        {
          partyId: partyId as string | undefined,
          status: status as 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled' | undefined,
          dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
          dateTo: dateTo ? new Date(dateTo as string) : undefined,
          overdueOnly: overdueOnly === 'true',
        },
        pagination
      );

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        message: 'Bills retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get bill by ID
   */
  getBillById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, id } = req.params;

      const bill = await this.billingService.getBillById(businessId, id);

      res.status(200).json({
        success: true,
        data: bill,
        message: 'Bill retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Generate bill
   */
  generateBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;

      const bill = await this.billingService.generateBill(businessId, req.body);

      res.status(201).json({
        success: true,
        data: bill,
        message: 'Bill generated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get overdue bills
   */
  getOverdueBills = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;

      const bills = await this.billingService.getOverdueBills(businessId);

      res.status(200).json({
        success: true,
        data: bills,
        message: 'Overdue bills retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update bill status
   */
  updateBillStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, id } = req.params;
      const { status } = req.body;

      const bill = await this.billingService.updateBillStatus(businessId, id, status);

      res.status(200).json({
        success: true,
        data: bill,
        message: 'Bill status updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get payment summary
   */
  getPaymentSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;

      const summary = await this.billingService.getPaymentSummary(businessId);

      res.status(200).json({
        success: true,
        data: summary,
        message: 'Payment summary retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete a bill
   */
  deleteBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, id } = req.params;
      const force = req.query.force === 'true';

      await this.billingService.deleteBill(businessId, id, force);

      res.status(200).json({
        success: true,
        message: 'Bill deleted successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}

export default BillController;
