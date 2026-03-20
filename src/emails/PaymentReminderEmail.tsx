import React from 'react';
import { Text, Section, Row, Column, Hr } from '@react-email/components';
import { BaseLayout } from './BaseLayout';

export interface PaymentReminderEmailProps {
  businessName: string;
  businessEmail?: string;
  contactPerson: string;
  billNumber: string;
  dueDate: string;
  balanceDue: string;
  daysOverdue: number;
}

const styles = {
  heading: {
    fontSize: '20px',
    fontWeight: 'bold' as const,
    margin: '0 0 16px',
  },
  paragraph: {
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#333333',
    margin: '0 0 12px',
  },
  urgentText: {
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#dc2626',
    fontWeight: 'bold' as const,
    margin: '0 0 12px',
  },
  detailsBox: {
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
  contactInfo: {
    fontSize: '12px',
    color: '#666666',
    margin: '4px 0',
    textAlign: 'center' as const,
  },
};

export function PaymentReminderEmail(props: PaymentReminderEmailProps) {
  const {
    businessName,
    businessEmail,
    contactPerson,
    billNumber,
    dueDate,
    balanceDue,
    daysOverdue,
  } = props;

  const isOverdue = daysOverdue > 0;
  const headingColor = isOverdue ? '#dc2626' : '#f59e0b';
  const headingText = isOverdue ? 'Payment Overdue' : 'Payment Reminder';
  const detailsBoxBg = isOverdue ? '#fef2f2' : '#fffbeb';
  const totalColor = isOverdue ? '#dc2626' : '#f59e0b';

  return (
    <BaseLayout
      previewText={
        isOverdue
          ? `Overdue: Invoice ${billNumber} - ${balanceDue}`
          : `Reminder: Invoice ${billNumber} due soon`
      }
    >
      <Text style={{ ...styles.heading, color: headingColor }}>
        {headingText}
      </Text>
      <Text style={styles.paragraph}>Dear {contactPerson},</Text>

      {isOverdue ? (
        <Text style={styles.urgentText}>
          Your payment for Invoice {billNumber} is {daysOverdue} days overdue.
        </Text>
      ) : (
        <Text style={styles.paragraph}>
          This is a friendly reminder that Invoice {billNumber} is due in{' '}
          {Math.abs(daysOverdue)} days.
        </Text>
      )}

      <Section style={{ ...styles.detailsBox, backgroundColor: detailsBoxBg }}>
        <Row style={styles.detailRow}>
          <Column style={styles.detailLabel}>Invoice Number</Column>
          <Column style={styles.detailValue}>{billNumber}</Column>
        </Row>
        <Row style={styles.detailRow}>
          <Column style={styles.detailLabel}>Due Date</Column>
          <Column style={styles.detailValue}>{dueDate}</Column>
        </Row>
        <Row style={styles.totalRow}>
          <Column
            style={{
              fontSize: '16px',
              fontWeight: 'bold' as const,
              color: totalColor,
            }}
          >
            Amount Due
          </Column>
          <Column
            style={{
              fontSize: '16px',
              fontWeight: 'bold' as const,
              color: totalColor,
              textAlign: 'right' as const,
            }}
          >
            {balanceDue}
          </Column>
        </Row>
      </Section>

      <Text style={styles.paragraph}>
        Please make the payment at your earliest convenience to avoid any
        inconvenience.
      </Text>
      <Text style={styles.paragraph}>
        If you have already made the payment, please disregard this reminder.
      </Text>
      <Text style={styles.paragraph}>Thank you!</Text>

      <Hr style={{ borderColor: '#eeeeee', margin: '16px 0' }} />
      <Text style={styles.contactInfo}>
        This is an automated reminder from {businessName}.
      </Text>
      {businessEmail && (
        <Text style={styles.contactInfo}>Contact: {businessEmail}</Text>
      )}
    </BaseLayout>
  );
}

export default PaymentReminderEmail;
