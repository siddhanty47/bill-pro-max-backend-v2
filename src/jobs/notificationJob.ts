/**
 * @file Notification Job Processor
 * @description Processes notification background jobs
 */

import { Job } from 'bull';
import { notificationQueue, NotificationJobType } from './scheduler';
import { NotificationService } from '../services/NotificationService';
import { BillRepository, PartyRepository, BusinessRepository } from '../repositories';
import { InvoiceGenerator } from '../billing/InvoiceGenerator';
import { logger } from '../utils/logger';

/**
 * Send invoice email job data
 */
interface SendInvoiceEmailJobData {
  businessId: string;
  billId: string;
  partyId: string;
  email: string;
}

/**
 * Send payment reminder job data
 */
interface SendPaymentReminderJobData {
  businessId: string;
  billId: string;
  partyId: string;
  daysOverdue: number;
}

/**
 * Send WhatsApp message job data
 */
interface SendWhatsAppJobData {
  businessId: string;
  billId: string;
  partyId: string;
  phone: string;
}

/**
 * Initialize notification job processors
 */
export function initializeNotificationJobProcessors(): void {
  const notificationService = new NotificationService();
  const billRepository = new BillRepository();
  const partyRepository = new PartyRepository();
  const businessRepository = new BusinessRepository();
  const invoiceGenerator = new InvoiceGenerator();

  // Process invoice email
  notificationQueue.process(NotificationJobType.SEND_INVOICE_EMAIL, async (job: Job<SendInvoiceEmailJobData>) => {
    logger.info('Processing invoice email job', {
      jobId: job.id,
      billId: job.data.billId,
    });

    try {
      const [bill, party, business] = await Promise.all([
        billRepository.findById(job.data.billId),
        partyRepository.findById(job.data.partyId),
        businessRepository.findById(job.data.businessId),
      ]);

      if (!bill || !party || !business) {
        throw new Error('Required data not found');
      }

      // Generate PDF
      let pdfBuffer: Buffer | undefined;
      try {
        pdfBuffer = await invoiceGenerator.generateInvoicePDF(bill, business, party);
      } catch (pdfError) {
        logger.warn('Failed to generate PDF, sending email without attachment', {
          error: pdfError,
        });
      }

      const result = await notificationService.sendInvoiceEmail(party, bill, business, pdfBuffer);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Update bill as sent
      await billRepository.updateStatus(job.data.billId, 'sent');

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      logger.error('Invoice email job failed', {
        billId: job.data.billId,
        error,
      });
      throw error;
    }
  });

  // Process payment reminder
  notificationQueue.process(NotificationJobType.SEND_PAYMENT_REMINDER, async (job: Job<SendPaymentReminderJobData>) => {
    logger.info('Processing payment reminder job', {
      jobId: job.id,
      billId: job.data.billId,
    });

    try {
      const [bill, party, business] = await Promise.all([
        billRepository.findById(job.data.billId),
        partyRepository.findById(job.data.partyId),
        businessRepository.findById(job.data.businessId),
      ]);

      if (!bill || !party || !business) {
        throw new Error('Required data not found');
      }

      const result = await notificationService.sendPaymentReminderEmail(
        party,
        bill,
        business,
        job.data.daysOverdue
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      logger.error('Payment reminder job failed', {
        billId: job.data.billId,
        error,
      });
      throw error;
    }
  });

  // Process overdue notice
  notificationQueue.process(NotificationJobType.SEND_OVERDUE_NOTICE, async (job: Job<SendPaymentReminderJobData>) => {
    logger.info('Processing overdue notice job', {
      jobId: job.id,
      billId: job.data.billId,
    });

    try {
      const [bill, party, business] = await Promise.all([
        billRepository.findById(job.data.billId),
        partyRepository.findById(job.data.partyId),
        businessRepository.findById(job.data.businessId),
      ]);

      if (!bill || !party || !business) {
        throw new Error('Required data not found');
      }

      // Send both email and WhatsApp if configured
      const emailResult = await notificationService.sendPaymentReminderEmail(
        party,
        bill,
        business,
        job.data.daysOverdue
      );

      let whatsAppResult;
      if (party.contact.phone) {
        whatsAppResult = await notificationService.sendWhatsAppInvoiceReminder(party, bill, business);
      }

      return {
        success: true,
        emailSent: emailResult.success,
        whatsAppSent: whatsAppResult?.success || false,
      };
    } catch (error) {
      logger.error('Overdue notice job failed', {
        billId: job.data.billId,
        error,
      });
      throw error;
    }
  });

  // Process WhatsApp message
  notificationQueue.process(NotificationJobType.SEND_WHATSAPP_MESSAGE, async (job: Job<SendWhatsAppJobData>) => {
    logger.info('Processing WhatsApp message job', {
      jobId: job.id,
      billId: job.data.billId,
    });

    try {
      const [bill, party, business] = await Promise.all([
        billRepository.findById(job.data.billId),
        partyRepository.findById(job.data.partyId),
        businessRepository.findById(job.data.businessId),
      ]);

      if (!bill || !party || !business) {
        throw new Error('Required data not found');
      }

      const result = await notificationService.sendWhatsAppInvoiceReminder(party, bill, business);

      if (!result.success) {
        throw new Error(result.error);
      }

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      logger.error('WhatsApp message job failed', {
        billId: job.data.billId,
        error,
      });
      throw error;
    }
  });

  logger.info('Notification job processors initialized');
}
