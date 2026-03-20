import React from 'react';
import { Text, Section, Row, Column, Hr } from '@react-email/components';
import { BaseLayout } from './BaseLayout';

export interface InvoiceEmailProps {
  businessName: string;
  businessEmail?: string;
  businessPhone?: string;
  contactPerson: string;
  billNumber: string;
  periodStart: string;
  periodEnd: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: string;
  taxRate?: number;
  taxAmount?: string;
  discountAmount?: string;
  balanceDue: string;
}

const styles = {
  heading: {
    fontSize: '20px',
    fontWeight: 'bold' as const,
    color: '#1a1a2e',
    margin: '0 0 16px',
  },
  paragraph: {
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#333333',
    margin: '0 0 12px',
  },
  detailsBox: {
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    padding: '16px',
    margin: '16px 0',
  },
  detailRow: {
    padding: '8px 0',
    borderBottom: '1px solid #eeeeee',
  },
  detailLabel: {
    fontSize: '13px',
    color: '#666666',
  },
  detailValue: {
    fontSize: '13px',
    fontWeight: 'bold' as const,
    color: '#333333',
    textAlign: 'right' as const,
  },
  totalRow: {
    padding: '12px 0 4px',
  },
  totalLabel: {
    fontSize: '16px',
    fontWeight: 'bold' as const,
    color: '#2563eb',
  },
  totalValue: {
    fontSize: '16px',
    fontWeight: 'bold' as const,
    color: '#2563eb',
    textAlign: 'right' as const,
  },
  contactInfo: {
    fontSize: '12px',
    color: '#666666',
    margin: '4px 0',
    textAlign: 'center' as const,
  },
};

export function InvoiceEmail(props: InvoiceEmailProps) {
  const {
    businessName,
    businessEmail,
    businessPhone,
    contactPerson,
    billNumber,
    periodStart,
    periodEnd,
    invoiceDate,
    dueDate,
    subtotal,
    taxRate,
    taxAmount,
    discountAmount,
    balanceDue,
  } = props;

  return (
    <BaseLayout previewText={`Invoice ${billNumber} from ${businessName}`}>
      <Text style={styles.heading}>Invoice {billNumber}</Text>
      <Text style={styles.paragraph}>Dear {contactPerson},</Text>
      <Text style={styles.paragraph}>
        Please find attached the invoice for the billing period {periodStart} to{' '}
        {periodEnd}.
      </Text>

      <Section style={styles.detailsBox}>
        <Row style={styles.detailRow}>
          <Column style={styles.detailLabel}>Invoice Number</Column>
          <Column style={styles.detailValue}>{billNumber}</Column>
        </Row>
        <Row style={styles.detailRow}>
          <Column style={styles.detailLabel}>Invoice Date</Column>
          <Column style={styles.detailValue}>{invoiceDate}</Column>
        </Row>
        <Row style={styles.detailRow}>
          <Column style={styles.detailLabel}>Due Date</Column>
          <Column style={styles.detailValue}>{dueDate}</Column>
        </Row>
        <Hr style={{ borderColor: '#dddddd', margin: '8px 0' }} />
        <Row style={styles.detailRow}>
          <Column style={styles.detailLabel}>Subtotal</Column>
          <Column style={styles.detailValue}>{subtotal}</Column>
        </Row>
        {taxAmount && taxRate && taxRate > 0 && (
          <Row style={styles.detailRow}>
            <Column style={styles.detailLabel}>Tax ({taxRate}%)</Column>
            <Column style={styles.detailValue}>{taxAmount}</Column>
          </Row>
        )}
        {discountAmount && (
          <Row style={styles.detailRow}>
            <Column style={styles.detailLabel}>Discount</Column>
            <Column style={styles.detailValue}>-{discountAmount}</Column>
          </Row>
        )}
        <Row style={styles.totalRow}>
          <Column style={styles.totalLabel}>Amount Due</Column>
          <Column style={styles.totalValue}>{balanceDue}</Column>
        </Row>
      </Section>

      <Text style={styles.paragraph}>
        Please ensure payment is made by the due date to avoid any late fees.
      </Text>
      <Text style={styles.paragraph}>Thank you for your business!</Text>

      <Hr style={{ borderColor: '#eeeeee', margin: '16px 0' }} />
      <Text style={styles.contactInfo}>
        This is an automated email from {businessName}.
      </Text>
      {businessEmail && (
        <Text style={styles.contactInfo}>Contact: {businessEmail}</Text>
      )}
      {businessPhone && (
        <Text style={styles.contactInfo}>Phone: {businessPhone}</Text>
      )}
    </BaseLayout>
  );
}

export default InvoiceEmail;
