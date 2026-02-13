/**
 * @file Notification Service
 * @description Service for sending notifications via email and WhatsApp
 */

import { Resend } from 'resend';
import axios, { AxiosInstance } from 'axios';
import { emailConfig, whatsAppConfig } from '../config';
import { IBill, IBusiness, IParty } from '../models';
import { formatDate } from '../billing/utils/dateUtils';
import { formatCurrency } from '../utils/helpers';
import { logger } from '../utils/logger';

/**
 * Email options interface
 */
export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
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
   * @param options - Email options
   * @returns Notification result
   */
  async sendEmail(options: EmailOptions): Promise<NotificationResult> {
    if (!this.resend) {
      logger.warn('Resend not configured, skipping email');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const result = await this.resend.emails.send({
        from: emailConfig.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments,
      });

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

    const html = this.generateInvoiceEmailHtml(bill, business, party);

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
      subject: `Invoice ${bill.billNumber} - ${business.name}`,
      html,
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

    const html = this.generatePaymentReminderHtml(bill, business, party, daysOverdue);
    const subject =
      daysOverdue > 0
        ? `Overdue Payment Reminder - Invoice ${bill.billNumber}`
        : `Payment Reminder - Invoice ${bill.billNumber} Due Soon`;

    return this.sendEmail({
      to: party.contact.email,
      subject,
      html,
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

  /**
   * Generate invoice email HTML
   */
  private generateInvoiceEmailHtml(bill: IBill, business: IBusiness, party: IParty): string {
    const balanceDue = bill.totalAmount - bill.amountPaid;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .total { font-size: 1.5em; font-weight: bold; color: #2563eb; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${business.name}</h1>
            <p>Invoice ${bill.billNumber}</p>
          </div>
          <div class="content">
            <p>Dear ${party.contact.person},</p>
            <p>Please find attached the invoice for the billing period 
               ${formatDate(bill.billingPeriod.start)} to ${formatDate(bill.billingPeriod.end)}.</p>
            
            <div class="details">
              <div class="detail-row">
                <span>Invoice Number:</span>
                <span><strong>${bill.billNumber}</strong></span>
              </div>
              <div class="detail-row">
                <span>Invoice Date:</span>
                <span>${formatDate(bill.createdAt)}</span>
              </div>
              <div class="detail-row">
                <span>Due Date:</span>
                <span>${formatDate(bill.dueDate)}</span>
              </div>
              <div class="detail-row">
                <span>Subtotal:</span>
                <span>${formatCurrency(bill.subtotal)}</span>
              </div>
              ${bill.taxAmount > 0 ? `
              <div class="detail-row">
                <span>Tax (${bill.taxRate}%):</span>
                <span>${formatCurrency(bill.taxAmount)}</span>
              </div>
              ` : ''}
              ${bill.discountAmount > 0 ? `
              <div class="detail-row">
                <span>Discount:</span>
                <span>-${formatCurrency(bill.discountAmount)}</span>
              </div>
              ` : ''}
              <div class="detail-row total">
                <span>Amount Due:</span>
                <span>${formatCurrency(balanceDue)}</span>
              </div>
            </div>
            
            <p>Please ensure payment is made by the due date to avoid any late fees.</p>
            <p>If you have any questions, please don't hesitate to contact us.</p>
            
            <p>Thank you for your business!</p>
          </div>
          <div class="footer">
            <p>This is an automated email from ${business.name}.</p>
            ${business.email ? `<p>Contact: ${business.email}</p>` : ''}
            ${business.phone ? `<p>Phone: ${business.phone}</p>` : ''}
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate payment reminder email HTML
   */
  private generatePaymentReminderHtml(
    bill: IBill,
    business: IBusiness,
    party: IParty,
    daysOverdue: number
  ): string {
    const balanceDue = bill.totalAmount - bill.amountPaid;
    const isOverdue = daysOverdue > 0;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${isOverdue ? '#dc2626' : '#f59e0b'}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .total { font-size: 1.5em; font-weight: bold; color: ${isOverdue ? '#dc2626' : '#f59e0b'}; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
          .urgent { color: #dc2626; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${isOverdue ? 'Payment Overdue' : 'Payment Reminder'}</h1>
            <p>${business.name}</p>
          </div>
          <div class="content">
            <p>Dear ${party.contact.person},</p>
            
            ${isOverdue ? `
            <p class="urgent">Your payment for Invoice ${bill.billNumber} is ${daysOverdue} days overdue.</p>
            ` : `
            <p>This is a friendly reminder that Invoice ${bill.billNumber} is due in ${Math.abs(daysOverdue)} days.</p>
            `}
            
            <div class="details">
              <div class="detail-row">
                <span>Invoice Number:</span>
                <span><strong>${bill.billNumber}</strong></span>
              </div>
              <div class="detail-row">
                <span>Due Date:</span>
                <span>${formatDate(bill.dueDate)}</span>
              </div>
              <div class="detail-row total">
                <span>Amount Due:</span>
                <span>${formatCurrency(balanceDue)}</span>
              </div>
            </div>
            
            <p>Please make the payment at your earliest convenience to avoid any inconvenience.</p>
            <p>If you have already made the payment, please disregard this reminder.</p>
            
            <p>Thank you!</p>
          </div>
          <div class="footer">
            <p>This is an automated reminder from ${business.name}.</p>
            ${business.email ? `<p>Contact: ${business.email}</p>` : ''}
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export default NotificationService;
