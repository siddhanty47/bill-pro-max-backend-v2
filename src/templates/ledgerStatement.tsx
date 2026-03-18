/**
 * @file Ledger Statement PDF Template
 * @description Compact ledger table: Date | Description | Reference | Debit | Credit | Balance
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { formatCurrency, formatDateForPdf } from './shared';
import type { LedgerStatementData } from '../services/StatementService';

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
  colDate: { width: '12%', overflow: 'hidden' },
  colDesc: { width: '28%', overflow: 'hidden' },
  colRef: { width: '16%', overflow: 'hidden' },
  colDebit: { width: '14%', overflow: 'hidden', textAlign: 'right' },
  colCredit: { width: '14%', overflow: 'hidden', textAlign: 'right' },
  colBalance: { width: '16%', overflow: 'hidden', textAlign: 'right' },
  openingRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    backgroundColor: '#e8f4fd',
    borderBottomWidth: 1,
    borderBottomColor: '#dddddd',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  totalsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    borderTopWidth: 2,
    borderTopColor: '#333333',
    paddingVertical: 5,
    paddingHorizontal: 4,
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

export const LedgerStatementTemplate: React.FC<{ data: LedgerStatementData }> = ({ data }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.docType}>Ledger Statement</Text>
        <Text style={styles.businessName}>{data.business.name}</Text>
        {data.business.address && <Text style={styles.businessDetail}>{data.business.address}</Text>}
        {data.business.phone && <Text style={styles.businessDetail}>Phone: {data.business.phone}</Text>}
        {data.business.gst && <Text style={styles.businessDetail}>GSTIN: {data.business.gst}</Text>}
      </View>

      {/* Party & Period Info */}
      <View style={styles.infoRow}>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Party</Text>
          <Text style={styles.infoValue}>{data.party.name} ({data.party.code})</Text>
          {data.party.address && <Text style={styles.infoValue}>{data.party.address}</Text>}
          {data.party.gst && <Text style={styles.infoValue}>GSTIN: {data.party.gst}</Text>}
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Period</Text>
          <Text style={styles.infoValue}>
            {formatDateForPdf(data.period.from)} to {formatDateForPdf(data.period.to)}
          </Text>
        </View>
      </View>

      {/* Table */}
      <View style={styles.table}>
        <View style={styles.tableHeader} fixed>
          <View style={styles.colDate}><Text style={styles.cellHeader}>Date</Text></View>
          <View style={styles.colDesc}><Text style={styles.cellHeader}>Description</Text></View>
          <View style={styles.colRef}><Text style={styles.cellHeader}>Reference</Text></View>
          <View style={styles.colDebit}><Text style={styles.cellHeader}>Debit</Text></View>
          <View style={styles.colCredit}><Text style={styles.cellHeader}>Credit</Text></View>
          <View style={styles.colBalance}><Text style={styles.cellHeader}>Balance</Text></View>
        </View>

        {/* Opening Balance */}
        <View style={styles.openingRow}>
          <View style={styles.colDate}><Text style={styles.boldCell}></Text></View>
          <View style={styles.colDesc}><Text style={styles.boldCell}>Opening Balance</Text></View>
          <View style={styles.colRef}><Text style={styles.boldCell}></Text></View>
          <View style={styles.colDebit}><Text style={styles.boldCell}></Text></View>
          <View style={styles.colCredit}><Text style={styles.boldCell}></Text></View>
          <View style={styles.colBalance}>
            <Text style={styles.boldCell}>{formatCurrency(data.openingBalance, data.currency)}</Text>
          </View>
        </View>

        {/* Entries */}
        {data.entries.map((entry, index) => (
          <View key={index} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
            <View style={styles.colDate}><Text style={styles.cell}>{formatDateForPdf(entry.date)}</Text></View>
            <View style={styles.colDesc}><Text style={styles.cell}>{entry.description}</Text></View>
            <View style={styles.colRef}><Text style={styles.cell}>{entry.reference}</Text></View>
            <View style={styles.colDebit}>
              <Text style={styles.cell}>{entry.debit > 0 ? formatCurrency(entry.debit, data.currency) : ''}</Text>
            </View>
            <View style={styles.colCredit}>
              <Text style={styles.cell}>{entry.credit > 0 ? formatCurrency(entry.credit, data.currency) : ''}</Text>
            </View>
            <View style={styles.colBalance}>
              <Text style={styles.cell}>{formatCurrency(entry.balance, data.currency)}</Text>
            </View>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsRow}>
          <View style={styles.colDate}><Text style={styles.boldCell}></Text></View>
          <View style={styles.colDesc}><Text style={styles.boldCell}>Totals</Text></View>
          <View style={styles.colRef}><Text style={styles.boldCell}></Text></View>
          <View style={styles.colDebit}>
            <Text style={styles.boldCell}>{formatCurrency(data.totalDebits, data.currency)}</Text>
          </View>
          <View style={styles.colCredit}>
            <Text style={styles.boldCell}>{formatCurrency(data.totalCredits, data.currency)}</Text>
          </View>
          <View style={styles.colBalance}>
            <Text style={styles.boldCell}>{formatCurrency(data.closingBalance, data.currency)}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.footer}>Generated by BillProMax</Text>
    </Page>
  </Document>
);

export default LedgerStatementTemplate;
