/**
 * @file Job Scheduler
 * @description Bull queue setup for scheduled background jobs
 */

import Queue from 'bull';
import { redisConfig } from '../config';
import { logger } from '../utils/logger';

/**
 * Billing queue for bill generation tasks
 */
export const billingQueue = new Queue('billing', redisConfig.url, {
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

/**
 * Notification queue for sending emails and messages
 */
export const notificationQueue = new Queue('notifications', redisConfig.url, {
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

/**
 * Reminder queue for payment reminders
 */
export const reminderQueue = new Queue('reminders', redisConfig.url, {
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 50,
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 60000,
    },
  },
});

/**
 * Job types for billing queue
 */
export enum BillingJobType {
  GENERATE_MONTHLY_BILLS = 'generate-monthly-bills',
  CHECK_OVERDUE = 'check-overdue',
  GENERATE_BILL_PDF = 'generate-bill-pdf',
}

/**
 * Job types for notification queue
 */
export enum NotificationJobType {
  SEND_INVOICE_EMAIL = 'send-invoice-email',
  SEND_PAYMENT_REMINDER = 'send-payment-reminder',
  SEND_OVERDUE_NOTICE = 'send-overdue-notice',
  SEND_WHATSAPP_MESSAGE = 'send-whatsapp-message',
}

/**
 * Job types for reminder queue
 */
export enum ReminderJobType {
  CHECK_PAYMENT_DUE = 'check-payment-due',
  SEND_DUE_REMINDERS = 'send-due-reminders',
}

/**
 * Initialize scheduled jobs
 * @param enableSchedules - Whether to enable recurring schedules
 */
export async function initializeScheduler(enableSchedules: boolean = true): Promise<void> {
  logger.info('Initializing job scheduler...');

  // Clear any existing repeatable jobs
  const billingRepeatableJobs = await billingQueue.getRepeatableJobs();
  for (const job of billingRepeatableJobs) {
    await billingQueue.removeRepeatableByKey(job.key);
  }

  const reminderRepeatableJobs = await reminderQueue.getRepeatableJobs();
  for (const job of reminderRepeatableJobs) {
    await reminderQueue.removeRepeatableByKey(job.key);
  }

  if (enableSchedules) {
    // Schedule monthly bill generation (1st of every month at midnight)
    await billingQueue.add(
      BillingJobType.GENERATE_MONTHLY_BILLS,
      {},
      {
        repeat: { cron: '0 0 1 * *' },
        jobId: 'monthly-billing',
      }
    );
    logger.info('Scheduled monthly bill generation job');

    // Check for overdue bills daily (9 AM)
    await billingQueue.add(
      BillingJobType.CHECK_OVERDUE,
      {},
      {
        repeat: { cron: '0 9 * * *' },
        jobId: 'daily-overdue-check',
      }
    );
    logger.info('Scheduled daily overdue check job');

    // Check for payment due reminders daily (10 AM)
    await reminderQueue.add(
      ReminderJobType.CHECK_PAYMENT_DUE,
      {},
      {
        repeat: { cron: '0 10 * * *' },
        jobId: 'daily-payment-due-check',
      }
    );
    logger.info('Scheduled daily payment due reminder job');
  }

  // Set up queue event handlers
  setupQueueEventHandlers();

  logger.info('Job scheduler initialized successfully');
}

/**
 * Set up event handlers for all queues
 */
function setupQueueEventHandlers(): void {
  // Billing queue events
  billingQueue.on('completed', job => {
    logger.info('Billing job completed', {
      jobId: job.id,
      jobName: job.name,
      duration: Date.now() - job.timestamp,
    });
  });

  billingQueue.on('failed', (job, err) => {
    logger.error('Billing job failed', {
      jobId: job.id,
      jobName: job.name,
      error: err.message,
      attemptsMade: job.attemptsMade,
    });
  });

  // Notification queue events
  notificationQueue.on('completed', job => {
    logger.info('Notification job completed', {
      jobId: job.id,
      jobName: job.name,
    });
  });

  notificationQueue.on('failed', (job, err) => {
    logger.error('Notification job failed', {
      jobId: job.id,
      jobName: job.name,
      error: err.message,
    });
  });

  // Reminder queue events
  reminderQueue.on('completed', job => {
    logger.info('Reminder job completed', {
      jobId: job.id,
      jobName: job.name,
    });
  });

  reminderQueue.on('failed', (job, err) => {
    logger.error('Reminder job failed', {
      jobId: job.id,
      jobName: job.name,
      error: err.message,
    });
  });
}

/**
 * Close all queues gracefully
 */
export async function closeQueues(): Promise<void> {
  await Promise.all([
    billingQueue.close(),
    notificationQueue.close(),
    reminderQueue.close(),
  ]);
  logger.info('All queues closed');
}

/**
 * Add a job to generate bill PDF
 * @param data - Job data
 */
export async function addGeneratePdfJob(data: {
  businessId: string;
  billId: string;
}): Promise<void> {
  await billingQueue.add(BillingJobType.GENERATE_BILL_PDF, data, {
    priority: 2,
  });
}

/**
 * Add a job to send invoice email
 * @param data - Job data
 */
export async function addSendInvoiceEmailJob(data: {
  businessId: string;
  billId: string;
  partyId: string;
  email: string;
}): Promise<void> {
  await notificationQueue.add(NotificationJobType.SEND_INVOICE_EMAIL, data, {
    priority: 1,
  });
}

/**
 * Add a job to send payment reminder
 * @param data - Job data
 */
export async function addPaymentReminderJob(data: {
  businessId: string;
  billId: string;
  partyId: string;
  daysOverdue: number;
}): Promise<void> {
  await notificationQueue.add(NotificationJobType.SEND_PAYMENT_REMINDER, data, {
    priority: 2,
  });
}
