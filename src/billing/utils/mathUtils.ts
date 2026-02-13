/**
 * @file Math utility functions
 * @description Utility functions for mathematical calculations in billing
 */

/**
 * Round a number to specified decimal places
 * @param value - Number to round
 * @param decimals - Number of decimal places
 * @returns Rounded number
 */
export function roundTo(value: number, decimals: number): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Calculate tax amount based on subtotal and tax rate
 * @param subtotal - Amount before tax
 * @param taxRate - Tax rate as percentage (e.g., 18 for 18%)
 * @param precision - Decimal places for rounding
 * @returns Tax amount
 */
export function calculateTax(
  subtotal: number,
  taxRate: number,
  precision: number = 2
): number {
  const taxAmount = subtotal * (taxRate / 100);
  return roundTo(taxAmount, precision);
}

/**
 * Calculate discount amount
 * @param subtotal - Amount before discount
 * @param discountRate - Discount rate as percentage (e.g., 10 for 10%)
 * @param precision - Decimal places for rounding
 * @returns Discount amount
 */
export function calculateDiscount(
  subtotal: number,
  discountRate: number,
  precision: number = 2
): number {
  const discountAmount = subtotal * (discountRate / 100);
  return roundTo(discountAmount, precision);
}

/**
 * Calculate percentage of a value
 * @param value - Base value
 * @param percentage - Percentage (e.g., 10 for 10%)
 * @param precision - Decimal places for rounding
 * @returns Calculated percentage value
 */
export function calculatePercentage(
  value: number,
  percentage: number,
  precision: number = 2
): number {
  const result = value * (percentage / 100);
  return roundTo(result, precision);
}

/**
 * Calculate the percentage that one number represents of another
 * @param part - Part value
 * @param whole - Whole value
 * @param precision - Decimal places for rounding
 * @returns Percentage value
 */
export function calculatePercentageOf(
  part: number,
  whole: number,
  precision: number = 2
): number {
  if (whole === 0) return 0;
  const percentage = (part / whole) * 100;
  return roundTo(percentage, precision);
}

/**
 * Add multiple numbers with precision
 * @param values - Array of numbers to add
 * @param precision - Decimal places for rounding
 * @returns Sum of all values
 */
export function addWithPrecision(values: number[], precision: number = 2): number {
  const sum = values.reduce((acc, val) => acc + val, 0);
  return roundTo(sum, precision);
}

/**
 * Multiply multiple numbers with precision
 * @param values - Array of numbers to multiply
 * @param precision - Decimal places for rounding
 * @returns Product of all values
 */
export function multiplyWithPrecision(values: number[], precision: number = 2): number {
  const product = values.reduce((acc, val) => acc * val, 1);
  return roundTo(product, precision);
}

/**
 * Check if a number is positive
 * @param value - Number to check
 * @returns True if positive
 */
export function isPositive(value: number): boolean {
  return value > 0;
}

/**
 * Check if a number is negative
 * @param value - Number to check
 * @returns True if negative
 */
export function isNegative(value: number): boolean {
  return value < 0;
}

/**
 * Get the absolute value of a number
 * @param value - Number to get absolute value for
 * @returns Absolute value
 */
export function absolute(value: number): number {
  return Math.abs(value);
}

/**
 * Calculate late fee for overdue amount
 * @param overdueAmount - The overdue amount
 * @param lateFeeRate - Late fee rate as percentage per day
 * @param overdueDays - Number of overdue days
 * @param precision - Decimal places for rounding
 * @returns Late fee amount
 */
export function calculateLateFee(
  overdueAmount: number,
  lateFeeRate: number,
  overdueDays: number,
  precision: number = 2
): number {
  const lateFee = overdueAmount * (lateFeeRate / 100) * overdueDays;
  return roundTo(lateFee, precision);
}
