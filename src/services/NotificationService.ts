/**
 * @file Notification Service
 * @description Service for sending notifications via email and WhatsApp
 */

import React from 'react';
import { Resend } from 'resend';
import axios, { AxiosInstance } from 'axios';
import { emailConfig, whatsAppConfig } from '../config';
import { IBill, IBusiness, IParty } from '../models';
import { formatDate } from '../billing/utils/dateUtils';
import { formatCurrency } from '../utils/helpers';
import { logger } from '../utils/logger';
import { InvoiceEmail, PaymentReminderEmail } from '../emails';

/**
 * Email options interface
 */
export interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  react?: React.ReactElement;
  attachments?: Array<{
    filename: string;
    content: Buffer;
  }>;
}

/**
 * WhatsApp message options interface
 */
export interface WhatsAppMessageOptions {
  to: string;
  template: string;
  parameters: Record<string, string>;
}

/**
 * Notification result interface
 */
export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Notification Service class
 */
export class NotificationService {
  private resend: Resend | null = null;
  private whatsAppClient: AxiosInstance | null = null;

  constructor() {
    // Initialize Resend if API key is provided
    if (emailConfig.resendApiKey) {
      this.resend = new Resend(emailConfig.resendApiKey);
    }

    // Initialize WhatsApp client if credentials are provided
    if (whatsAppConfig.accessToken && whatsAppConfig.phoneNumberId) {
      this.whatsAppClient = axios.create({
        baseURL: `${whatsAppConfig.apiUrl}/${whatsAppConfig.phoneNumberId}`,
        headers: {
          Authorization: `Bearer ${whatsAppConfig.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    }
  }

  /**
   * Send email using Resend
   * @param options - Email options (provide either `react` or `html`)
   * @returns Notification result
   */
  async sendEmail(options: EmailOptions): Promise<NotificationResult> {
    if (!this.resend) {
      logger.warn('Resend not configured, skipping email');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const base = {
        from: emailConfig.fromEmail,
        to: options.to,
        subject: options.subject,
        attachments: options.attachments,
      };

      const result = options.react
        ? await this.resend.emails.send({ ...base, react: options.react })
        : await this.resend.emails.send({ ...base, html: options.html || '' });

      if (result.error) {
        logger.error('Failed to send email', {
          to: options.to,
          error: result.error,
        });
        return { success: false, error: result.error.message };
      }

      logger.info('Email sent successfully', {
        to: options.to,
        messageId: result.data?.id,
      });

      return { success: true, messageId: result.data?.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Email sending failed', { to: options.to, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send invoice email
   * @param party - Party to send to
   * @param bill - Bill data
   * @param business - Business data
   * @param pdfBuffer - PDF attachment
   * @returns Notification result
   */
  async sendInvoiceEmail(
    party: IParty,
    bill: IBill,
    business: IBusiness,
    pdfBuffer?: Buffer
  ): Promise<NotificationResult> {
    if (!party.contact.email) {
      return { success: false, error: 'Party has no email address' };
    }

    const balanceDue = bill.totalAmount - bill.amountPaid;

    const reactElement = React.createElement(InvoiceEmail, {
      businessName: business.name,
      businessEmail: business.email,
      businessPhone: business.phone,
      contactPerson: party.contact.person,
      billNumber: bill.billNumber,
      periodStart: formatDate(bill.billingPeriod.start),
      periodEnd: formatDate(bill.billingPeriod.end),
      invoiceDate: formatDate(bill.createdAt),
      dueDate: formatDate(bill.dueDate),
      subtotal: formatCurrency(bill.subtotal),
      taxRate: bill.taxRate,
      taxAmount: bill.taxAmount > 0 ? formatCurrency(bill.taxAmount) : undefined,
      discountAmount: bill.discountAmount > 0 ? formatCurrency(bill.discountAmount) : undefined,
      balanceDue: formatCurrency(balanceDue),
    });

    const attachments = pdfBuffer
      ? [
          {
            filename: `${bill.billNumber}.pdf`,
            content: pdfBuffer,
          },
        ]
      : undefined;

    return this.sendEmail({
      to: party.contact.email,
      subject: `${business.name} - Invoice ${bill.billNumber}`,
      react: reactElement,
      attachments,
    });
  }

  /**
   * Send payment reminder email
   * @param party - Party to send to
   * @param bill - Bill data
   * @param business - Business data
   * @param daysOverdue - Days overdue (negative for days until due)
   * @returns Notification result
   */
  async sendPaymentReminderEmail(
    party: IParty,
    bill: IBill,
    business: IBusiness,
    daysOverdue: number
  ): Promise<NotificationResult> {
    if (!party.contact.email) {
      return { success: false, error: 'Party has no email address' };
    }

    const balanceDue = bill.totalAmount - bill.amountPaid;

    const reactElement = React.createElement(PaymentReminderEmail, {
      businessName: business.name,
      businessEmail: business.email,
      contactPerson: party.contact.person,
      billNumber: bill.billNumber,
      dueDate: formatDate(bill.dueDate),
      balanceDue: formatCurrency(balanceDue),
      daysOverdue,
    });

    const subject =
      daysOverdue > 0
        ? `Overdue Payment Reminder - Invoice ${bill.billNumber}`
        : `Payment Reminder - Invoice ${bill.billNumber} Due Soon`;

    return this.sendEmail({
      to: party.contact.email,
      subject,
      react: reactElement,
    });
  }

  /**
   * Send WhatsApp message
   * @param options - WhatsApp message options
   * @returns Notification result
   */
  async sendWhatsAppMessage(options: WhatsAppMessageOptions): Promise<NotificationResult> {
    if (!this.whatsAppClient) {
      logger.warn('WhatsApp not configured, skipping message');
      return { success: false, error: 'WhatsApp service not configured' };
    }

    try {
      // Format phone number (remove any non-numeric characters except +)
      const phoneNumber = options.to.replace(/[^\d+]/g, '');

      const response = await this.whatsAppClient.post('/messages', {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'template',
        template: {
          name: options.template,
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: Object.entries(options.parameters).map(([key, value]) => ({
                type: 'text',
                text: value,
              })),
            },
          ],
        },
      });

      logger.info('WhatsApp message sent', {
        to: phoneNumber,
        messageId: response.data.messages?.[0]?.id,
      });

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('WhatsApp message failed', { to: options.to, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send WhatsApp invoice reminder
   * @param party - Party to send to
   * @param bill - Bill data
   * @param business - Business data
   * @returns Notification result
   */
  async sendWhatsAppInvoiceReminder(
    party: IParty,
    bill: IBill,
    business: IBusiness
  ): Promise<NotificationResult> {
    const balanceDue = bill.totalAmount - bill.amountPaid;

    return this.sendWhatsAppMessage({
      to: party.contact.phone,
      template: 'invoice_reminder',
      parameters: {
        business_name: business.name,
        party_name: party.name,
        bill_number: bill.billNumber,
        amount: formatCurrency(balanceDue),
        due_date: formatDate(bill.dueDate),
      },
    });
  }
}

export default NotificationService;
