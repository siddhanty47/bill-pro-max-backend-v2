/**
 * @file Utility helper functions
 * @description Common utility functions used across the application
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique ID with optional prefix
 * @param prefix - Optional prefix for the ID
 * @returns Generated unique ID
 */
export function generateId(prefix?: string): string {
  const id = uuidv4().replace(/-/g, '').substring(0, 12);
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Generate a sequential number with padding
 * @param sequence - The sequence number
 * @param padding - Number of digits to pad to
 * @param prefix - Optional prefix
 * @returns Formatted sequence string
 */
export function generateSequenceNumber(
  sequence: number,
  padding: number = 4,
  prefix?: string
): string {
  const paddedNumber = String(sequence).padStart(padding, '0');
  return prefix ? `${prefix}-${paddedNumber}` : paddedNumber;
}

/**
 * Generate a bill number in format INV-YYYY-NNNN
 * @param sequence - The sequence number
 * @param year - Optional year (defaults to current year)
 * @returns Formatted bill number
 */
export function generateBillNumber(sequence: number, year?: number): string {
  const billYear = year || new Date().getFullYear();
  return `INV-${billYear}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Get the current Indian financial year in format "YYYY-YY"
 * Financial year starts on April 1st and ends on March 31st
 * Example: If current date is Feb 2026, returns "2025-26"
 *          If current date is May 2026, returns "2026-27"
 * @param date - Optional date to calculate FY for (defaults to current date)
 * @returns Financial year string in format "YYYY-YY"
 */
export function getFinancialYear(date?: Date): string {
  const d = date || new Date();
  const month = d.getMonth(); // 0-indexed (0 = January, 3 = April)
  const year = d.getFullYear();
  
  // Financial year starts in April (month index 3)
  // If we're in Jan-Mar, we're still in the previous FY
  const fyStartYear = month < 3 ? year - 1 : year;
  const fyEndYear = fyStartYear + 1;
  
  // Format: "2025-26"
  return `${fyStartYear}-${String(fyEndYear).slice(-2)}`;
}

/**
 * Generate a challan number in format {D|R}-{FY}-{NNNN}
 * D = Delivery, R = Return
 * FY = Financial Year (e.g., 2025-26)
 * NNNN = Sequential number with 4-digit padding
 * 
 * Examples:
 *   - Delivery challan: "D-2025-26-0001"
 *   - Return challan: "R-2025-26-0007"
 * 
 * @param type - Challan type ('delivery' or 'return')
 * @param sequence - The sequence number
 * @param financialYear - Optional financial year (defaults to current FY)
 * @returns Formatted challan number
 */
export function generateChallanNumber(
  type: 'delivery' | 'return',
  sequence: number,
  financialYear?: string
): string {
  const prefix = type === 'delivery' ? 'D' : 'R';
  const fy = financialYear || getFinancialYear();
  return `${prefix}-${fy}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Check if a string is a valid MongoDB ObjectId
 * @param id - The string to validate
 * @returns True if valid ObjectId format
 */
export function isValidObjectId(id: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(id);
}

/**
 * Safely parse JSON with fallback
 * @param jsonString - JSON string to parse
 * @param fallback - Fallback value if parsing fails
 * @returns Parsed JSON or fallback value
 */
export function safeJsonParse<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return fallback;
  }
}

/**
 * Deep clone an object
 * @param obj - Object to clone
 * @returns Cloned object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * Remove undefined properties from an object
 * @param obj - Object to clean
 * @returns Object without undefined properties
 */
export function removeUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  ) as Partial<T>;
}

/**
 * Format currency amount
 * @param amount - Amount to format
 * @param currency - Currency code (default: INR)
 * @param locale - Locale for formatting (default: en-IN)
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number,
  currency: string = 'INR',
  locale: string = 'en-IN'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Calculate percentage
 * @param value - The value
 * @param total - The total
 * @param decimals - Number of decimal places
 * @returns Percentage value
 */
export function calculatePercentage(value: number, total: number, decimals: number = 2): number {
  if (total === 0) return 0;
  return Number(((value / total) * 100).toFixed(decimals));
}

/**
 * Generate a party code from party name
 * Takes letters from words sequentially until we have 4 uppercase chars
 * Examples:
 *   - "H S Construction" → "HSCO"
 *   - "John Doe" → "JOHN"
 *   - "AB Corp" → "ABCO"
 *   - "X Y Z Ltd" → "XYZL"
 *   - "Jo" → "JOXX" (padded)
 * @param name - Party name
 * @param existingCodes - Array of existing codes to check for duplicates
 * @returns Unique party code
 */
export function generatePartyCode(name: string, existingCodes: string[]): string {
  // Extract only letters from the name (remove spaces, numbers, special chars)
  const letters = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
  
  // Take first 4 letters, pad with 'X' if less than 4
  let baseCode = letters.substring(0, 4);
  if (baseCode.length < 4) {
    baseCode = baseCode.padEnd(4, 'X');
  }
  
  // If base code is less than 3 chars (after padding would be XXXX), use what we have
  if (baseCode === 'XXXX' && letters.length > 0) {
    baseCode = letters.substring(0, Math.min(letters.length, 4)).padEnd(4, 'X');
  }
  
  // Check if code exists, if so append incrementing number
  const existingCodesUpper = existingCodes.map(c => c.toUpperCase());
  
  if (!existingCodesUpper.includes(baseCode)) {
    return baseCode;
  }
  
  // Find next available number suffix
  let counter = 1;
  while (existingCodesUpper.includes(`${baseCode}${counter}`)) {
    counter++;
  }
  
  return `${baseCode}${counter}`;
}

/**
 * Generate an agreement ID in format {PartyCode}_{SiteCode}_{timestamp}
 * @param partyCode - The party code
 * @param siteCode - The site code
 * @returns Agreement ID string
 */
export function generateAgreementId(partyCode: string, siteCode: string): string {
  return `${partyCode.toUpperCase()}_${siteCode.toUpperCase()}_${Date.now()}`;
}

/**
 * Generate a site code from site address or a default label
 * Takes letters from words sequentially until we have 4 uppercase chars
 * If address is short, pads with 'S' and number
 * @param addressOrLabel - Site address or a label to generate code from
 * @param existingCodes - Array of existing site codes within the party
 * @returns Unique site code
 */
export function generateSiteCode(addressOrLabel: string, existingCodes: string[]): string {
  // Extract only letters from the address/label
  const letters = addressOrLabel.replace(/[^a-zA-Z]/g, '').toUpperCase();
  
  // Take first 4 letters, or use 'SITE' as fallback
  let baseCode = letters.length >= 4 
    ? letters.substring(0, 4) 
    : letters.length > 0 
      ? letters.padEnd(4, 'S')
      : 'SITE';
  
  // Check if code exists, if so append incrementing number
  const existingCodesUpper = existingCodes.map(c => c.toUpperCase());
  
  if (!existingCodesUpper.includes(baseCode)) {
    return baseCode;
  }
  
  // Find next available number suffix
  let counter = 1;
  while (existingCodesUpper.includes(`${baseCode}${counter}`)) {
    counter++;
  }
  
  return `${baseCode}${counter}`;
}
