/**
 * @file Shared PDF template utilities
 * @description Font registration and formatting helpers shared across all PDF templates
 */

import path from 'path';
import { Font } from '@react-pdf/renderer';

// Register Roboto font (supports ₹ rupee symbol). Uses latin-ext subset for rupee (U+20B9).
// Bundled locally to avoid network dependency at runtime.
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
 * Format currency for PDF (Roboto font supports ₹ symbol)
 */
export const formatCurrency = (amount: number, currency: string = 'INR'): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

/**
 * Format date for display in PDFs
 */
export const formatDateForPdf = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

