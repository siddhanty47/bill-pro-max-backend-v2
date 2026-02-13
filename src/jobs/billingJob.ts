/**
 * @file Billing Job Processor
 * @description Processes billing-related background jobs
 */

import { Job } from 'bull';
import { billingQueue, BillingJobType, addSendInvoiceEmailJob } from './scheduler';
import { BillingService } from '../services';
import { BusinessRepository } from '../repositories';
import { InvoiceGenerator } from '../billing/InvoiceGenerator';
import { Business, Bill, Party } from '../models';
import { logger } from '../utils/logger';

/**
 * Monthly bill generation job data
 */
interface MonthlyBillsJobData {
  businessId?: string; // Optional: specific business, otherwise all
}

/**
 * Check overdue job data
 */
interface CheckOverdueJobData {
  businessId?: string; // Optional: specific business, otherwise all
}

/**
 * Generate PDF job data
 */
interface GeneratePdfJobData {
  businessId: string;
  billId: string;
}

/**
 * Initialize billing job processors
 */
export function initializeBillingJobProcessors(): void {
  // Process monthly bill generation
  billingQueue.process(BillingJobType.GENERATE_MONTHLY_BILLS, async (job: Job<MonthlyBillsJobData>) => {
    logger.info('Starting monthly bill generation', { jobId: job.id });

    const businessRepository = new BusinessRepository();
    const billingService = new BillingService();

    try {
      // Get all active businesses or specific one
      let businesses;
      if (job.data.businessId) {
        const business = await businessRepository.findById(job.data.businessId);
        businesses = business ? [business] : [];
      } else {
        businesses = await businessRepository.find({ isActive: true });
      }

      let totalBillsGenerated = 0;
      const errors: Array<{ businessId: string; error: string }> = [];

      for (const business of businesses) {
        try {
          const bills = await billingService.generateMonthlyBills(business._id.toString());
          totalBillsGenerated += bills.length;

          logger.info('Bills generated for business', {
            businessId: business._id,
            businessName: business.name,
            billCount: bills.length,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push({ businessId: business._id.toString(), error: errorMessage });
          logger.error('Failed to generate bills for business', {
            businessId: business._id,
            error: errorMessage,
          });
        }
      }

      return {
        success: true,
        totalBillsGenerated,
        businessesProcessed: businesses.length,
        errors,
      };
    } catch (error) {
      logger.error('Monthly bill generation job failed', { error });
      throw error;
    }
  });

  // Process overdue check
  billingQueue.process(BillingJobType.CHECK_OVERDUE, async (job: Job<CheckOverdueJobData>) => {
    logger.info('Starting overdue bills check', { jobId: job.id });

    const businessRepository = new BusinessRepository();
    const billingService = new BillingService();

    try {
      let businesses;
      if (job.data.businessId) {
        const business = await businessRepository.findById(job.data.businessId);
        businesses = business ? [business] : [];
      } else {
        businesses = await businessRepository.find({ isActive: true });
      }

      let totalMarkedOverdue = 0;

      for (const business of businesses) {
        try {
          const count = await billingService.markOverdueBills(business._id.toString());
          totalMarkedOverdue += count;

          if (count > 0) {
            logger.info('Bills marked as overdue', {
              businessId: business._id,
              count,
            });
          }
        } catch (error) {
          logger.error('Failed to check overdue for business', {
            businessId: business._id,
            error,
          });
        }
      }

      return {
        success: true,
        totalMarkedOverdue,
        businessesProcessed: businesses.length,
      };
    } catch (error) {
      logger.error('Overdue check job failed', { error });
      throw error;
    }
  });

  // Process PDF generation
  billingQueue.process(BillingJobType.GENERATE_BILL_PDF, async (job: Job<GeneratePdfJobData>) => {
    logger.info('Starting bill PDF generation', {
      jobId: job.id,
      billId: job.data.billId,
    });

    const invoiceGenerator = new InvoiceGenerator();
    const billingService = new BillingService();

    try {
      const bill = await Bill.findById(job.data.billId).exec();
      if (!bill) {
        throw new Error('Bill not found');
      }

      const business = await Business.findById(job.data.businessId).exec();
      if (!business) {
        throw new Error('Business not found');
      }

      const party = await Party.findById(bill.partyId).exec();
      if (!party) {
        throw new Error('Party not found');
      }

      const pdfBuffer = await invoiceGenerator.generateInvoicePDF(bill, business, party);

      // TODO: Upload to S3 or save locally
      // For now, we'll just update the bill with a placeholder
      const pdfUrl = `file://${job.data.businessId}/${job.data.billId}.pdf`;
      await billingService.updateBillPdfUrl(job.data.billId, pdfUrl);

      return {
        success: true,
        billId: job.data.billId,
        pdfSize: pdfBuffer.length,
      };
    } catch (error) {
      logger.error('PDF generation job failed', {
        billId: job.data.billId,
        error,
      });
      throw error;
    }
  });

  logger.info('Billing job processors initialized');
}
