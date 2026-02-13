/**
 * @file Payment Controller
 * @description HTTP request handlers for payment management
 */

import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services';
import { paginationSchema } from '../types/api';

/**
 * Payment Controller class
 */
export class PaymentController {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  /**
   * Get all payments
   */
  getPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;
      const pagination = paginationSchema.parse(req.query);
      const { type, partyId, billId, status, dateFrom, dateTo } = req.query;

      const result = await this.paymentService.getPayments(
        businessId,
        {
          type: type as 'receivable' | 'payable' | undefined,
          partyId: partyId as string | undefined,
          billId: billId as string | undefined,
          status: status as 'pending' | 'completed' | 'failed' | 'cancelled' | undefined,
          dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
          dateTo: dateTo ? new Date(dateTo as string) : undefined,
        },
        pagination
      );

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        message: 'Payments retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get payment by ID
   */
  getPaymentById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, id } = req.params;

      const payment = await this.paymentService.getPaymentById(businessId, id);

      res.status(200).json({
        success: true,
        data: payment,
        message: 'Payment retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create payment
   */
  createPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;

      const payment = await this.paymentService.createPayment(businessId, req.body);

      res.status(201).json({
        success: true,
        data: payment,
        message: 'Payment recorded successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get payment statistics
   */
  getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;
      const { dateFrom, dateTo } = req.query;

      const startDate = dateFrom ? new Date(dateFrom as string) : new Date(new Date().setDate(1));
      const endDate = dateTo ? new Date(dateTo as string) : new Date();

      const stats = await this.paymentService.getStats(businessId, startDate, endDate);

      res.status(200).json({
        success: true,
        data: stats,
        message: 'Payment statistics retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}

export default PaymentController;
