/**
 * @file Bill Controller
 * @description HTTP request handlers for bill/invoice management
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { BillingService, PaymentService } from '../services';
import { paginationSchema } from '../types/api';
import { addGenerateBillJob, initBatch } from '../jobs';
import { AuthenticatedRequest } from '../middleware';

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
   * Download bill PDF
   */
  getBillPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, id } = req.params;

      const pdfBuffer = await this.billingService.generateBillPdf(businessId, id);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="invoice-${id}.pdf"`
      );
      res.send(pdfBuffer);
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
   * Get predicted next bill number
   */
  getNextBillNumber = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;
      const { partyId, agreementId, periodStart } = req.query;

      if (!partyId || !agreementId || !periodStart) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'partyId, agreementId, and periodStart are required' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const billNumber = await this.billingService.getNextBillNumber(
        businessId,
        partyId as string,
        agreementId as string,
        new Date(periodStart as string)
      );

      res.status(200).json({
        success: true,
        data: billNumber,
        message: 'Next bill number retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Generate bill (async via job queue)
   */
  generateBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;
      const userId = (req as AuthenticatedRequest).user.id;
      const batchId = uuidv4();

      await initBatch(batchId, 1);
      await addGenerateBillJob({
        businessId,
        userId,
        batchId,
        input: req.body,
      });

      res.status(202).json({
        success: true,
        data: { batchId, jobCount: 1 },
        message: 'Bill generation queued',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Bulk generate bills (async via job queue)
   */
  bulkGenerateBills = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;
      const userId = (req as AuthenticatedRequest).user.id;
      const { agreements, billDate, billingPeriod, taxMode, sgstRate, cgstRate, igstRate, discountRate, notes } = req.body;
      const batchId = uuidv4();

      await initBatch(batchId, agreements.length);

      for (const { partyId, agreementId } of agreements) {
        await addGenerateBillJob({
          businessId,
          userId,
          batchId,
          input: {
            billDate,
            partyId,
            agreementId,
            billingPeriod,
            taxMode,
            sgstRate,
            cgstRate,
            igstRate,
            discountRate,
            notes,
          },
        });
      }

      res.status(202).json({
        success: true,
        data: { batchId, jobCount: agreements.length },
        message: `${agreements.length} bill generation job(s) queued`,
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
   * Send bill via email
   */
  sendBillEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, id } = req.params;

      await this.billingService.sendBillEmail(businessId, id);

      res.status(200).json({
        success: true,
        message: 'Bill email queued for delivery',
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
