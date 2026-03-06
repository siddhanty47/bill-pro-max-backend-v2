/**
 * @file Jobs index
 * @description Central export and initialization for all background jobs
 */

export {
  billingQueue,
  notificationQueue,
  reminderQueue,
  BillingJobType,
  NotificationJobType,
  ReminderJobType,
  initializeScheduler,
  closeQueues,
  addGeneratePdfJob,
  addSendInvoiceEmailJob,
  addPaymentReminderJob,
  addGenerateBillJob,
} from './scheduler';
export type { GenerateSingleBillJobData } from './scheduler';
export { initBatch, getBatchStatus, closeBatchTracker } from './batchTracker';

export { initializeBillingJobProcessors } from './billingJob';
export { initializeReminderJobProcessors } from './reminderJob';
export { initializeNotificationJobProcessors } from './notificationJob';

import { initializeScheduler } from './scheduler';
import { initializeBillingJobProcessors } from './billingJob';
import { initializeReminderJobProcessors } from './reminderJob';
import { initializeNotificationJobProcessors } from './notificationJob';
import { logger } from '../utils/logger';

/**
 * Initialize all background job processors and schedulers
 * @param enableSchedules - Whether to enable recurring schedules
 */
export async function initializeAllJobs(enableSchedules: boolean = true): Promise<void> {
  try {
    // Initialize job processors
    initializeBillingJobProcessors();
    initializeReminderJobProcessors();
    initializeNotificationJobProcessors();

    // Initialize scheduler with recurring jobs
    await initializeScheduler(enableSchedules);

    logger.info('All background jobs initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize background jobs', { error });
    throw error;
  }
}
