/**
 * @file Bill Statement PDF Template
 * @description Dense bill summary table with conditional site code column
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { formatCurrency, formatDateForPdf } from './shared';
import type { BillStatementData } from '../services/StatementService';

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
    paddingHorizontal: 3,
  },
  tableRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    paddingVertical: 4,
    paddingHorizontal: 3,
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
  totalsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    borderTopWidth: 2,
    borderTopColor: '#333333',
    paddingVertical: 5,
    paddingHorizontal: 3,
    backgroundColor: '#f5f5f5',
  },
  boldCell: {
    fontSize: 7,
    fontWeight: 'bold',
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

// Column widths with site code column — overflow hidden on each View wrapper
const colsWithSite = {
  colBill: { width: '9%', overflow: 'hidden' as const },
  colDate: { width: '8%', overflow: 'hidden' as const },
  colPeriod: { width: '12%', overflow: 'hidden' as const },
  colSite: { width: '7%', overflow: 'hidden' as const },
  colRent: { width: '10%', overflow: 'hidden' as const, textAlign: 'right' as const },
  colTransport: { width: '9%', overflow: 'hidden' as const, textAlign: 'right' as const },
  colDamage: { width: '9%', overflow: 'hidden' as const, textAlign: 'right' as const },
  colSubtotal: { width: '10%', overflow: 'hidden' as const, textAlign: 'right' as const },
  colTax: { width: '8%', overflow: 'hidden' as const, textAlign: 'right' as const },
  colDiscount: { width: '8%', overflow: 'hidden' as const, textAlign: 'right' as const },
  colTotal: { width: '10%', overflow: 'hidden' as const, textAlign: 'right' as const },
};

// Column widths without site code column (wider other columns)
const colsNoSite = {
  colBill: { width: '10%', overflow: 'hidden' as const },
  colDate: { width: '9%', overflow: 'hidden' as const },
  colPeriod: { width: '14%', overflow: 'hidden' as const },
  colRent: { width: '11%', overflow: 'hidden' as const, textAlign: 'right' as const },
  colTransport: { width: '10%', overflow: 'hidden' as const, textAlign: 'right' as const },
  colDamage: { width: '10%', overflow: 'hidden' as const, textAlign: 'right' as const },
  colSubtotal: { width: '10%', overflow: 'hidden' as const, textAlign: 'right' as const },
  colTax: { width: '9%', overflow: 'hidden' as const, textAlign: 'right' as const },
  colDiscount: { width: '8%', overflow: 'hidden' as const, textAlign: 'right' as const },
  colTotal: { width: '9%', overflow: 'hidden' as const, textAlign: 'right' as const },
};

export const BillStatementTemplate: React.FC<{ data: BillStatementData }> = ({ data }) => {
  const showSiteCol = !data.siteCode;
  const cols = showSiteCol ? colsWithSite : colsNoSite;

  const formatPeriod = (start?: Date, end?: Date) => {
    if (!start || !end) return '-';
    return `${formatDateForPdf(start)} - ${formatDateForPdf(end)}`;
  };

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.docType}>Bill Statement</Text>
          <Text style={styles.businessName}>{data.business.name}</Text>
          {data.business.address && <Text style={styles.businessDetail}>{data.business.address}</Text>}
          {data.business.gst && <Text style={styles.businessDetail}>GSTIN: {data.business.gst}</Text>}
        </View>

        {/* Party & Period Info */}
        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Party</Text>
            <Text style={styles.infoValue}>{data.party.name} ({data.party.code})</Text>
            {data.party.gst && <Text style={styles.infoValue}>GSTIN: {data.party.gst}</Text>}
            {data.siteCode && <Text style={styles.infoValue}>Site: {data.siteCode}</Text>}
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Period</Text>
            <Text style={styles.infoValue}>
              {formatDateForPdf(data.period.from)} to {formatDateForPdf(data.period.to)}
            </Text>
            <Text style={styles.infoValue}>Bills: {data.totals.billCount}</Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <View style={cols.colBill}><Text style={styles.cellHeader}>Bill #</Text></View>
            <View style={cols.colDate}><Text style={styles.cellHeader}>Date</Text></View>
            <View style={cols.colPeriod}><Text style={styles.cellHeader}>Period</Text></View>
            {showSiteCol && <View style={colsWithSite.colSite}><Text style={styles.cellHeader}>Site</Text></View>}
            <View style={cols.colRent}><Text style={styles.cellHeader}>Rent</Text></View>
            <View style={cols.colTransport}><Text style={styles.cellHeader}>Transport</Text></View>
            <View style={cols.colDamage}><Text style={styles.cellHeader}>Damage</Text></View>
            <View style={cols.colSubtotal}><Text style={styles.cellHeader}>Subtotal</Text></View>
            <View style={cols.colTax}><Text style={styles.cellHeader}>Tax</Text></View>
            <View style={cols.colDiscount}><Text style={styles.cellHeader}>Discount</Text></View>
            <View style={cols.colTotal}><Text style={styles.cellHeader}>Total</Text></View>
          </View>

          {data.bills.map((bill, index) => (
            <View key={index} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
              <View style={cols.colBill}><Text style={styles.cell}>{bill.billNumber}</Text></View>
              <View style={cols.colDate}><Text style={styles.cell}>{formatDateForPdf(bill.billDate)}</Text></View>
              <View style={cols.colPeriod}><Text style={styles.cell}>{formatPeriod(bill.periodStart, bill.periodEnd)}</Text></View>
              {showSiteCol && <View style={colsWithSite.colSite}><Text style={styles.cell}>{bill.siteCode}</Text></View>}
              <View style={cols.colRent}><Text style={styles.cell}>{formatCurrency(bill.rentCharges, data.currency)}</Text></View>
              <View style={cols.colTransport}><Text style={styles.cell}>{formatCurrency(bill.transportationCharges, data.currency)}</Text></View>
              <View style={cols.colDamage}><Text style={styles.cell}>{formatCurrency(bill.damageCharges, data.currency)}</Text></View>
              <View style={cols.colSubtotal}><Text style={styles.cell}>{formatCurrency(bill.subtotal, data.currency)}</Text></View>
              <View style={cols.colTax}><Text style={styles.cell}>{formatCurrency(bill.taxAmount, data.currency)}</Text></View>
              <View style={cols.colDiscount}><Text style={styles.cell}>{formatCurrency(bill.discountAmount, data.currency)}</Text></View>
              <View style={cols.colTotal}><Text style={styles.cell}>{formatCurrency(bill.totalAmount, data.currency)}</Text></View>
            </View>
          ))}

          {/* Totals */}
          <View style={styles.totalsRow}>
            <View style={cols.colBill}><Text style={styles.boldCell}>Total</Text></View>
            <View style={cols.colDate}><Text style={styles.boldCell}></Text></View>
            <View style={cols.colPeriod}><Text style={styles.boldCell}></Text></View>
            {showSiteCol && <View style={colsWithSite.colSite}><Text style={styles.boldCell}></Text></View>}
            <View style={cols.colRent}><Text style={styles.boldCell}>{formatCurrency(data.totals.rentCharges, data.currency)}</Text></View>
            <View style={cols.colTransport}><Text style={styles.boldCell}>{formatCurrency(data.totals.transportationCharges, data.currency)}</Text></View>
            <View style={cols.colDamage}><Text style={styles.boldCell}>{formatCurrency(data.totals.damageCharges, data.currency)}</Text></View>
            <View style={cols.colSubtotal}><Text style={styles.boldCell}>{formatCurrency(data.totals.subtotal, data.currency)}</Text></View>
            <View style={cols.colTax}><Text style={styles.boldCell}>{formatCurrency(data.totals.taxAmount, data.currency)}</Text></View>
            <View style={cols.colDiscount}><Text style={styles.boldCell}>{formatCurrency(data.totals.discountAmount, data.currency)}</Text></View>
            <View style={cols.colTotal}><Text style={styles.boldCell}>{formatCurrency(data.totals.totalAmount, data.currency)}</Text></View>
          </View>
        </View>

        <Text style={styles.footer}>Generated by BillProMax</Text>
      </Page>
    </Document>
  );
};

export default BillStatementTemplate;
