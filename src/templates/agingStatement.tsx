/**
 * @file Aging Statement PDF Template
 * @description Bills grouped by aging bucket with per-bucket subtotals and grand total
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { formatCurrency, formatDateForPdf } from './shared';
import type { AgingStatementData } from '../services/StatementService';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 8,
    fontFamily: 'Roboto',
  },
  header: {
    marginBottom: 15,
    alignItems: 'center',
  },
  docType: {
    fontSize: 8,
    color: '#666666',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  businessName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  businessDetail: {
    fontSize: 8,
    color: '#333333',
    marginBottom: 2,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoBlock: {
    width: '48%',
  },
  infoLabel: {
    fontSize: 7,
    color: '#666666',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 8,
    color: '#333333',
    marginBottom: 1,
  },
  table: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#dddddd',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableRowAlt: {
    backgroundColor: '#f9f9f9',
  },
  cellHeader: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#333333',
  },
  cell: {
    fontSize: 7,
  },
  colBill: { width: '14%', overflow: 'hidden' },
  colDate: { width: '12%', overflow: 'hidden' },
  colDue: { width: '12%', overflow: 'hidden' },
  colDays: { width: '8%', overflow: 'hidden', textAlign: 'center' },
  colTotal: { width: '14%', overflow: 'hidden', textAlign: 'right' },
  colPaid: { width: '14%', overflow: 'hidden', textAlign: 'right' },
  colBalance: { width: '14%', overflow: 'hidden', textAlign: 'right' },
  colBucket: { width: '12%', overflow: 'hidden', textAlign: 'center' },
  emptyText: {
    fontSize: 7,
    color: '#999999',
    padding: 4,
  },
  bucketSection: {
    marginTop: 14,
    borderTopWidth: 2,
    borderTopColor: '#333333',
    paddingTop: 8,
  },
  bucketTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  bucketRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  bucketLabel: {
    fontSize: 8,
    width: '60%',
    color: '#333333',
  },
  bucketValue: {
    fontSize: 8,
    fontWeight: 'bold',
    width: '40%',
    textAlign: 'right',
  },
  grandTotalRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderTopWidth: 2,
    borderTopColor: '#333333',
    backgroundColor: '#f5f5f5',
  },
  grandTotalLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    width: '60%',
    color: '#1a1a1a',
  },
  grandTotalValue: {
    fontSize: 9,
    fontWeight: 'bold',
    width: '40%',
    textAlign: 'right',
    color: '#1a1a1a',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 7,
    color: '#999999',
  },
});

export const AgingStatementTemplate: React.FC<{ data: AgingStatementData }> = ({ data }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.docType}>Aging / Outstanding Statement</Text>
        <Text style={styles.businessName}>{data.business.name}</Text>
        {data.business.address && <Text style={styles.businessDetail}>{data.business.address}</Text>}
        {data.business.gst && <Text style={styles.businessDetail}>GSTIN: {data.business.gst}</Text>}
      </View>

      {/* Party & As-of Info */}
      <View style={styles.infoRow}>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Party</Text>
          <Text style={styles.infoValue}>{data.party.name} ({data.party.code})</Text>
          {data.party.gst && <Text style={styles.infoValue}>GSTIN: {data.party.gst}</Text>}
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>As of Date</Text>
          <Text style={styles.infoValue}>{formatDateForPdf(data.asOfDate)}</Text>
        </View>
      </View>

      {/* Bills Table */}
      {data.bills.length > 0 ? (
        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <View style={styles.colBill}><Text style={styles.cellHeader}>Bill #</Text></View>
            <View style={styles.colDate}><Text style={styles.cellHeader}>Bill Date</Text></View>
            <View style={styles.colDue}><Text style={styles.cellHeader}>Due Date</Text></View>
            <View style={styles.colDays}><Text style={styles.cellHeader}>Days</Text></View>
            <View style={styles.colTotal}><Text style={styles.cellHeader}>Total</Text></View>
            <View style={styles.colPaid}><Text style={styles.cellHeader}>Paid</Text></View>
            <View style={styles.colBalance}><Text style={styles.cellHeader}>Balance</Text></View>
            <View style={styles.colBucket}><Text style={styles.cellHeader}>Bucket</Text></View>
          </View>

          {data.bills.map((bill, index) => (
            <View key={index} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
              <View style={styles.colBill}><Text style={styles.cell}>{bill.billNumber}</Text></View>
              <View style={styles.colDate}><Text style={styles.cell}>{formatDateForPdf(bill.billDate)}</Text></View>
              <View style={styles.colDue}><Text style={styles.cell}>{formatDateForPdf(bill.dueDate)}</Text></View>
              <View style={styles.colDays}><Text style={styles.cell}>{bill.daysOverdue}</Text></View>
              <View style={styles.colTotal}><Text style={styles.cell}>{formatCurrency(bill.totalAmount, data.currency)}</Text></View>
              <View style={styles.colPaid}><Text style={styles.cell}>{formatCurrency(bill.amountPaid, data.currency)}</Text></View>
              <View style={styles.colBalance}><Text style={styles.cell}>{formatCurrency(bill.balanceDue, data.currency)}</Text></View>
              <View style={styles.colBucket}><Text style={styles.cell}>{bill.bucket}</Text></View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>No outstanding bills found.</Text>
      )}

      {/* Bucket Summary */}
      {data.bills.length > 0 && (
        <View style={styles.bucketSection}>
          <Text style={styles.bucketTitle}>Aging Summary</Text>
          <View style={styles.bucketRow}>
            <Text style={styles.bucketLabel}>Current (0-30 days)</Text>
            <Text style={styles.bucketValue}>{formatCurrency(data.buckets.current, data.currency)}</Text>
          </View>
          <View style={styles.bucketRow}>
            <Text style={styles.bucketLabel}>31-60 Days</Text>
            <Text style={styles.bucketValue}>{formatCurrency(data.buckets.days31_60, data.currency)}</Text>
          </View>
          <View style={styles.bucketRow}>
            <Text style={styles.bucketLabel}>61-90 Days</Text>
            <Text style={styles.bucketValue}>{formatCurrency(data.buckets.days61_90, data.currency)}</Text>
          </View>
          <View style={styles.bucketRow}>
            <Text style={styles.bucketLabel}>90+ Days</Text>
            <Text style={styles.bucketValue}>{formatCurrency(data.buckets.days90Plus, data.currency)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total Outstanding</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(data.grandTotal, data.currency)}</Text>
          </View>
        </View>
      )}

      <Text style={styles.footer}>Generated by BillProMax</Text>
    </Page>
  </Document>
);

export default AgingStatementTemplate;
