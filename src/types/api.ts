/**
 * @file API types
 * @description Common API types and Zod schemas for request validation
 */

import { z } from 'zod';

// ============ Common Schemas ============

/**
 * MongoDB ObjectId schema
 */
export const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ID format');

/**
 * Pagination query schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Date range query schema
 */
export const dateRangeSchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

// ============ Party Schemas ============

/**
 * Contact schema
 */
export const contactSchema = z.object({
  person: z.string().min(1, 'Contact person is required').max(100),
  phone: z.string().min(1, 'Phone is required').max(20),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  gst: z.string().max(20).optional(),
});

/**
 * Site schema - represents a physical location for a party
 */
export const siteSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  address: z.string().min(1, 'Site address is required').max(500),
});

/**
 * Add site schema - for adding a site to an existing party
 */
export const addSiteSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  address: z.string().min(1, 'Site address is required').max(500),
});

/**
 * Update site schema - for updating an existing site on a party
 */
export const updateSiteSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  address: z.string().min(1, 'Site address is required').max(500).optional(),
});

/**
 * Create party schema
 */
export const createPartySchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1, 'Name is required').max(100),
  roles: z.array(z.enum(['client', 'supplier'])).min(1, 'At least one role is required'),
  contact: contactSchema,
  notes: z.string().max(1000).optional(),
  /** Initial site for the party - required on creation */
  initialSite: siteSchema,
});

/**
 * Update party schema
 */
export const updatePartySchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(100).optional(),
  roles: z.array(z.enum(['client', 'supplier'])).min(1).optional(),
  contact: contactSchema.partial().optional(),
  notes: z.string().max(1000).optional(),
});

/**
 * Agreement rate schema
 */
export const agreementRateSchema = z.object({
  itemId: objectIdSchema,
  ratePerDay: z.number().min(0, 'Rate must be positive'),
});

/**
 * Create agreement schema
 */
export const createAgreementSchema = z.object({
  /** Site code - must reference an existing site in the party */
  siteCode: z.string().min(1, 'Site code is required').max(20),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  terms: z.object({
    billingCycle: z.enum(['monthly', 'weekly', 'yearly']),
    paymentDueDays: z.number().int().min(0).max(365),
    securityDeposit: z.number().min(0).optional(),
    deliveryCartage: z.number().min(0).optional(),
    returnCartage: z.number().min(0).optional(),
    loadingCharge: z.number().min(0).optional(),
    unloadingCharge: z.number().min(0).optional(),
  }),
  rates: z.array(agreementRateSchema).min(1, 'At least one rate is required'),
});

/**
 * Update agreement schema
 */
export const updateAgreementSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional().nullable(),
  status: z.enum(['active', 'expired', 'terminated']).optional(),
  terms: z.object({
    billingCycle: z.enum(['monthly', 'weekly', 'yearly']).optional(),
    paymentDueDays: z.number().int().min(0).max(365).optional(),
    securityDeposit: z.number().min(0).optional(),
    deliveryCartage: z.number().min(0).optional(),
    returnCartage: z.number().min(0).optional(),
    loadingCharge: z.number().min(0).optional(),
    unloadingCharge: z.number().min(0).optional(),
  }).optional(),
});

/**
 * Add agreement rate schema
 */
export const addAgreementRateSchema = z.object({
  itemId: objectIdSchema,
  ratePerDay: z.number().min(0, 'Rate must be positive'),
});

/**
 * Update agreement rate schema
 */
export const updateAgreementRateSchema = z.object({
  ratePerDay: z.number().min(0, 'Rate must be positive'),
});

// ============ Inventory Schemas ============

/**
 * Create inventory item schema
 */
export const createInventorySchema = z.object({
  code: z.string().min(1, 'Code is required').max(20),
  name: z.string().min(1, 'Name is required').max(100),
  category: z.string().min(1, 'Category is required').max(50),
  totalQuantity: z.number().int().min(0),
  unit: z.string().min(1).max(20).default('pcs'),
  description: z.string().max(500).optional(),
  defaultRatePerDay: z.number().min(0).optional(),
  purchaseInfo: z
    .object({
      supplierPartyId: objectIdSchema.optional(),
      supplierName: z.string().max(100).optional(),
      costPerUnit: z.number().min(0),
      date: z.coerce.date(),
      paymentStatus: z.enum(['pending', 'partial', 'paid']),
    })
    .optional(),
});

/**
 * Update inventory item schema
 */
export const updateInventorySchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(100).optional(),
  category: z.string().min(1).max(50).optional(),
  unit: z.string().min(1).max(20).optional(),
  description: z.string().max(500).optional(),
  defaultRatePerDay: z.number().min(0).optional(),
});

/**
 * Adjust inventory quantity schema (purchase, scraped, sold)
 */
export const adjustQuantitySchema = z.object({
  type: z.enum(['purchase', 'scraped', 'sold']),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  date: z.coerce.date().refine((d) => d <= new Date(), { message: 'Date cannot be in the future' }),
  note: z.string().max(500).optional(),
});

// ============ Challan Schemas ============

/**
 * Challan item schema
 */
export const challanItemSchema = z.object({
  itemId: objectIdSchema,
  itemName: z.string().min(1).max(100),
  quantity: z.number().int().min(1),
  condition: z.enum(['good', 'damaged', 'missing']).default('good'),
});

/**
 * Create challan schema
 */
export const createChallanSchema = z.object({
  type: z.enum(['delivery', 'return']),
  partyId: objectIdSchema,
  agreementId: z.string().min(1),
  date: z.coerce.date(),
  items: z.array(challanItemSchema).min(1, 'At least one item is required'),
  notes: z.string().max(1000).optional(),
  transporterName: z.string().max(100).optional(),
  vehicleNumber: z.string().max(20).optional(),
  cartageCharge: z.number().min(0).optional(),
  loadingCharge: z.number().min(0).optional(),
  unloadingCharge: z.number().min(0).optional(),
});

/**
 * Update challan transportation schema
 */
export const updateChallanTransportationSchema = z.object({
  transporterName: z.string().max(100).optional(),
  vehicleNumber: z.string().max(20).optional(),
  cartageCharge: z.number().min(0).optional(),
  loadingCharge: z.number().min(0).optional(),
  unloadingCharge: z.number().min(0).optional(),
});

export const updateChallanItemSchema = z.object({
  quantity: z.number().int().min(1),
});

/**
 * Confirm challan schema
 */
export const confirmChallanSchema = z.object({
  confirmedBy: z.string().min(1, 'Confirmer name is required').max(100),
});

// ============ Bill Schemas ============

/**
 * Generate bill schema
 */
export const generateBillSchema = z.object({
  billDate: z.coerce.date(),
  partyId: objectIdSchema,
  agreementId: z.string().min(1),
  billingPeriod: z.object({
    start: z.coerce.date(),
    end: z.coerce.date(),
  }),
  taxMode: z.enum(['intra', 'inter']).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  sgstRate: z.number().min(0).max(100).optional(),
  cgstRate: z.number().min(0).max(100).optional(),
  igstRate: z.number().min(0).max(100).optional(),
  discountRate: z.number().min(0).max(100).optional(),
  notes: z.string().max(1000).optional(),
});

/**
 * Update bill status schema
 */
export const updateBillStatusSchema = z.object({
  status: z.enum(['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled']),
});

// ============ Payment Schemas ============

/**
 * Create payment schema
 */
export const createPaymentSchema = z.object({
  type: z.enum(['receivable', 'payable']),
  partyId: objectIdSchema,
  billId: objectIdSchema.optional(),
  purchaseId: objectIdSchema.optional(),
  amount: z.number().min(0.01, 'Amount must be positive'),
  method: z.enum(['cash', 'bank_transfer', 'upi', 'cheque', 'other']),
  reference: z.string().max(100).optional(),
  date: z.coerce.date(),
  notes: z.string().max(1000).optional(),
});

// ============ Business Schemas ============

/**
 * Business settings schema
 */
export const businessSettingsSchema = z.object({
  billingCycle: z.enum(['monthly', 'weekly', 'yearly']).optional(),
  currency: z.string().length(3).optional(),
  defaultTaxRate: z.number().min(0).max(100).optional(),
  defaultSgstRate: z.number().min(0).max(100).optional(),
  defaultCgstRate: z.number().min(0).max(100).optional(),
  defaultIgstRate: z.number().min(0).max(100).optional(),
  defaultPaymentDueDays: z.number().int().min(0).max(365).optional(),
  notifications: z
    .object({
      email: z.boolean().optional(),
      whatsapp: z.boolean().optional(),
    })
    .optional(),
});

/**
 * Create business schema
 */
export const createBusinessSchema = z.object({
  name: z.string().min(1, 'Business name is required').max(100),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  gst: z.string().max(20).optional(),
  settings: businessSettingsSchema.optional(),
});

/**
 * Update business schema
 */
export const updateBusinessSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  gst: z.string().max(20).optional(),
  logo: z.string().url().optional(),
  settings: businessSettingsSchema.optional(),
});

// ============ Employee Schemas ============

/**
 * Transporter details schema
 */
export const transporterDetailsSchema = z.object({
  vehicleNumber: z.string().min(1, 'Vehicle number is required').max(20),
});

/**
 * Create employee schema
 */
export const createEmployeeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  phone: z.string().max(20).optional(),
  type: z.enum(['transporter']),
  details: transporterDetailsSchema,
});

/**
 * Update employee schema
 */
export const updateEmployeeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  details: transporterDetailsSchema.partial().optional(),
});

// ============ API Response Types ============

/**
 * Standard API response interface
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message: string;
  timestamp: string;
  requestId?: string;
}

/**
 * Paginated API response interface
 */
export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Error response interface
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
  requestId?: string;
}

// Export types inferred from schemas
export type CreatePartyInput = z.infer<typeof createPartySchema>;
export type UpdatePartyInput = z.infer<typeof updatePartySchema>;
export type CreateAgreementInput = z.infer<typeof createAgreementSchema>;
export type CreateInventoryInput = z.infer<typeof createInventorySchema>;
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;
export type CreateChallanInput = z.infer<typeof createChallanSchema>;
export type GenerateBillInput = z.infer<typeof generateBillSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
export type BusinessSettingsInput = z.infer<typeof businessSettingsSchema>;
export type PaginationParams = z.infer<typeof paginationSchema>;
export type AddSiteInput = z.infer<typeof addSiteSchema>;
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
export type AdjustQuantityInput = z.infer<typeof adjustQuantitySchema>;
export type CreateEmployeeApiInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeApiInput = z.infer<typeof updateEmployeeSchema>;