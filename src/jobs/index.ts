/**
 * @file Jobs index
 * @description Central export and initialization for all background jobs
 */

export {
  billingQueue,
  getNotificationQueue,
  getReminderQueue,
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
export { registerNotificationProcessors } from './notificationJob';
export { registerReminderProcessors } from './reminderJob';

import { initializeScheduler } from './scheduler';
import { initializeBillingJobProcessors } from './billingJob';
import { logger } from '../utils/logger';

/**
 * Initialize all background job processors and schedulers.
 * Notification and reminder queues are lazy-initialized on first use.
 * @param enableSchedules - Whether to enable recurring schedules
 */
export async function initializeAllJobs(enableSchedules: boolean = true): Promise<void> {
  try {
    // Initialize billing job processors (always needed for bill generation)
    initializeBillingJobProcessors();

    // Initialize scheduler (creates reminder queue only when enableSchedules is true)
    await initializeScheduler(enableSchedules);

    logger.info('All background jobs initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize background jobs', { error });
    throw error;
  }
}
