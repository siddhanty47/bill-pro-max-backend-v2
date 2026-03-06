/**
 * @file Job Scheduler
 * @description Bull queue setup for scheduled background jobs
 */

import Queue from 'bull';
import { redisConfig } from '../config';
import { logger } from '../utils/logger';
import { registerNotificationProcessors } from './notificationJob';
import { registerReminderProcessors } from './reminderJob';

const isTls = redisConfig.url.startsWith('rediss://');
const redisOpts: Queue.QueueOptions['redis'] = isTls
  ? { tls: { rejectUnauthorized: false } }
  : undefined;

/** Bull settings to reduce Redis command usage (drainDelay, guardInterval, stalledInterval) */
const REDUCE_COMMANDS_SETTINGS: Queue.QueueOptions['settings'] = {
  drainDelay: 30,
  guardInterval: 15000,
  stalledInterval: 60000,
};

function createQueue(
  name: string,
  opts: Queue.QueueOptions['defaultJobOptions'],
  settings?: Queue.QueueOptions['settings']
): Queue.Queue {
  return new Queue(name, redisConfig.url, {
    redis: redisOpts,
    defaultJobOptions: opts,
    settings: { ...REDUCE_COMMANDS_SETTINGS, ...settings },
  });
}

/**
 * Billing queue for bill generation tasks (always active)
 */
export const billingQueue = createQueue('billing', {
  removeOnComplete: 100,
  removeOnFail: 50,
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,
  },
});

/** Lazy-initialized notification queue (created on first use) */
let _notificationQueue: Queue.Queue | null = null;

/** Lazy-initialized reminder queue (created on first use) */
let _reminderQueue: Queue.Queue | null = null;

function createNotificationQueue(): Queue.Queue {
  const queue = createQueue('notifications', {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });
  registerNotificationProcessors(queue);
  queue.on('completed', job => {
    logger.info('Notification job completed', { jobId: job.id, jobName: job.name });
  });
  queue.on('failed', (job, err) => {
    logger.error('Notification job failed', {
      jobId: job.id,
      jobName: job.name,
      error: err.message,
    });
  });
  return queue;
}

function createReminderQueue(): Queue.Queue {
  const queue = createQueue('reminders', {
    removeOnComplete: 50,
    removeOnFail: 50,
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 60000,
    },
  });
  registerReminderProcessors(queue, { addPaymentReminderJob });
  queue.on('completed', job => {
    logger.info('Reminder job completed', { jobId: job.id, jobName: job.name });
  });
  queue.on('failed', (job, err) => {
    logger.error('Reminder job failed', {
      jobId: job.id,
      jobName: job.name,
      error: err.message,
    });
  });
  return queue;
}

/**
 * Get notification queue (lazy-initialized on first use)
 */
export function getNotificationQueue(): Queue.Queue {
  if (!_notificationQueue) {
    _notificationQueue = createNotificationQueue();
    logger.info('Notification queue initialized (lazy)');
  }
  return _notificationQueue;
}

/**
 * Get reminder queue (lazy-initialized on first use)
 */
export function getReminderQueue(): Queue.Queue {
  if (!_reminderQueue) {
    _reminderQueue = createReminderQueue();
    logger.info('Reminder queue initialized (lazy)');
  }
  return _reminderQueue;
}


/**
 * Job types for billing queue
 */
export enum BillingJobType {
  GENERATE_MONTHLY_BILLS = 'generate-monthly-bills',
  CHECK_OVERDUE = 'check-overdue',
  GENERATE_BILL_PDF = 'generate-bill-pdf',
  GENERATE_SINGLE_BILL = 'generate-single-bill',
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

  if (!enableSchedules) {
    setupQueueEventHandlers();
    logger.info('Job scheduler initialized (processors only, no schedules)');
    return;
  }

  // Clear any existing repeatable jobs
  const billingRepeatableJobs = await billingQueue.getRepeatableJobs();
  for (const job of billingRepeatableJobs) {
    await billingQueue.removeRepeatableByKey(job.key);
  }

  if (enableSchedules) {
    const reminderQueue = getReminderQueue();
    const reminderRepeatableJobs = await reminderQueue.getRepeatableJobs();
    for (const job of reminderRepeatableJobs) {
      await reminderQueue.removeRepeatableByKey(job.key);
    }

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
}

/**
 * Close all queues gracefully (including lazy-initialized ones)
 */
export async function closeQueues(): Promise<void> {
  const toClose: Promise<void>[] = [billingQueue.close()];
  if (_notificationQueue) {
    toClose.push(_notificationQueue.close());
    _notificationQueue = null;
  }
  if (_reminderQueue) {
    toClose.push(_reminderQueue.close());
    _reminderQueue = null;
  }
  await Promise.all(toClose);
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
  await getNotificationQueue().add(NotificationJobType.SEND_INVOICE_EMAIL, data, {
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
  await getNotificationQueue().add(NotificationJobType.SEND_PAYMENT_REMINDER, data, {
    priority: 2,
  });
}

export interface GenerateSingleBillJobData {
  businessId: string;
  userId: string;
  batchId: string;
  input: {
    billDate?: Date;
    partyId: string;
    agreementId: string;
    billingPeriod: { start: Date; end: Date };
    taxMode?: 'intra' | 'inter';
    taxRate?: number;
    sgstRate?: number;
    cgstRate?: number;
    igstRate?: number;
    discountRate?: number;
    notes?: string;
  };
}

/**
 * Add a job to generate a single bill asynchronously
 */
export async function addGenerateBillJob(data: GenerateSingleBillJobData): Promise<void> {
  await billingQueue.add(BillingJobType.GENERATE_SINGLE_BILL, data, {
    priority: 1,
  });
}
