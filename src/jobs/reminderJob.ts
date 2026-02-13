/**
 * @file Reminder Job Processor
 * @description Processes payment reminder background jobs
 */

import { Job } from 'bull';
import { reminderQueue, ReminderJobType, addPaymentReminderJob } from './scheduler';
import { BillRepository, BusinessRepository, PartyRepository } from '../repositories';
import { logger } from '../utils/logger';

/**
 * Check payment due job data
 */
interface CheckPaymentDueJobData {
  businessId?: string;
  reminderDays?: number[]; // Days before due date to send reminders
}

/**
 * Initialize reminder job processors
 */
export function initializeReminderJobProcessors(): void {
  // Process payment due check
  reminderQueue.process(ReminderJobType.CHECK_PAYMENT_DUE, async (job: Job<CheckPaymentDueJobData>) => {
    logger.info('Starting payment due check', { jobId: job.id });

    const businessRepository = new BusinessRepository();
    const billRepository = new BillRepository();
    const partyRepository = new PartyRepository();

    const reminderDays = job.data.reminderDays || [7, 3, 1, 0]; // Days before/on due date

    try {
      let businesses;
      if (job.data.businessId) {
        const business = await businessRepository.findById(job.data.businessId);
        businesses = business ? [business] : [];
      } else {
        businesses = await businessRepository.find({ isActive: true });
      }

      let totalRemindersQueued = 0;

      for (const business of businesses) {
        try {
          // Get all unpaid bills
          const result = await billRepository.findByBusiness(
            business._id.toString(),
            {
              status: 'sent' as const,
            }
          );

          const today = new Date();
          today.setHours(0, 0, 0, 0);

          for (const bill of result.data) {
            const dueDate = new Date(bill.dueDate);
            dueDate.setHours(0, 0, 0, 0);

            const daysUntilDue = Math.ceil(
              (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            );

            // Check if we should send a reminder
            if (reminderDays.includes(daysUntilDue)) {
              const party = await partyRepository.findById(bill.partyId);
              if (party?.contact.email) {
                await addPaymentReminderJob({
                  businessId: business._id.toString(),
                  billId: bill._id.toString(),
                  partyId: bill.partyId.toString(),
                  daysOverdue: daysUntilDue <= 0 ? Math.abs(daysUntilDue) : -daysUntilDue,
                });
                totalRemindersQueued++;
              }
            }
          }
        } catch (error) {
          logger.error('Failed to check payment due for business', {
            businessId: business._id,
            error,
          });
        }
      }

      return {
        success: true,
        totalRemindersQueued,
        businessesProcessed: businesses.length,
      };
    } catch (error) {
      logger.error('Payment due check job failed', { error });
      throw error;
    }
  });

  logger.info('Reminder job processors initialized');
}
