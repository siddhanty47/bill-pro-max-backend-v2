/**
 * @file Invoice Generator
 * @description Generates PDF documents for invoices and challans using react-pdf
 */

import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { InvoiceTemplate, InvoiceData } from '../templates/invoice';
import { ChallanTemplate, ChallanData } from '../templates/challan';
import { IBill, IChallan, IBusiness, IParty } from '../models';
import { formatDate } from './utils/dateUtils';
import { logger } from '../utils/logger';

/**
 * Invoice Generator class
 */
export class InvoiceGenerator {
  /**
   * Generate invoice PDF buffer
   * @param bill - Bill document
   * @param business - Business document
   * @param party - Party document
   * @returns PDF buffer
   */
  async generateInvoicePDF(
    bill: IBill,
    business: IBusiness,
    party: IParty
  ): Promise<Buffer> {
    try {
      const invoiceData: InvoiceData = {
        billNumber: bill.billNumber,
        date: formatDate(bill.createdAt),
        dueDate: formatDate(bill.dueDate),
        business: {
          name: business.name,
          address: business.address,
          phone: business.phone,
          email: business.email,
          gst: business.gst,
        },
        party: {
          name: party.name,
          address: party.contact.address,
          phone: party.contact.phone,
          email: party.contact.email,
          gst: party.contact.gst,
        },
        billingPeriod: {
          start: formatDate(bill.billingPeriod.start),
          end: formatDate(bill.billingPeriod.end),
        },
        items: bill.items.map(item => ({
          itemName: item.itemName,
          quantity: item.quantity,
          ratePerDay: item.ratePerDay,
          totalDays: item.totalDays,
          amount: item.amount,
        })),
        subtotal: bill.subtotal,
        taxRate: bill.taxRate,
        taxAmount: bill.taxAmount,
        discountRate: bill.discountRate,
        discountAmount: bill.discountAmount,
        totalAmount: bill.totalAmount,
        currency: bill.currency,
        notes: bill.notes,
      };

      const element = React.createElement(InvoiceTemplate, { data: invoiceData });
      const pdfBuffer = await renderToBuffer(element as React.ReactElement);

      logger.info('Invoice PDF generated', {
        billNumber: bill.billNumber,
        size: pdfBuffer.length,
      });

      return pdfBuffer;
    } catch (error) {
      logger.error('Failed to generate invoice PDF', { billNumber: bill.billNumber, error });
      throw error;
    }
  }

  /**
   * Generate challan PDF buffer
   * @param challan - Challan document
   * @param business - Business document
   * @param party - Party document
   * @returns PDF buffer
   */
  async generateChallanPDF(
    challan: IChallan,
    business: IBusiness,
    party: IParty
  ): Promise<Buffer> {
    try {
      const challanData: ChallanData = {
        challanNumber: challan.challanNumber,
        type: challan.type,
        date: formatDate(challan.date),
        business: {
          name: business.name,
          address: business.address,
          phone: business.phone,
        },
        party: {
          name: party.name,
          address: party.contact.address,
          phone: party.contact.phone,
          contactPerson: party.contact.person,
        },
        items: challan.items.map(item => ({
          itemName: item.itemName,
          quantity: item.quantity,
          unit: 'pcs', // TODO: Get from inventory
          condition: item.condition,
        })),
        notes: challan.notes,
        confirmedBy: challan.confirmedBy,
        confirmedAt: challan.confirmedAt ? formatDate(challan.confirmedAt) : undefined,
      };

      const element = React.createElement(ChallanTemplate, { data: challanData });
      const pdfBuffer = await renderToBuffer(element as React.ReactElement);

      logger.info('Challan PDF generated', {
        challanNumber: challan.challanNumber,
        size: pdfBuffer.length,
      });

      return pdfBuffer;
    } catch (error) {
      logger.error('Failed to generate challan PDF', {
        challanNumber: challan.challanNumber,
        error,
      });
      throw error;
    }
  }
}

export default InvoiceGenerator;
