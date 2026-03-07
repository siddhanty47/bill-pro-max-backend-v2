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
import type { IBillItem } from '../models';

/** Grouped invoice item for PDF display */
export interface GroupedInvoiceItem {
  itemName: string;
  itemId: string;
  ratePerDay: number;
  slabs: Array<{
    quantity: number;
    quantityDisplay: string;
    slabStart?: string;
    slabEnd?: string;
    totalDays: number;
    amount: number;
  }>;
  totalAmount: number;
}

/**
 * Group bill items by itemId, sort slabs by slabStart, compute quantityDisplay
 */
function buildGroupedInvoiceItems(
  items: IBillItem[],
  formatDate: (d: Date) => string
): GroupedInvoiceItem[] {
  const byItemId = new Map<
    string,
    { itemName: string; itemId: string; ratePerDay: number; slabs: IBillItem[] }
  >();

  for (const item of items) {
    const id = item.itemId.toString();
    const existing = byItemId.get(id);
    if (existing) {
      existing.slabs.push(item);
    } else {
      byItemId.set(id, {
        itemName: item.itemName,
        itemId: id,
        ratePerDay: item.ratePerDay,
        slabs: [item],
      });
    }
  }

  const result: GroupedInvoiceItem[] = [];

  for (const group of byItemId.values()) {
    const sortedSlabs = [...group.slabs].sort((a, b) => {
      const aStart = a.slabStart?.getTime() ?? 0;
      const bStart = b.slabStart?.getTime() ?? 0;
      return aStart - bStart;
    });

    const slabsWithDisplay = sortedSlabs.map((slab, idx) => {
      let quantityDisplay: string;
      if (idx === 0) {
        quantityDisplay = String(slab.quantity);
      } else {
        const prevQty = sortedSlabs[idx - 1].quantity;
        const delta = Math.abs(slab.quantity - prevQty);
        if (slab.quantity < prevQty) {
          quantityDisplay = `(${prevQty} - ${delta})`;
        } else if (slab.quantity > prevQty) {
          quantityDisplay = `(${prevQty} + ${delta})`;
        } else {
          quantityDisplay = String(slab.quantity);
        }
      }
      return {
        quantity: slab.quantity,
        quantityDisplay,
        slabStart: slab.slabStart ? formatDate(slab.slabStart) : undefined,
        slabEnd: slab.slabEnd ? formatDate(slab.slabEnd) : undefined,
        totalDays: slab.totalDays,
        amount: slab.amount,
      };
    });

    const totalAmount = slabsWithDisplay.reduce((sum, s) => sum + s.amount, 0);

    result.push({
      itemName: group.itemName,
      itemId: group.itemId,
      ratePerDay: group.ratePerDay,
      slabs: slabsWithDisplay,
      totalAmount,
    });
  }

  return result;
}

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
      const businessStateCode =
        business.stateCode ??
        (business.gst?.length === 15 ? business.gst.substring(0, 2) : undefined);
      const businessStateName = getStateNameFromCode(businessStateCode);

      const partyStateCode =
        party.contact?.stateCode ??
        (party.contact?.gst?.length === 15 ? party.contact.gst.substring(0, 2) : undefined);
      const partyStateName = getStateNameFromCode(partyStateCode);

      const agreement = party.agreements?.find(
        a => a.agreementId === bill.agreementId
      );
      const site = agreement
        ? party.sites?.find(s => s.code === agreement.siteCode)
        : undefined;
      const siteStateCode =
        site?.stateCode ??
        party.contact?.stateCode ??
        (party.contact?.gst?.length === 15 ? party.contact.gst.substring(0, 2) : undefined);
      const siteStateName = getStateNameFromCode(siteStateCode);

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
          stateCode: businessStateCode,
          stateName: businessStateName || undefined,
        },
        party: {
          name: party.name,
          address: party.contact.address,
          phone: party.contact.phone,
          email: party.contact.email,
          gst: party.contact.gst,
          stateCode: partyStateCode,
          stateName: partyStateName || undefined,
        },
        site: site
          ? {
              address: site.address,
              stateCode: siteStateCode,
              stateName: siteStateName || undefined,
            }
          : siteStateCode || siteStateName
            ? { stateCode: siteStateCode, stateName: siteStateName || undefined }
            : undefined,
        billingPeriod: {
          start: formatDate(bill.billingPeriod.start),
          end: formatDate(bill.billingPeriod.end),
        },
        hsnCode: '7308',
        sacCode: '995457',
        items: buildGroupedInvoiceItems(bill.items, formatDate),
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
        rentCharges:
          bill.subtotal -
          ((bill as any).transportationCharges ?? 0) -
          ((bill as any).damageCharges ?? 0),
        cartageCharges: (bill as any).transportationCharges ?? 0,
        damageCharges: (bill as any).damageCharges ?? 0,
        damageItems: ((bill as any).damageItems || []).map((d: any) => ({
          itemName: d.itemName,
          quantity: d.quantity,
          damageRate: d.damageRate,
          amount: d.amount,
          note: d.note,
          lossType: d.lossType ?? 'damage',
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
        party.contact?.stateCode ??
        (party.contact?.gst?.length === 15 ? party.contact.gst.substring(0, 2) : undefined);
      const partyStateName = getStateNameFromCode(partyStateCode);
      const siteStateCode =
        site?.stateCode ??
        party.contact?.stateCode ??
        (party.contact?.gst?.length === 15 ? party.contact.gst.substring(0, 2) : undefined);
      const siteStateName = getStateNameFromCode(siteStateCode);

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
        transport: {
          modeOfTransport: 'By Road',
          transporterName: challan.transporterName,
          vehicleNumber: challan.vehicleNumber,
        },
        site: site
          ? {
              address: site.address,
              stateCode: siteStateCode,
              stateName: siteStateName || undefined,
            }
          : siteStateCode || siteStateName
            ? { stateCode: siteStateCode, stateName: siteStateName || undefined }
            : undefined,
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
