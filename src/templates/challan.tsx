/**
 * @file Challan PDF Template
 * @description React-PDF template for generating delivery/return challan documents
 */

import path from 'path';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register Roboto font (consistent with invoice template)
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
 * Challan data structure
 */
export interface ChallanData {
  challanNumber: string;
  type: 'delivery' | 'return';
  date: string;
  business: {
    name: string;
    address?: string;
    phone?: string;
    gst?: string;
    stateCode?: string;
    stateName?: string;
  };
  party: {
    name: string;
    address?: string;
    phone: string;
    contactPerson: string;
    gst?: string;
    stateCode?: string;
    stateName?: string;
  };
  items: Array<{
    itemName: string;
    quantity: number;
    unit: string;
  }>;
  sacCode: string;
  hsnCode: string;
  notes?: string;
  confirmedBy?: string;
  confirmedAt?: string;
}

/**
 * PDF Styles (aligned with invoice.tsx)
 */
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Roboto',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#333333',
    paddingBottom: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#1a1a1a',
  },
  notForSaleLine: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    textTransform: 'uppercase',
  },
  typeBadge: {
    marginTop: 10,
    padding: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  deliveryBadge: {
    backgroundColor: '#e6f7e6',
  },
  returnBadge: {
    backgroundColor: '#fff3e6',
  },
  typeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  deliveryText: {
    color: '#2e7d32',
  },
  returnText: {
    color: '#ef6c00',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
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
  infoBox: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 4,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  infoLabel: {
    width: '30%',
    fontWeight: 'bold',
    color: '#666666',
  },
  infoValue: {
    width: '70%',
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
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  tableCell: {
    fontSize: 9,
  },
  tableCellHeader: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#333333',
  },
  colSno: {
    width: '8%',
    textAlign: 'center',
  },
  colItem: {
    width: '42%',
  },
  colQty: {
    width: '15%',
    textAlign: 'center',
  },
  colUnit: {
    width: '15%',
    textAlign: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginTop: 5,
  },
  totalLabel: {
    width: '50%',
    fontSize: 11,
    fontWeight: 'bold',
  },
  totalValue: {
    width: '50%',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  notes: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#fffbe6',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#ffb300',
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
  signatureSection: {
    marginTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBox: {
    width: '45%',
    borderTopWidth: 1,
    borderTopColor: '#333333',
    paddingTop: 10,
  },
  signatureLabel: {
    fontSize: 9,
    color: '#666666',
    textAlign: 'center',
  },
  confirmedInfo: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#e8f5e9',
    borderRadius: 4,
  },
  confirmedText: {
    fontSize: 9,
    color: '#2e7d32',
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
});

/**
 * Challan Template Component
 */
export const ChallanTemplate: React.FC<{ data: ChallanData }> = ({ data }) => {
  const isDelivery = data.type === 'delivery';
  const totalItems = data.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{data.business.name}</Text>
          <Text style={styles.notForSaleLine}>NOT FOR SALE ONLY HIRE</Text>
          <Text style={styles.subtitle}>
            {isDelivery ? 'Delivery Challan' : 'Return Challan'}
          </Text>
          <View
            style={[
              styles.typeBadge,
              isDelivery ? styles.deliveryBadge : styles.returnBadge,
            ]}
          >
            <Text
              style={[
                styles.typeText,
                isDelivery ? styles.deliveryText : styles.returnText,
              ]}
            >
              {isDelivery ? 'DELIVERY' : 'RETURN'}
            </Text>
          </View>
        </View>

        {/* Challan Info */}
        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Challan No:</Text>
            <Text style={styles.infoValue}>{data.challanNumber}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date:</Text>
            <Text style={styles.infoValue}>{data.date}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>SAC Code:</Text>
            <Text style={styles.infoValue}>{data.sacCode}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>HSN Code:</Text>
            <Text style={styles.infoValue}>{data.hsnCode}</Text>
          </View>
        </View>

        {/* From/To */}
        <View style={styles.row}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>From</Text>
            <Text style={styles.companyName}>{data.business.name}</Text>
            {data.business.address && <Text style={styles.text}>{data.business.address}</Text>}
            {data.business.stateCode && (
              <Text style={styles.text}>State Code: {data.business.stateCode}</Text>
            )}
            {data.business.stateName && (
              <Text style={styles.text}>State: {data.business.stateName}</Text>
            )}
            {data.business.gst && <Text style={styles.text}>GSTIN: {data.business.gst}</Text>}
            {data.business.phone && <Text style={styles.text}>Phone: {data.business.phone}</Text>}
          </View>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>{isDelivery ? 'Deliver To' : 'Return From'}</Text>
            <Text style={styles.companyName}>{data.party.name}</Text>
            {data.party.address && <Text style={styles.text}>{data.party.address}</Text>}
            {data.party.stateCode && (
              <Text style={styles.text}>State Code: {data.party.stateCode}</Text>
            )}
            {data.party.stateName && (
              <Text style={styles.text}>State: {data.party.stateName}</Text>
            )}
            {data.party.gst && <Text style={styles.text}>GSTIN: {data.party.gst}</Text>}
            <Text style={styles.text}>Phone: {data.party.phone}</Text>
            <Text style={styles.text}>Contact: {data.party.contactPerson}</Text>
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCellHeader, styles.colSno]}>#</Text>
            <Text style={[styles.tableCellHeader, styles.colItem]}>Item Description</Text>
            <Text style={[styles.tableCellHeader, styles.colQty]}>Quantity</Text>
            <Text style={[styles.tableCellHeader, styles.colUnit]}>Unit</Text>
          </View>

          {/* Table Rows */}
          {data.items.map((item, index) => (
            <View
              key={index}
              style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={[styles.tableCell, styles.colSno]}>{index + 1}</Text>
              <Text style={[styles.tableCell, styles.colItem]}>{item.itemName}</Text>
              <Text style={[styles.tableCell, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.tableCell, styles.colUnit]}>{item.unit}</Text>
            </View>
          ))}

          {/* Total Row */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Items:</Text>
            <Text style={styles.totalValue}>{totalItems}</Text>
          </View>
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>Remarks:</Text>
            <Text style={styles.notesText}>{data.notes}</Text>
          </View>
        )}

        {/* Confirmed Info */}
        {data.confirmedBy && (
          <View style={styles.confirmedInfo}>
            <Text style={styles.confirmedText}>
              Confirmed by: {data.confirmedBy}
              {data.confirmedAt && ` on ${data.confirmedAt}`}
            </Text>
          </View>
        )}

        {/* Signature Section */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>
              {isDelivery ? "Sender's Signature" : "Receiver's Signature"}
            </Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>
              {isDelivery ? "Receiver's Signature" : "Sender's Signature"}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          This is a computer-generated document | Generated by BillProMax
        </Text>
      </Page>
    </Document>
  );
};

export default ChallanTemplate;
