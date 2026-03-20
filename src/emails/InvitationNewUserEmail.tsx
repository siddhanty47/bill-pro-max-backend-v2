import React from 'react';
import { Text, Link, Hr } from '@react-email/components';
import { BaseLayout } from './BaseLayout';

export interface InvitationNewUserEmailProps {
  businessName: string;
  role: string;
  inviterName: string;
  acceptUrl: string;
  expiryDays: number;
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
  roleBadge: {
    display: 'inline' as const,
    backgroundColor: '#e0e7ff',
    color: '#3730a3',
    padding: '4px 12px',
    borderRadius: '12px',
    fontWeight: '600' as const,
    fontSize: '13px',
  },
  buttonContainer: {
    textAlign: 'center' as const,
    margin: '24px 0',
  },
  button: {
    backgroundColor: '#0066cc',
    color: '#ffffff',
    padding: '14px 28px',
    borderRadius: '6px',
    fontWeight: 'bold' as const,
    fontSize: '14px',
    textDecoration: 'none',
  },
  smallText: {
    fontSize: '12px',
    color: '#666666',
    margin: '0 0 8px',
  },
  footerNote: {
    fontSize: '12px',
    color: '#999999',
    textAlign: 'center' as const,
    margin: '4px 0',
  },
};

export function InvitationNewUserEmail(props: InvitationNewUserEmailProps) {
  const { businessName, role, inviterName, acceptUrl, expiryDays } = props;

  return (
    <BaseLayout
      previewText={`${inviterName} invited you to join ${businessName} on BillProMax`}
    >
      <Text style={styles.heading}>You're invited!</Text>
      <Text style={styles.paragraph}>
        <strong>{inviterName}</strong> has invited you to join{' '}
        <strong>{businessName}</strong> as{' '}
        <span style={styles.roleBadge}>{role}</span> on BillProMax.
      </Text>
      <Text style={styles.paragraph}>
        BillProMax is a scaffolding rental management platform. Create your free
        account to get started:
      </Text>
      <Text style={styles.buttonContainer}>
        <Link href={acceptUrl} style={styles.button}>
          Create Account & Accept
        </Link>
      </Text>
      <Text style={styles.smallText}>
        This invitation expires in {expiryDays} days. You'll be automatically
        added to the business after creating your account.
      </Text>
      <Hr style={{ borderColor: '#eeeeee', margin: '16px 0' }} />
      <Text style={styles.footerNote}>
        If you didn't expect this invitation, you can safely ignore this email.
      </Text>
    </BaseLayout>
  );
}

export default InvitationNewUserEmail;
