/**
 * @file Invoice PDF Template
 * @description React-PDF template for generating invoice documents
 */

import path from 'path';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register Roboto font (supports ₹ rupee symbol). Uses latin-ext subset for rupee (U+20B9).
// Bundled locally to avoid network dependency at runtime.
const robotoPath = path.join(__dirname, '../../node_modules/@fontsource/roboto/files');
Font.register({
  family: 'Roboto',
  fonts: [
    {
      src: path.join(robotoPath, 'roboto-latin-ext-400-normal.woff'),
      fontWeight: 400,
    },
    {
      src: path.join(robotoPath, 'roboto-latin-ext-700-normal.woff'),
      fontWeight: 700,
    },
  ],
});

/**
 * Invoice data structure
 */
export interface InvoiceData {
  billNumber: string;
  date: string;
  dueDate: string;
  business: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    gst?: string;
    stateCode?: string;
    stateName?: string;
  };
  party: {
    name: string;
    address?: string;
    phone: string;
    email?: string;
    gst?: string;
    stateCode?: string;
    stateName?: string;
  };
  site?: {
    address?: string;
    stateCode?: string;
    stateName?: string;
  };
  billingPeriod: {
    start: string;
    end: string;
  };
  items: Array<{
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
  }>;
  hsnCode: string;
  sacCode: string;
  subtotal: number;
  taxMode?: 'intra' | 'inter';
  taxRate?: number;
  sgstRate?: number;
  cgstRate?: number;
  igstRate?: number;
  sgstAmount?: number;
  cgstAmount?: number;
  igstAmount?: number;
  taxAmount: number;
  discountRate: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  notes?: string;
  /** Rent/hire charges (subtotal minus cartage and damage) */
  rentCharges?: number;
  /** Cartage/transportation charges */
  cartageCharges?: number;
  damageCharges?: number;
  damageItems?: Array<{
    itemName: string;
    quantity: number;
    damageRate: number;
    amount: number;
    note?: string;
  }>;
}

/**
 * PDF Styles
 */
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Roboto',
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  docTypeSmall: {
    fontSize: 9,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  companyNameLarge: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#1a1a1a',
    textAlign: 'center',
  },
  businessAddressCentered: {
    textAlign: 'center',
    marginBottom: 4,
    color: '#333333',
    fontSize: 10,
  },
  invoiceNumber: {
    fontSize: 10,
    color: '#666666',
    textAlign: 'center',
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  column: {
    width: '48%',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666666',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  companyName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  text: {
    marginBottom: 2,
    color: '#333333',
  },
  table: {
    marginTop: 20,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#dddddd',
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  tableCell: {
    fontSize: 9,
  },
  tableCellHeader: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#333333',
  },
  colDesc: {
    width: '22%',
  },
  colPeriod: {
    width: '16%',
    textAlign: 'center',
  },
  colDays: {
    width: '8%',
    textAlign: 'center',
  },
  colNumber: {
    width: '12%',
    textAlign: 'center',
  },
  colRate: {
    width: '12%',
    textAlign: 'right',
  },
  colAmount: {
    width: '18%',
    textAlign: 'right',
  },
  itemTotalRow: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#dddddd',
    paddingVertical: 6,
    paddingHorizontal: 5,
  },
  totalsContainer: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 5,
    width: '40%',
  },
  totalLabel: {
    width: '60%',
    textAlign: 'right',
    paddingRight: 10,
    color: '#666666',
  },
  totalValue: {
    width: '40%',
    textAlign: 'right',
  },
  grandTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    borderTopWidth: 2,
    borderTopColor: '#333333',
    paddingTop: 8,
    marginTop: 5,
  },
  notes: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
  notesTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  notesText: {
    fontSize: 9,
    color: '#666666',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999999',
  },
  periodBadge: {
    backgroundColor: '#e8f4fd',
    padding: 8,
    borderRadius: 4,
    marginBottom: 20,
  },
  periodText: {
    fontSize: 10,
    color: '#0066cc',
  },
});

/**
 * Format currency for PDF (Roboto font supports ₹ symbol)
 */
const formatCurrency = (amount: number, currency: string = 'INR'): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

/**
 * Invoice Template Component
 */
export const InvoiceTemplate: React.FC<{ data: InvoiceData }> = ({ data }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header: Doc type (small), Company name (large), Address (centered) */}
      <View style={styles.header}>
        <Text style={styles.docTypeSmall}>Tax Invoice</Text>
        <Text style={styles.companyNameLarge}>{data.business.name}</Text>
        {data.business.address && (
          <Text style={styles.businessAddressCentered}>{data.business.address}</Text>
        )}
        {data.business.phone && (
          <Text style={styles.businessAddressCentered}>Phone: {data.business.phone}</Text>
        )}
        {data.business.email && (
          <Text style={styles.businessAddressCentered}>Email: {data.business.email}</Text>
        )}
        {data.business.gst && (
          <Text style={styles.businessAddressCentered}>GSTIN: {data.business.gst}</Text>
        )}
        {data.business.stateCode && (
          <Text style={styles.businessAddressCentered}>State Code: {data.business.stateCode}</Text>
        )}
        {data.business.stateName && (
          <Text style={styles.businessAddressCentered}>State: {data.business.stateName}</Text>
        )}
        {data.sacCode && (
          <Text style={styles.businessAddressCentered}>SAC Code: {data.sacCode}</Text>
        )}
        <Text style={styles.invoiceNumber}>#{data.billNumber}</Text>
      </View>

      {/* Billing Period */}
      <View style={styles.periodBadge}>
        <Text style={styles.periodText}>
          Billing Period: {data.billingPeriod.start} to {data.billingPeriod.end}
        </Text>
      </View>

      {/* Party (left) and Site / Shipping Address (right) */}
      <View style={styles.row}>
        <View style={styles.column}>
          <Text style={styles.sectionTitle}>Bill To</Text>
          <Text style={styles.companyName}>{data.party.name}</Text>
          {data.party.address && <Text style={styles.text}>{data.party.address}</Text>}
          {data.party.stateCode && (
            <Text style={styles.text}>State Code: {data.party.stateCode}</Text>
          )}
          {data.party.stateName && (
            <Text style={styles.text}>State: {data.party.stateName}</Text>
          )}
          <Text style={styles.text}>Phone: {data.party.phone}</Text>
          {data.party.email && <Text style={styles.text}>Email: {data.party.email}</Text>}
          {data.party.gst && <Text style={styles.text}>GSTIN: {data.party.gst}</Text>}
        </View>
        <View style={styles.column}>
          <Text style={styles.sectionTitle}>Site / Shipping Address</Text>
          {data.site?.address && <Text style={styles.text}>{data.site.address}</Text>}
          {data.site?.stateCode && (
            <Text style={styles.text}>State Code: {data.site.stateCode}</Text>
          )}
          {data.site?.stateName && (
            <Text style={styles.text}>State: {data.site.stateName}</Text>
          )}
          {!data.site?.address && !data.site?.stateCode && !data.site?.stateName && (
            <Text style={styles.text}>-</Text>
          )}
        </View>
      </View>

      {/* Dates */}
      <View style={styles.row}>
        <View style={styles.column}>
          <Text style={styles.sectionTitle}>Invoice Date</Text>
          <Text style={styles.text}>{data.date}</Text>
        </View>
        <View style={styles.column}>
          <Text style={styles.sectionTitle}>Due Date</Text>
          <Text style={styles.text}>{data.dueDate}</Text>
        </View>
      </View>

      {/* Items Table */}
      <View style={styles.table}>
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCellHeader, styles.colDesc]}>Description for Hire Charges</Text>
          <Text style={[styles.tableCellHeader, styles.colPeriod]}>Period</Text>
          <Text style={[styles.tableCellHeader, styles.colDays]}>Days</Text>
          <Text style={[styles.tableCellHeader, styles.colNumber]}>Quantity</Text>
          <Text style={[styles.tableCellHeader, styles.colRate]}>Rate</Text>
          <Text style={[styles.tableCellHeader, styles.colAmount]}>Amount</Text>
        </View>

        {/* Item Groups with Slabs */}
        {data.items.map((item, itemIndex) => (
          <View key={item.itemId || itemIndex}>
            {item.slabs.map((slab, slabIndex) => (
              <View key={slabIndex} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.colDesc]}>
                  {slabIndex === 0 ? item.itemName : ''}
                </Text>
                <Text style={[styles.tableCell, styles.colPeriod]}>
                  {slab.slabStart && slab.slabEnd ? `${slab.slabStart} - ${slab.slabEnd}` : '-'}
                </Text>
                <Text style={[styles.tableCell, styles.colDays]}>{slab.totalDays}</Text>
                <Text style={[styles.tableCell, styles.colNumber]}>{slab.quantityDisplay}</Text>
                <Text style={[styles.tableCell, styles.colRate]}>
                  {slabIndex === 0 ? formatCurrency(item.ratePerDay, data.currency) : ''}
                </Text>
                <Text style={[styles.tableCell, styles.colAmount]}>
                  {formatCurrency(slab.amount, data.currency)}
                </Text>
              </View>
            ))}
            {/* Item total row */}
            <View style={styles.itemTotalRow}>
              <Text style={[styles.tableCell, styles.colDesc]} />
              <Text style={[styles.tableCell, styles.colPeriod]} />
              <Text style={[styles.tableCell, styles.colDays]} />
              <Text style={[styles.tableCell, styles.colNumber]} />
              <Text style={[styles.tableCell, styles.colRate, { fontWeight: 'bold' }]}>
                {formatCurrency(item.ratePerDay, data.currency)}
              </Text>
              <Text style={[styles.tableCell, styles.colAmount, { fontWeight: 'bold' }]}>
                {formatCurrency(item.totalAmount, data.currency)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Totals */}
      <View style={styles.totalsContainer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Rent Charges:</Text>
          <Text style={styles.totalValue}>{formatCurrency(data.rentCharges ?? data.subtotal, data.currency)}</Text>
        </View>
        {(data.cartageCharges || 0) > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Cartage Charges:</Text>
            <Text style={styles.totalValue}>{formatCurrency(data.cartageCharges || 0, data.currency)}</Text>
          </View>
        )}
        {(data.damageCharges || 0) > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Damage Charges:</Text>
            <Text style={styles.totalValue}>{formatCurrency(data.damageCharges || 0, data.currency)}</Text>
          </View>
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal:</Text>
          <Text style={styles.totalValue}>{formatCurrency(data.subtotal, data.currency)}</Text>
        </View>
        {data.discountAmount > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Discount ({data.discountRate}%):</Text>
            <Text style={styles.totalValue}>-{formatCurrency(data.discountAmount, data.currency)}</Text>
          </View>
        )}
        {data.taxMode === 'intra' && (data.sgstAmount || 0) > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>SGST ({data.sgstRate || 0}%):</Text>
            <Text style={styles.totalValue}>{formatCurrency(data.sgstAmount || 0, data.currency)}</Text>
          </View>
        )}
        {data.taxMode === 'intra' && (data.cgstAmount || 0) > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>CGST ({data.cgstRate || 0}%):</Text>
            <Text style={styles.totalValue}>{formatCurrency(data.cgstAmount || 0, data.currency)}</Text>
          </View>
        )}
        {data.taxMode === 'inter' && (data.igstAmount || 0) > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>IGST ({data.igstRate || 0}%):</Text>
            <Text style={styles.totalValue}>{formatCurrency(data.igstAmount || 0, data.currency)}</Text>
          </View>
        )}
        {!data.taxMode && data.taxAmount > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax ({data.taxRate || 0}%):</Text>
            <Text style={styles.totalValue}>{formatCurrency(data.taxAmount, data.currency)}</Text>
          </View>
        )}
        <View style={[styles.totalRow, styles.grandTotal]}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={styles.totalValue}>{formatCurrency(data.totalAmount, data.currency)}</Text>
        </View>
      </View>

      {/* Notes */}
      {data.notes && (
        <View style={styles.notes}>
          <Text style={styles.notesTitle}>Notes:</Text>
          <Text style={styles.notesText}>{data.notes}</Text>
        </View>
      )}

      {/* Footer */}
      <Text style={styles.footer}>
        Thank you for your business! | Generated by BillProMax
      </Text>
    </Page>
  </Document>
);

export default InvoiceTemplate;
