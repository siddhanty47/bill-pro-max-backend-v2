/**
 * @file Invoice PDF Template
 * @description React-PDF template for generating invoice documents
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

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
  };
  party: {
    name: string;
    address?: string;
    phone: string;
    email?: string;
    gst?: string;
  };
  billingPeriod: {
    start: string;
    end: string;
  };
  items: Array<{
    itemName: string;
    quantity: number;
    ratePerDay: number;
    totalDays: number;
    amount: number;
  }>;
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
}

/**
 * PDF Styles
 */
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#1a1a1a',
  },
  invoiceNumber: {
    fontSize: 12,
    color: '#666666',
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
  colItem: {
    width: '35%',
  },
  colQty: {
    width: '12%',
    textAlign: 'center',
  },
  colRate: {
    width: '15%',
    textAlign: 'right',
  },
  colDays: {
    width: '12%',
    textAlign: 'center',
  },
  colAmount: {
    width: '18%',
    textAlign: 'right',
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
 * Format currency
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>INVOICE</Text>
        <Text style={styles.invoiceNumber}>#{data.billNumber}</Text>
      </View>

      {/* Billing Period */}
      <View style={styles.periodBadge}>
        <Text style={styles.periodText}>
          Billing Period: {data.billingPeriod.start} to {data.billingPeriod.end}
        </Text>
      </View>

      {/* From/To */}
      <View style={styles.row}>
        <View style={styles.column}>
          <Text style={styles.sectionTitle}>From</Text>
          <Text style={styles.companyName}>{data.business.name}</Text>
          {data.business.address && <Text style={styles.text}>{data.business.address}</Text>}
          {data.business.phone && <Text style={styles.text}>Phone: {data.business.phone}</Text>}
          {data.business.email && <Text style={styles.text}>Email: {data.business.email}</Text>}
          {data.business.gst && <Text style={styles.text}>GST: {data.business.gst}</Text>}
        </View>
        <View style={styles.column}>
          <Text style={styles.sectionTitle}>Bill To</Text>
          <Text style={styles.companyName}>{data.party.name}</Text>
          {data.party.address && <Text style={styles.text}>{data.party.address}</Text>}
          <Text style={styles.text}>Phone: {data.party.phone}</Text>
          {data.party.email && <Text style={styles.text}>Email: {data.party.email}</Text>}
          {data.party.gst && <Text style={styles.text}>GST: {data.party.gst}</Text>}
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
          <Text style={[styles.tableCellHeader, styles.colItem]}>Item</Text>
          <Text style={[styles.tableCellHeader, styles.colQty]}>Qty</Text>
          <Text style={[styles.tableCellHeader, styles.colRate]}>Rate/Day</Text>
          <Text style={[styles.tableCellHeader, styles.colDays]}>Days</Text>
          <Text style={[styles.tableCellHeader, styles.colAmount]}>Amount</Text>
        </View>

        {/* Table Rows */}
        {data.items.map((item, index) => (
          <View key={index} style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.colItem]}>{item.itemName}</Text>
            <Text style={[styles.tableCell, styles.colQty]}>{item.quantity}</Text>
            <Text style={[styles.tableCell, styles.colRate]}>
              {formatCurrency(item.ratePerDay, data.currency)}
            </Text>
            <Text style={[styles.tableCell, styles.colDays]}>{item.totalDays}</Text>
            <Text style={[styles.tableCell, styles.colAmount]}>
              {formatCurrency(item.amount, data.currency)}
            </Text>
          </View>
        ))}
      </View>

      {/* Totals */}
      <View style={styles.totalsContainer}>
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
