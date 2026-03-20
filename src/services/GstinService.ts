/**
 * @file GSTIN Lookup Service
 * @description Service to fetch GST details from gstincheck.co.in API.
 * Provides GSTIN validation and business detail retrieval for auto-filling
 * party/business forms.
 */

import { logger } from '../utils/logger';
import { ValidationError } from '../middleware';
import { GstinCacheRepository } from '../repositories/GstinCacheRepository';

/**
 * Address details from the GSTIN API response
 */
interface GstinApiAddress {
  /** Building number */
  bno?: string;
  /** Floor number */
  flno?: string;
  /** Building name */
  bnm?: string;
  /** Street */
  st?: string;
  /** Location */
  loc?: string;
  /** District */
  dst?: string;
  /** State code */
  stcd?: string;
  /** City */
  city?: string;
  /** Pincode */
  pncd?: string;
  /** Latitude */
  lt?: string;
  /** Longitude */
  lg?: string;
}

/**
 * Raw API response structure from gstincheck.co.in
 */
interface GstinApiResponse {
  flag: boolean;
  message?: string;
  data?: {
    /** GSTIN number */
    gstin?: string;
    /** Legal name of the business */
    lgnm?: string;
    /** Trade name of the business */
    tradeNam?: string;
    /** Registration status (Active, Cancelled, etc.) */
    sts?: string;
    /** Type of registration (Regular, Composition, etc.) */
    dty?: string;
    /** Constitution of business (Proprietorship, Partnership, etc.) */
    ctb?: string;
    /** Registration date */
    rgdt?: string;
    /** Last update date */
    lstupdt?: string;
    /** State jurisdiction */
    stj?: string;
    /** Central jurisdiction */
    ctj?: string;
    /** Nature of business activities */
    nba?: string[];
    /** E-invoice status */
    einvoiceStatus?: string;
    /** Principal place of business address */
    pradr?: {
      addr?: GstinApiAddress;
      ntr?: string;
    };
    /** Additional places of business */
    adadr?: Array<{
      addr?: GstinApiAddress;
      ntr?: string;
    }>;
  };
}

/**
 * Cleaned and normalized GSTIN details returned by the service
 */
export interface GstinDetails {
  /** The GSTIN number */
  gstin: string;
  /** Legal name of the business */
  legalName: string;
  /** Trade name of the business */
  tradeName: string;
  /** Formatted principal address */
  address: string;
  /** Registration status (Active, Cancelled, Suspended, etc.) */
  status: string;
  /** Constitution of business (Proprietorship, Partnership, Pvt Ltd, etc.) */
  businessType: string;
  /** Type of GST registration (Regular, Composition, etc.) */
  registrationType: string;
  /** Date of GST registration */
  registrationDate: string;
  /** State jurisdiction */
  stateJurisdiction: string;
  /** Central jurisdiction */
  centralJurisdiction: string;
  /** Nature of business activities */
  businessActivities: string[];
  /** Whether the GSTIN is valid and active */
  isActive: boolean;
}

/** GSTIN is always exactly 15 characters */
const GSTIN_LENGTH = 15;

/** Regex pattern for valid GSTIN format: 2-digit state code + 10-char PAN + 1 entity + 1 check + 1 default */
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * GSTIN Lookup Service
 *
 * Fetches GST registration details from gstincheck.co.in API.
 * Used for auto-filling party and business forms with verified GST data.
 */
export class GstinService {
  private apiKey: string;
  private baseUrl: string;
  private cacheRepo: GstinCacheRepository;

  constructor() {
    this.apiKey = process.env.GSTIN_API_KEY || '';
    this.baseUrl = 'https://sheet.gstincheck.co.in/check';
    this.cacheRepo = new GstinCacheRepository();
  }

  /**
   * Format address fields into a single readable string
   * @param addr - Raw address object from the API
   * @returns Formatted address string
   */
  private formatAddress(addr?: GstinApiAddress): string {
    if (!addr) return '';

    const parts: string[] = [];

    if (addr.flno) parts.push(addr.flno);
    if (addr.bno) parts.push(addr.bno);
    if (addr.bnm) parts.push(addr.bnm);
    if (addr.st) parts.push(addr.st);
    if (addr.loc) parts.push(addr.loc);
    if (addr.city) parts.push(addr.city);
    if (addr.dst) parts.push(addr.dst);
    if (addr.stcd) parts.push(addr.stcd);
    if (addr.pncd) parts.push(`- ${addr.pncd}`);

    return parts.filter(Boolean).join(', ');
  }

  /**
   * Validate GSTIN format
   * @param gstin - GSTIN number to validate
   * @throws ValidationError if the GSTIN format is invalid
   */
  private validateGstinFormat(gstin: string): void {
    if (!gstin || gstin.length !== GSTIN_LENGTH) {
      throw new ValidationError(`GSTIN must be exactly ${GSTIN_LENGTH} characters`);
    }

    if (!GSTIN_REGEX.test(gstin.toUpperCase())) {
      throw new ValidationError('Invalid GSTIN format');
    }
  }

  /**
   * Fetch GST details for a given GSTIN number
   *
   * Makes a GET request to gstincheck.co.in API and returns
   * normalized business details including legal name, trade name,
   * address, registration status, and business type.
   *
   * @param gstin - The 15-character GSTIN number to look up
   * @returns Normalized GSTIN details
   * @throws ValidationError if GSTIN format is invalid or API key is not configured
   * @throws Error if the API call fails or returns an invalid response
   */
  async lookupGstin(gstin: string): Promise<GstinDetails> {
    const normalizedGstin = gstin.toUpperCase().trim();
    this.validateGstinFormat(normalizedGstin);

    // Check cache first
    const cached = await this.cacheRepo.findByGstin(normalizedGstin);
    if (cached) {
      logger.info('GSTIN cache hit', { gstin: normalizedGstin });
      await this.cacheRepo.refreshTtl(cached._id.toString());
      return cached.details;
    }

    if (!this.apiKey) {
      throw new ValidationError('GSTIN API key is not configured. Please set GSTIN_API_KEY in environment variables.');
    }

    const url = `${this.baseUrl}/${this.apiKey}/${normalizedGstin}`;

    logger.info('Looking up GSTIN from API', { gstin: normalizedGstin });

    try {
      const response = await fetch(url);

      if (!response.ok) {
        logger.error('GSTIN API HTTP error', { status: response.status, gstin: normalizedGstin });
        throw new Error(`GSTIN API returned status ${response.status}`);
      }

      const rawResult: unknown = await response.json();
      logger.info('GSTIN API raw response', { gstin: normalizedGstin, rawResult });

      const result = rawResult as GstinApiResponse;

      if (!result.flag || !result.data) {
        logger.warn('GSTIN lookup returned invalid/not found', { gstin: normalizedGstin, message: result.message, flag: result.flag, hasData: !!result.data });
        throw new ValidationError(result.message || `No GST details found for GSTIN: ${normalizedGstin}`);
      }

      const data = result.data;

      const details: GstinDetails = {
        gstin: data.gstin || normalizedGstin,
        legalName: data.lgnm || '',
        tradeName: data.tradeNam || '',
        address: this.formatAddress(data.pradr?.addr),
        status: data.sts || 'Unknown',
        businessType: data.ctb || '',
        registrationType: data.dty || '',
        registrationDate: data.rgdt || '',
        stateJurisdiction: data.stj || '',
        centralJurisdiction: data.ctj || '',
        businessActivities: data.nba || [],
        isActive: (data.sts || '').toLowerCase() === 'active',
      };

      // Cache the successful API response
      await this.cacheRepo.upsertCache(normalizedGstin, details);
      logger.info('GSTIN lookup successful, cached result', {
        gstin: normalizedGstin,
        legalName: details.legalName,
        status: details.status,
      });

      return details;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      logger.error('GSTIN lookup failed', {
        gstin: normalizedGstin,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new Error('Failed to fetch GST details. Please try again later.');
    }
  }
}

export default GstinService;
