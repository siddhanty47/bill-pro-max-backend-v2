/**
 * @file Invoice Generator
 * @description Generates PDF documents for invoices and challans using react-pdf.
 */

import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { InvoiceTemplate, InvoiceData } from '../templates/invoice';
import { ChallanTemplate, ChallanData } from '../templates/challan';
import { IBill, IChallan, IBusiness, IParty } from '../models';
import { formatDate } from './utils/dateUtils';
import { logger } from '../utils/logger';
import { getStateNameFromCode } from '../utils/gstStateCodes';

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
        date: formatDate(bill.billDate ?? bill.createdAt),
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
          slabStart: item.slabStart ? formatDate(item.slabStart) : undefined,
          slabEnd: item.slabEnd ? formatDate(item.slabEnd) : undefined,
        })),
        subtotal: bill.subtotal,
        taxMode: bill.taxMode,
        taxRate: bill.taxRate,
        sgstRate: bill.sgstRate ?? 0,
        cgstRate: bill.cgstRate ?? 0,
        igstRate: bill.igstRate ?? 0,
        sgstAmount: bill.sgstAmount ?? 0,
        cgstAmount: bill.cgstAmount ?? 0,
        igstAmount: bill.igstAmount ?? 0,
        taxAmount: bill.taxAmount,
        discountRate: bill.discountRate,
        discountAmount: bill.discountAmount,
        totalAmount: bill.totalAmount,
        currency: bill.currency,
        notes: bill.notes,
        damageCharges: (bill as any).damageCharges ?? 0,
        damageItems: ((bill as any).damageItems || []).map((d: any) => ({
          itemName: d.itemName,
          quantity: d.quantity,
          damageRate: d.damageRate,
          amount: d.amount,
          note: d.note,
        })),
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
      const businessStateCode =
        business.stateCode ??
        (business.gst?.length === 15 ? business.gst.substring(0, 2) : undefined);
      const businessStateName = getStateNameFromCode(businessStateCode);

      const agreement = party.agreements?.find(
        a => a.agreementId === challan.agreementId
      );
      const site = agreement
        ? party.sites?.find(s => s.code === agreement.siteCode)
        : undefined;
      const partyStateCode =
        site?.stateCode ??
        party.contact?.stateCode ??
        (party.contact?.gst?.length === 15 ? party.contact.gst.substring(0, 2) : undefined);
      const partyStateName = getStateNameFromCode(partyStateCode);

      const challanData: ChallanData = {
        challanNumber: challan.challanNumber,
        type: challan.type,
        date: formatDate(challan.date),
        business: {
          name: business.name,
          address: business.address,
          phone: business.phone,
          gst: business.gst,
          stateCode: businessStateCode,
          stateName: businessStateName || undefined,
        },
        party: {
          name: party.name,
          address: party.contact.address,
          phone: party.contact.phone,
          contactPerson: party.contact.person,
          gst: party.contact?.gst,
          stateCode: partyStateCode,
          stateName: partyStateName || undefined,
        },
        items: challan.items.map(item => ({
          itemName: item.itemName,
          quantity: item.quantity,
          unit: 'pcs', // TODO: Get from inventory
        })),
        sacCode: '995457',
        hsnCode: '7308',
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
