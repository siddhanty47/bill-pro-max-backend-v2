/**
 * @file Item Statement PDF Template
 * @description Per-item sections with events table and summary, plus grand totals
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { formatDateForPdf } from './shared';
import type { ItemStatementData, ItemStatementItem } from '../services/StatementService';

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
  itemSection: {
    marginBottom: 14,
  },
  itemTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 3,
    backgroundColor: '#e8f4fd',
    padding: 4,
  },
  itemSummaryRow: {
    flexDirection: 'row',
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  itemSummaryLabel: {
    fontSize: 7,
    color: '#666666',
    width: '30%',
  },
  itemSummaryValue: {
    fontSize: 7,
    color: '#333333',
    width: '20%',
  },
  table: {
    marginTop: 4,
    marginBottom: 6,
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
  colDate: { width: '18%', overflow: 'hidden' },
  colChallan: { width: '22%', overflow: 'hidden' },
  colDeliveryQty: { width: '15%', overflow: 'hidden', textAlign: 'center' },
  colReturnQty: { width: '15%', overflow: 'hidden', textAlign: 'center' },
  colRunning: { width: '15%', overflow: 'hidden', textAlign: 'center' },
  grandTotalsSection: {
    marginTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#333333',
    paddingTop: 8,
  },
  grandTotalsTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  grandTotalsTable: {
    marginTop: 4,
  },
  grandTotalsRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  grandTotalsLabel: {
    fontSize: 8,
    width: '50%',
    color: '#333333',
  },
  grandTotalsValue: {
    fontSize: 8,
    fontWeight: 'bold',
    width: '50%',
    textAlign: 'right',
  },
  emptyText: {
    fontSize: 7,
    color: '#999999',
    padding: 4,
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

const ItemSection: React.FC<{ item: ItemStatementItem }> = ({ item }) => {
  const hasDamages = item.damages.damaged > 0 || item.damages.short > 0 || item.damages.needRepair > 0;

  return (
    <View style={styles.itemSection}>
      <Text style={styles.itemTitle}>
        {item.itemName} — Opening: {item.openingQty} | Closing: {item.closingQty}
      </Text>

      {/* Events table */}
      {item.events.length > 0 ? (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.colDate}><Text style={styles.cellHeader}>Date</Text></View>
            <View style={styles.colChallan}><Text style={styles.cellHeader}>Challan #</Text></View>
            <View style={styles.colDeliveryQty}><Text style={styles.cellHeader}>Delivery Qty</Text></View>
            <View style={styles.colReturnQty}><Text style={styles.cellHeader}>Return Qty</Text></View>
            <View style={styles.colRunning}><Text style={styles.cellHeader}>Running Qty</Text></View>
          </View>
          {item.events.map((event, idx) => (
            <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
              <View style={styles.colDate}><Text style={styles.cell}>{formatDateForPdf(event.date)}</Text></View>
              <View style={styles.colChallan}><Text style={styles.cell}>{event.challanNumber}</Text></View>
              <View style={styles.colDeliveryQty}>
                <Text style={styles.cell}>{event.type === 'delivery' ? event.quantity : '-'}</Text>
              </View>
              <View style={styles.colReturnQty}>
                <Text style={styles.cell}>{event.type === 'return' ? event.quantity : '-'}</Text>
              </View>
              <View style={styles.colRunning}><Text style={styles.cell}>{event.runningQty}</Text></View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.table}>
          <Text style={styles.emptyText}>No activity in this period.</Text>
        </View>
      )}

      {/* Per-item summary */}
      <View style={styles.itemSummaryRow}>
        <Text style={styles.itemSummaryLabel}>Delivered:</Text>
        <Text style={styles.itemSummaryValue}>{item.totalDelivered}</Text>
        <Text style={styles.itemSummaryLabel}>Returned:</Text>
        <Text style={styles.itemSummaryValue}>{item.totalReturned}</Text>
      </View>

      {hasDamages && (
        <View style={styles.itemSummaryRow}>
          {item.damages.damaged > 0 && (
            <>
              <Text style={styles.itemSummaryLabel}>Damaged:</Text>
              <Text style={styles.itemSummaryValue}>{item.damages.damaged}</Text>
            </>
          )}
          {item.damages.short > 0 && (
            <>
              <Text style={styles.itemSummaryLabel}>Short:</Text>
              <Text style={styles.itemSummaryValue}>{item.damages.short}</Text>
            </>
          )}
          {item.damages.needRepair > 0 && (
            <>
              <Text style={styles.itemSummaryLabel}>Need Repair:</Text>
              <Text style={styles.itemSummaryValue}>{item.damages.needRepair}</Text>
            </>
          )}
        </View>
      )}
    </View>
  );
};

export const ItemStatementTemplate: React.FC<{ data: ItemStatementData }> = ({ data }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.docType}>Item Statement</Text>
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
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Period</Text>
          <Text style={styles.infoValue}>
            {formatDateForPdf(data.period.from)} to {formatDateForPdf(data.period.to)}
          </Text>
        </View>
      </View>

      {/* Per-item sections */}
      {data.items.length > 0 ? (
        data.items.map((item) => (
          <ItemSection key={item.itemId} item={item} />
        ))
      ) : (
        <Text style={styles.emptyText}>No item activity found for this period.</Text>
      )}

      {/* Grand Totals */}
      {data.items.length > 0 && (
        <View style={styles.grandTotalsSection}>
          <Text style={styles.grandTotalsTitle}>Grand Totals</Text>
          <View style={styles.grandTotalsTable}>
            <View style={styles.grandTotalsRow}>
              <Text style={styles.grandTotalsLabel}>Total Delivered</Text>
              <Text style={styles.grandTotalsValue}>{data.grandTotals.totalDelivered}</Text>
            </View>
            <View style={styles.grandTotalsRow}>
              <Text style={styles.grandTotalsLabel}>Total Returned</Text>
              <Text style={styles.grandTotalsValue}>{data.grandTotals.totalReturned}</Text>
            </View>
            <View style={styles.grandTotalsRow}>
              <Text style={styles.grandTotalsLabel}>Net Held</Text>
              <Text style={styles.grandTotalsValue}>{data.grandTotals.netHeld}</Text>
            </View>
            {data.grandTotals.totalDamaged > 0 && (
              <View style={styles.grandTotalsRow}>
                <Text style={styles.grandTotalsLabel}>Total Damaged</Text>
                <Text style={styles.grandTotalsValue}>{data.grandTotals.totalDamaged}</Text>
              </View>
            )}
            {data.grandTotals.totalShort > 0 && (
              <View style={styles.grandTotalsRow}>
                <Text style={styles.grandTotalsLabel}>Total Short</Text>
                <Text style={styles.grandTotalsValue}>{data.grandTotals.totalShort}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      <Text style={styles.footer}>Generated by BillProMax</Text>
    </Page>
  </Document>
);

export default ItemStatementTemplate;
