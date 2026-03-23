/**
 * @file ShareLink Service
 * @description Business logic for creating, managing, and resolving share links.
 * Handles both authenticated management operations and public portal data retrieval.
 */

import crypto from 'crypto';
import { Types } from 'mongoose';
import { ShareLinkRepository } from '../repositories/ShareLinkRepository';
import { PartyRepository } from '../repositories/PartyRepository';
import { BusinessRepository } from '../repositories/BusinessRepository';
import { ChallanRepository } from '../repositories/ChallanRepository';
import { BillRepository } from '../repositories/BillRepository';
import { PaymentRepository } from '../repositories/PaymentRepository';
import { IShareLink } from '../models/ShareLink';
import { AppError, NotFoundError, ValidationError } from '../middleware';
import { ChallanService } from './ChallanService';
import { BillingService } from './BillingService';
import { logger } from '../utils/logger';

/**
 * Input for creating a share link
 */
export interface CreateShareLinkInput {
  siteCode?: string;
  expiresAt?: string;
  label?: string;
}

/**
 * Input for updating a share link
 */
export interface UpdateShareLinkInput {
  expiresAt?: string | null;
  label?: string;
}

/**
 * ShareLink Service class.
 * Handles share link lifecycle and portal data retrieval.
 */
export class ShareLinkService {
  private shareLinkRepository: ShareLinkRepository;
  private partyRepository: PartyRepository;
  private businessRepository: BusinessRepository;
  private challanRepository: ChallanRepository;
  private billRepository: BillRepository;
  private paymentRepository: PaymentRepository;
  private challanService: ChallanService;
  private billingService: BillingService;

  constructor() {
    this.shareLinkRepository = new ShareLinkRepository();
    this.partyRepository = new PartyRepository();
    this.businessRepository = new BusinessRepository();
    this.challanRepository = new ChallanRepository();
    this.billRepository = new BillRepository();
    this.paymentRepository = new PaymentRepository();
    this.challanService = new ChallanService();
    this.billingService = new BillingService();
  }

  /**
   * Create a new share link for a party.
   * @param businessId - Business document ID
   * @param partyId - Party document ID
   * @param input - Share link options
   * @param createdBy - Supabase userId of creator
   * @returns Created share link
   */
  async createShareLink(
    businessId: string,
    partyId: string,
    input: CreateShareLinkInput,
    createdBy: string
  ): Promise<IShareLink> {
    // Validate party exists in business
    const party = await this.partyRepository.findByIdInBusiness(businessId, partyId);
    if (!party) {
      throw new NotFoundError('Party');
    }

    // Validate siteCode if provided
    if (input.siteCode) {
      const siteExists = party.sites?.some((s) => s.code === input.siteCode);
      if (!siteExists) {
        throw new ValidationError(`Site code "${input.siteCode}" not found on this party`);
      }
    }

    const token = crypto.randomBytes(32).toString('hex');

    const shareLink = await this.shareLinkRepository.create({
      businessId: new Types.ObjectId(businessId),
      partyId: new Types.ObjectId(partyId),
      token,
      siteCode: input.siteCode,
      label: input.label,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      status: 'active',
      createdBy,
      accessCount: 0,
    } as Partial<IShareLink>);

    logger.info('Share link created', { businessId, partyId, linkId: shareLink._id });
    return shareLink;
  }

  /**
   * Get all share links for a party.
   * @param businessId - Business document ID
   * @param partyId - Party document ID
   * @returns Array of share links
   */
  async getShareLinks(businessId: string, partyId: string): Promise<IShareLink[]> {
    return this.shareLinkRepository.findByParty(businessId, partyId);
  }

  /**
   * Revoke a share link.
   * @param linkId - ShareLink document ID
   * @param businessId - Business ID for ownership validation
   */
  async revokeShareLink(linkId: string, businessId: string): Promise<void> {
    const link = await this.shareLinkRepository.findById(linkId);
    if (!link || link.businessId.toString() !== businessId) {
      throw new NotFoundError('Share link');
    }

    if (link.status === 'revoked') {
      throw new AppError('Share link is already revoked', 400, 'ALREADY_REVOKED');
    }

    await this.shareLinkRepository.revokeLink(linkId);
    logger.info('Share link revoked', { linkId, businessId });
  }

  /**
   * Update a share link's label or expiry.
   * @param linkId - ShareLink document ID
   * @param businessId - Business ID for ownership validation
   * @param input - Fields to update
   * @returns Updated share link
   */
  async updateShareLink(
    linkId: string,
    businessId: string,
    input: UpdateShareLinkInput
  ): Promise<IShareLink> {
    const link = await this.shareLinkRepository.findById(linkId);
    if (!link || link.businessId.toString() !== businessId) {
      throw new NotFoundError('Share link');
    }

    const updateData: Record<string, unknown> = {};
    if (input.label !== undefined) updateData.label = input.label;
    if (input.expiresAt !== undefined) {
      updateData.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    }

    const updated = await this.shareLinkRepository.updateById(linkId, updateData);
    if (!updated) {
      throw new NotFoundError('Share link');
    }

    logger.info('Share link updated', { linkId, businessId });
    return updated;
  }

  // ─── Portal (public) methods ───────────────────────────────────────

  /**
   * Resolve a token to an active share link. Validates status and expiry,
   * then increments the access count.
   * @param token - Share link token
   * @returns Resolved share link
   */
  async resolveToken(token: string): Promise<IShareLink> {
    const link = await this.shareLinkRepository.findByToken(token);
    if (!link) {
      throw new AppError('Invalid or revoked share link', 404, 'SHARE_LINK_INVALID');
    }

    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new AppError('This share link has expired', 410, 'SHARE_LINK_EXPIRED');
    }

    // Fire-and-forget access tracking
    this.shareLinkRepository.incrementAccessCount(link._id).catch((err) => {
      logger.warn('Failed to increment share link access count', { linkId: link._id, error: err });
    });

    return link;
  }

  /**
   * Get portal info (party name, business name, scope).
   * @param shareLink - Resolved share link
   */
  async getPortalInfo(shareLink: IShareLink) {
    const [party, business] = await Promise.all([
      this.partyRepository.findById(shareLink.partyId),
      this.businessRepository.findById(shareLink.businessId),
    ]);

    if (!party || !business) {
      throw new NotFoundError('Party or Business');
    }

    return {
      partyName: party.name,
      partyCode: party.code,
      businessName: business.name,
      siteCode: shareLink.siteCode || null,
      siteName: shareLink.siteCode
        ? party.sites?.find((s) => s.code === shareLink.siteCode)?.address || shareLink.siteCode
        : null,
    };
  }

  /**
   * Get the agreementIds scoped to this share link.
   * If siteCode is set, returns only agreements for that site.
   * Otherwise returns all agreements for the party.
   */
  private async getScopedAgreementIds(shareLink: IShareLink): Promise<string[]> {
    const party = await this.partyRepository.findById(shareLink.partyId);
    if (!party) return [];

    const agreements = party.agreements || [];
    if (shareLink.siteCode) {
      return agreements
        .filter((a) => a.siteCode === shareLink.siteCode)
        .map((a) => a.agreementId);
    }
    return agreements.map((a) => a.agreementId);
  }

  /**
   * Get challans for the portal.
   * @param shareLink - Resolved share link
   * @param filters - Optional type/date filters
   */
  async getPortalChallans(
    shareLink: IShareLink,
    filters?: { type?: 'delivery' | 'return'; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number }
  ) {
    const agreementIds = await this.getScopedAgreementIds(shareLink);
    const businessId = shareLink.businessId.toString();
    const partyId = shareLink.partyId.toString();

    const challanFilters: Record<string, unknown> = {
      partyId,
      status: 'confirmed',
    };
    if (filters?.type) challanFilters.type = filters.type;
    if (filters?.dateFrom) challanFilters.dateFrom = new Date(filters.dateFrom);
    if (filters?.dateTo) challanFilters.dateTo = new Date(filters.dateTo);

    // If site-scoped, filter by agreementIds
    if (shareLink.siteCode && agreementIds.length > 0) {
      challanFilters.agreementId = { $in: agreementIds };
    }

    const result = await this.challanRepository.findByBusiness(businessId, challanFilters, {
      page: filters?.page || 1,
      pageSize: filters?.pageSize || 20,
      sortBy: 'date',
      sortOrder: 'desc',
    });

    // Minimize data: strip internal fields (keep _id for PDF download)
    return {
      data: result.data.map((c) => ({
        _id: (c as unknown as { _id: { toString(): string } })._id.toString(),
        challanNumber: c.challanNumber,
        type: c.type,
        date: c.date,
        agreementId: c.agreementId,
        items: c.items.map((i) => ({ itemName: i.itemName, quantity: i.quantity })),
        status: c.status,
      })),
      pagination: result.pagination,
    };
  }

  /**
   * Get running items (items currently with the party).
   * @param shareLink - Resolved share link
   */
  async getPortalRunningItems(shareLink: IShareLink) {
    const businessId = shareLink.businessId.toString();
    const partyId = shareLink.partyId.toString();

    if (shareLink.siteCode) {
      const agreementIds = await this.getScopedAgreementIds(shareLink);
      const results = await Promise.all(
        agreementIds.map((agreementId) =>
          this.challanRepository.getItemsWithParty(businessId, partyId, agreementId)
        )
      );

      // Merge items across agreements
      const merged = new Map<string, { itemName: string; quantity: number }>();
      for (const items of results) {
        for (const item of items) {
          const existing = merged.get(item.itemId);
          if (existing) {
            existing.quantity += item.quantity;
          } else {
            merged.set(item.itemId, { itemName: item.itemName, quantity: item.quantity });
          }
        }
      }

      return Array.from(merged.values()).filter((i) => i.quantity > 0);
    }

    const items = await this.challanRepository.getItemsWithParty(businessId, partyId);
    return items
      .map((i) => ({ itemName: i.itemName, quantity: i.quantity }))
      .filter((i) => i.quantity > 0);
  }

  /**
   * Get bills for the portal.
   * @param shareLink - Resolved share link
   * @param filters - Optional status/date filters
   */
  async getPortalBills(
    shareLink: IShareLink,
    filters?: { status?: string; page?: number; pageSize?: number }
  ) {
    const businessId = shareLink.businessId.toString();
    const partyId = shareLink.partyId.toString();

    const billFilters: Record<string, unknown> = { partyId };
    if (filters?.status) billFilters.status = filters.status;

    const result = await this.billRepository.findByBusiness(businessId, billFilters, {
      page: filters?.page || 1,
      pageSize: filters?.pageSize || 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    const agreementIds = shareLink.siteCode
      ? new Set(await this.getScopedAgreementIds(shareLink))
      : null;

    const filteredData = agreementIds
      ? result.data.filter((b) => agreementIds.has(b.agreementId))
      : result.data;

    return {
      data: filteredData.map((b) => ({
        _id: (b as unknown as { _id: { toString(): string } })._id.toString(),
        billNumber: b.billNumber,
        billingPeriod: b.billingPeriod,
        billDate: b.billDate,
        totalAmount: b.totalAmount,
        amountPaid: b.amountPaid,
        status: b.status,
        dueDate: b.dueDate,
      })),
      pagination: result.pagination,
    };
  }

  /**
   * Get aggregated summary for the portal.
   * @param shareLink - Resolved share link
   */
  async getPortalSummary(shareLink: IShareLink) {
    const [runningItems, billsResult] = await Promise.all([
      this.getPortalRunningItems(shareLink),
      this.getPortalBills(shareLink, { pageSize: 1000 }),
    ]);

    const bills = billsResult.data;
    const totalOutstanding = bills.reduce(
      (sum, b) => sum + (b.totalAmount - b.amountPaid),
      0
    );
    const totalBilled = bills.reduce((sum, b) => sum + b.totalAmount, 0);
    const totalPaid = bills.reduce((sum, b) => sum + b.amountPaid, 0);
    const totalItemsInUse = runningItems.reduce((sum, i) => sum + i.quantity, 0);

    const overdueBills = bills.filter(
      (b) => b.status !== 'paid' && b.status !== 'cancelled' && new Date(b.dueDate) < new Date()
    ).length;

    return {
      totalOutstanding,
      totalBilled,
      totalPaid,
      totalItemsInUse,
      itemsBreakdown: runningItems,
      billCount: bills.length,
      overdueBills,
    };
  }
  /**
   * Get payments for the portal.
   * @param shareLink - Resolved share link
   * @param filters - Optional pagination filters
   */
  async getPortalPayments(
    shareLink: IShareLink,
    filters?: { page?: number; pageSize?: number }
  ) {
    const businessId = shareLink.businessId.toString();
    const partyId = shareLink.partyId.toString();

    const result = await this.paymentRepository.findByBusiness(
      businessId,
      { partyId },
      {
        page: filters?.page || 1,
        pageSize: filters?.pageSize || 20,
        sortBy: 'date',
        sortOrder: 'desc',
      }
    );

    return {
      data: result.data.map((p) => ({
        _id: (p as unknown as { _id: { toString(): string } })._id.toString(),
        amount: p.amount,
        method: p.method,
        date: p.date,
        status: p.status,
        reference: p.reference || null,
        notes: p.notes || null,
      })),
      pagination: result.pagination,
    };
  }

  /**
   * Get a challan PDF via the portal.
   * Validates that the challan belongs to the share link's party and scope.
   */
  async getPortalChallanPdf(
    shareLink: IShareLink,
    challanId: string
  ): Promise<{ buffer: Buffer; challanNumber: string }> {
    const businessId = shareLink.businessId.toString();
    const partyId = shareLink.partyId.toString();

    // Verify challan belongs to this party
    const challan = await this.challanRepository.findByIdInBusiness(businessId, challanId);
    if (!challan || challan.partyId.toString() !== partyId) {
      throw new NotFoundError('Challan');
    }

    // If site-scoped, verify the challan's agreementId is in scope
    if (shareLink.siteCode) {
      const agreementIds = await this.getScopedAgreementIds(shareLink);
      if (!agreementIds.includes(challan.agreementId)) {
        throw new NotFoundError('Challan');
      }
    }

    return this.challanService.generateChallanPdf(businessId, challanId);
  }

  /**
   * Get a bill PDF via the portal.
   * Validates that the bill belongs to the share link's party and scope.
   */
  async getPortalBillPdf(
    shareLink: IShareLink,
    billId: string
  ): Promise<Buffer> {
    const businessId = shareLink.businessId.toString();
    const partyId = shareLink.partyId.toString();

    // Verify bill belongs to this party
    const bill = await this.billRepository.findByIdInBusiness(businessId, billId);
    if (!bill || bill.partyId.toString() !== partyId) {
      throw new NotFoundError('Bill');
    }

    // If site-scoped, verify the bill's agreementId is in scope
    if (shareLink.siteCode) {
      const agreementIds = await this.getScopedAgreementIds(shareLink);
      if (!agreementIds.includes(bill.agreementId)) {
        throw new NotFoundError('Bill');
      }
    }

    return this.billingService.generateBillPdf(businessId, billId);
  }
}

export default ShareLinkService;
