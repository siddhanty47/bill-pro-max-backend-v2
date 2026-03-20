import React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
} from '@react-email/components';

interface BaseLayoutProps {
  children: React.ReactNode;
  previewText?: string;
}

const baseStyles = {
  body: {
    backgroundColor: '#f6f9fc',
    fontFamily: 'Arial, sans-serif',
    margin: '0',
    padding: '0',
  },
  container: {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    maxWidth: '600px',
    borderRadius: '8px',
    overflow: 'hidden' as const,
  },
  header: {
    backgroundColor: '#1a1a2e',
    padding: '24px 32px',
    textAlign: 'center' as const,
  },
  headerText: {
    color: '#ffffff',
    fontSize: '24px',
    fontWeight: 'bold' as const,
    margin: '0',
  },
  content: {
    padding: '32px',
  },
  footer: {
    padding: '16px 32px',
    textAlign: 'center' as const,
  },
  footerText: {
    color: '#999999',
    fontSize: '12px',
    margin: '4px 0',
  },
  hr: {
    borderColor: '#e6e6e6',
    margin: '0',
  },
};

export function BaseLayout({ children, previewText }: BaseLayoutProps) {
  return (
    <Html>
      <Head />
      {previewText && (
        <span
          style={{
            display: 'none',
            overflow: 'hidden',
            maxHeight: '0px',
            maxWidth: '0px',
          }}
        >
          {previewText}
        </span>
      )}
      <Body style={baseStyles.body}>
        <Container style={baseStyles.container}>
          <Section style={baseStyles.header}>
            <Text style={baseStyles.headerText}>BillProMax</Text>
          </Section>
          <Section style={baseStyles.content}>{children}</Section>
          <Hr style={baseStyles.hr} />
          <Section style={baseStyles.footer}>
            <Text style={baseStyles.footerText}>
              Powered by BillProMax — Scaffolding Rental Management
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default BaseLayout;
