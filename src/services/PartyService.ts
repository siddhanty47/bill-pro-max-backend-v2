/**
 * @file Party Service
 * @description Business logic for party (clients/suppliers) management
 */

import { Types } from 'mongoose';
import { PartyRepository, InventoryRepository, PartyFilterOptions, PaginationOptions, PaginatedResult } from '../repositories';
import { IParty, PartyRole, IAgreement, IContact, ISite } from '../models';
import { NotFoundError, ConflictError, ValidationError } from '../middleware';
import { generatePartyCode, generateAgreementId, generateSiteCode } from '../utils/helpers';
import { logger } from '../utils/logger';
import { AuditLogService } from './AuditLogService';
import { AuditPerformer } from '../types/api';

/**
 * Agreement rate with item details
 */
export interface AgreementRateWithItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  itemCategory: string;
  ratePerDay: number;
  openingBalance: number;
}

/**
 * Create party input
 */
export interface CreatePartyInput {
  code?: string;
  name: string;
  roles: PartyRole[];
  contact: IContact;
  notes?: string;
  /** Initial site for the party (required) */
  initialSite: {
    code?: string;
    address: string;
    stateCode?: string;
  };
}

/**
 * Update party input
 */
export interface UpdatePartyInput {
  code?: string;
  name?: string;
  roles?: PartyRole[];
  contact?: Partial<IContact>;
  notes?: string;
}

/**
 * Create agreement input
 */
export interface CreateAgreementInput {
  /** Site code - must reference an existing site in the party */
  siteCode: string;
  startDate: Date;
  endDate?: Date;
  terms: {
    billingCycle: 'monthly' | 'weekly' | 'yearly';
    paymentDueDays: number;
    securityDeposit?: number;
  };
  rates: Array<{
    itemId: string;
    ratePerDay: number;
    openingBalance?: number;
  }>;
}

/**
 * Update agreement input
 */
export interface UpdateAgreementInput {
  startDate?: Date;
  endDate?: Date;
  status?: 'active' | 'expired' | 'terminated';
  terms?: {
    billingCycle?: 'monthly' | 'weekly' | 'yearly';
    paymentDueDays?: number;
    securityDeposit?: number;
    deliveryCartage?: number;
    returnCartage?: number;
    loadingCharge?: number;
    unloadingCharge?: number;
  };
}

/**
 * Agreement with party info
 */
export interface AgreementWithParty {
  agreementId: string;
  siteCode: string;
  siteAddress?: string;
  siteStateCode?: string;
  partyId: string;
  partyName: string;
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'expired' | 'terminated';
  terms: {
    billingCycle: 'monthly' | 'weekly' | 'yearly';
    paymentDueDays: number;
    securityDeposit?: number;
  };
  rates: Array<{
    itemId: string;
    ratePerDay: number;
    openingBalance: number;
  }>;
  createdAt: Date;
}

/**
 * Party Service class
 */
export class PartyService {
  private partyRepository: PartyRepository;
  private inventoryRepository: InventoryRepository;
  private auditLogService: AuditLogService;

  constructor() {
    this.partyRepository = new PartyRepository();
    this.inventoryRepository = new InventoryRepository();
    this.auditLogService = new AuditLogService();
  }

  /**
   * Get parties for a business with filters
   * @param businessId - Business ID
   * @param filters - Filter options
   * @param pagination - Pagination options
   * @returns Paginated parties
   */
  async getParties(
    businessId: string,
    filters: PartyFilterOptions = {},
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<IParty>> {
    return this.partyRepository.findByBusiness(businessId, filters, pagination);
  }

  /**
   * Get clients for a business
   * @param businessId - Business ID
   * @param pagination - Pagination options
   * @returns Paginated clients
   */
  async getClients(
    businessId: string,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<IParty>> {
    return this.partyRepository.findClients(businessId, pagination);
  }

  /**
   * Get suppliers for a business
   * @param businessId - Business ID
   * @param pagination - Pagination options
   * @returns Paginated suppliers
   */
  async getSuppliers(
    businessId: string,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<IParty>> {
    return this.partyRepository.findSuppliers(businessId, pagination);
  }

  /**
   * Get party by ID
   * @param businessId - Business ID
   * @param partyId - Party ID
   * @returns Party
   */
  async getPartyById(businessId: string, partyId: string): Promise<IParty> {
    const party = await this.partyRepository.findByIdInBusiness(businessId, partyId);
    if (!party) {
      throw new NotFoundError('Party');
    }
    return party;
  }

  /**
   * Create a new party
   * @param businessId - Business ID
   * @param input - Party data
   * @returns Created party
   */
  async createParty(businessId: string, input: CreatePartyInput, performer?: AuditPerformer): Promise<IParty> {
    // Check for duplicate email if provided
    if (input.contact.email) {
      const existing = await this.partyRepository.findByEmail(businessId, input.contact.email);
      if (existing) {
        throw new ConflictError('A party with this email already exists');
      }
    }

    // Validate roles
    if (!input.roles.length) {
      throw new ValidationError('At least one role is required');
    }

    // Validate initial site
    if (!input.initialSite?.address) {
      throw new ValidationError('Initial site address is required');
    }

    // Generate or validate party code
    let code = input.code?.toUpperCase();
    if (code) {
      // Check if code already exists
      const existingWithCode = await this.partyRepository.findByCode(businessId, code);
      if (existingWithCode) {
        throw new ConflictError('A party with this code already exists');
      }
    } else {
      // Auto-generate code from name
      const existingCodes = await this.partyRepository.getAllCodes(businessId);
      code = generatePartyCode(input.name, existingCodes);
    }

    // Generate or validate site code
    let siteCode = input.initialSite.code?.toUpperCase();
    if (!siteCode) {
      // Auto-generate site code from address
      siteCode = generateSiteCode(input.initialSite.address, []);
    }

    // Create initial site
    const initialSite: ISite = {
      code: siteCode,
      address: input.initialSite.address,
      ...(input.initialSite.stateCode && { stateCode: input.initialSite.stateCode }),
    };

    const party = await this.partyRepository.create({
      businessId: new Types.ObjectId(businessId),
      code,
      name: input.name,
      roles: input.roles,
      contact: input.contact,
      sites: [initialSite],
      agreements: [],
      notes: input.notes,
      isActive: true,
    });

    logger.info('Party created', { businessId, partyId: party._id, code, name: party.name, siteCode });

    if (performer) {
      this.auditLogService.logChange({
        businessId,
        documentId: party._id.toString(),
        documentType: 'party',
        action: 'created',
        changes: [],
        performedBy: performer,
      });
    }

    return party;
  }

  /**
   * Update a party
   * @param businessId - Business ID
   * @param partyId - Party ID
   * @param input - Update data
   * @returns Updated party
   */
  async updateParty(
    businessId: string,
    partyId: string,
    input: UpdatePartyInput,
    performer?: AuditPerformer
  ): Promise<IParty> {
    const party = await this.getPartyById(businessId, partyId);
    const partyPlain = party.toObject();

    // Check for duplicate email if changing
    if (input.contact?.email && input.contact.email !== partyPlain.contact.email) {
      const existing = await this.partyRepository.findByEmail(businessId, input.contact.email);
      if (existing && existing._id.toString() !== partyId) {
        throw new ConflictError('A party with this email already exists');
      }
    }

    // Check for duplicate code if changing
    if (input.code && input.code.toUpperCase() !== partyPlain.code) {
      const existingWithCode = await this.partyRepository.findByCode(businessId, input.code.toUpperCase());
      if (existingWithCode && existingWithCode._id.toString() !== partyId) {
        throw new ConflictError('A party with this code already exists');
      }
    }

    const updateData: Partial<IParty> = {};
    
    if (input.code) updateData.code = input.code.toUpperCase();
    if (input.name) updateData.name = input.name;
    if (input.roles) updateData.roles = input.roles;
    if (input.notes !== undefined) updateData.notes = input.notes;
    
    if (input.contact) {
      updateData.contact = { ...partyPlain.contact, ...input.contact };
    }

    const updated = await this.partyRepository.updateById(partyId, updateData);
    if (!updated) {
      throw new NotFoundError('Party');
    }

    logger.info('Party updated', { businessId, partyId });

    if (performer) {
      const changes = AuditLogService.diffObjects(partyPlain, updated, ['code', 'name', 'roles', 'contact', 'notes']);
      this.auditLogService.logChange({
        businessId,
        documentId: partyId,
        documentType: 'party',
        action: 'updated',
        changes,
        performedBy: performer,
      });
    }

    return updated;
  }

  /**
   * Delete a party (soft delete)
   * @param businessId - Business ID
   * @param partyId - Party ID
   */
  async deleteParty(businessId: string, partyId: string, performer?: AuditPerformer): Promise<void> {
    await this.getPartyById(businessId, partyId);
    await this.partyRepository.softDelete(partyId);

    logger.info('Party deleted', { businessId, partyId });

    if (performer) {
      this.auditLogService.logChange({
        businessId,
        documentId: partyId,
        documentType: 'party',
        action: 'deleted',
        changes: [],
        performedBy: performer,
      });
    }
  }

  /**
   * Create an agreement for a party
   * @param businessId - Business ID
   * @param partyId - Party ID
   * @param input - Agreement data
   * @returns Updated party with new agreement
   */
  async createAgreement(
    businessId: string,
    partyId: string,
    input: CreateAgreementInput,
    performer?: AuditPerformer
  ): Promise<IParty> {
    const party = await this.getPartyById(businessId, partyId);

    // Ensure party has client role
    if (!party.roles.includes('client')) {
      throw new ValidationError('Agreements can only be created for clients');
    }

    // Validate site code exists
    const siteCodeUpper = input.siteCode.toUpperCase();
    const site = party.sites.find(s => s.code === siteCodeUpper);
    if (!site) {
      throw new NotFoundError(`Site with code '${input.siteCode}'`);
    }

    // Check for existing active agreement for this specific site
    const activeAgreementForSite = party.agreements.find(
      a => a.status === 'active' && a.siteCode === siteCodeUpper
    );
    if (activeAgreementForSite) {
      throw new ConflictError(`Site '${input.siteCode}' already has an active agreement`);
    }

    const agreement: IAgreement = {
      agreementId: generateAgreementId(party.code, siteCodeUpper),
      siteCode: siteCodeUpper,
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'active',
      terms: input.terms,
      rates: input.rates.map(r => ({
        itemId: new Types.ObjectId(r.itemId),
        ratePerDay: r.ratePerDay,
        openingBalance: r.openingBalance ?? 0,
      })),
      createdAt: new Date(),
    };

    const updated = await this.partyRepository.addAgreement(partyId, agreement);
    if (!updated) {
      throw new NotFoundError('Party');
    }

    logger.info('Agreement created', { businessId, partyId, agreementId: agreement.agreementId, siteCode: siteCodeUpper });

    if (performer) {
      this.auditLogService.logChange({
        businessId,
        documentId: agreement.agreementId,
        documentType: 'agreement',
        action: 'created',
        changes: [],
        performedBy: performer,
      });
    }

    return updated;
  }

  /**
   * Terminate an agreement
   * @param businessId - Business ID
   * @param partyId - Party ID
   * @param agreementId - Agreement ID
   * @returns Updated party
   */
  async terminateAgreement(
    businessId: string,
    partyId: string,
    agreementId: string
  ): Promise<IParty> {
    await this.getPartyById(businessId, partyId);

    const updated = await this.partyRepository.updateAgreementStatus(
      partyId,
      agreementId,
      'terminated'
    );

    if (!updated) {
      throw new NotFoundError('Agreement');
    }

    logger.info('Agreement terminated', { businessId, partyId, agreementId });

    return updated;
  }

  /**
   * Get active agreement for a party
   * @param partyId - Party ID
   * @returns Active agreement or undefined
   */
  async getActiveAgreement(partyId: string): Promise<IAgreement | undefined> {
    return this.partyRepository.getActiveAgreement(partyId);
  }

  /**
   * Get parties with active agreements (for billing)
   * @param businessId - Business ID
   * @returns Parties with active agreements
   */
  async getPartiesForBilling(businessId: string): Promise<IParty[]> {
    return this.partyRepository.findWithActiveAgreements(businessId);
  }

  /**
   * Check if a party code already exists in a business
   * @param businessId - Business ID
   * @param code - Party code to check
   * @returns True if code exists
   */
  async checkPartyCodeExists(businessId: string, code: string): Promise<boolean> {
    const existing = await this.partyRepository.findByCode(businessId, code.toUpperCase());
    return !!existing;
  }

  /**
   * Generate a party code for a given name
   * @param businessId - Business ID
   * @param name - Party name
   * @returns Generated unique party code
   */
  async generatePartyCodeForName(businessId: string, name: string): Promise<string> {
    const existingCodes = await this.partyRepository.getAllCodes(businessId);
    return generatePartyCode(name, existingCodes);
  }

  /**
   * Get all agreements for a business
   * @param businessId - Business ID
   * @returns All agreements with party info
   */
  async getAllAgreements(businessId: string): Promise<AgreementWithParty[]> {
    const results = await this.partyRepository.findAllAgreements(businessId);

    return results.map(({ party, agreement }) => {
      const site = party.sites.find(s => s.code === agreement.siteCode);
      const siteStateCode = site?.stateCode ?? (party.contact?.gst?.length === 15 ? party.contact.gst.substring(0, 2) : undefined);
      return {
        agreementId: agreement.agreementId,
        siteCode: agreement.siteCode,
        siteAddress: site?.address,
        siteStateCode,
        partyId: party._id.toString(),
        partyName: party.name,
        startDate: agreement.startDate,
        endDate: agreement.endDate,
        status: agreement.status,
        terms: agreement.terms,
        rates: agreement.rates.map(r => ({
          itemId: r.itemId.toString(),
          ratePerDay: r.ratePerDay,
          openingBalance: r.openingBalance ?? 0,
        })),
        createdAt: agreement.createdAt,
      };
    });
  }

  /**
   * Get a specific agreement by ID
   * @param businessId - Business ID
   * @param agreementId - Agreement ID
   * @returns Agreement with party info
   */
  async getAgreementById(businessId: string, agreementId: string): Promise<AgreementWithParty> {
    const result = await this.partyRepository.findAgreementById(businessId, agreementId);

    if (!result) {
      throw new NotFoundError('Agreement');
    }

    const { party, agreement } = result;
    const site = party.sites.find(s => s.code === agreement.siteCode);
    const siteStateCode = site?.stateCode ?? (party.contact?.gst?.length === 15 ? party.contact.gst.substring(0, 2) : undefined);
    return {
      agreementId: agreement.agreementId,
      siteCode: agreement.siteCode,
      siteAddress: site?.address,
      siteStateCode,
      partyId: party._id.toString(),
      partyName: party.name,
      startDate: agreement.startDate,
      endDate: agreement.endDate,
      status: agreement.status,
      terms: agreement.terms,
      rates: agreement.rates.map(r => ({
        itemId: r.itemId.toString(),
        ratePerDay: r.ratePerDay,
        openingBalance: r.openingBalance ?? 0,
      })),
      createdAt: agreement.createdAt,
    };
  }

  /**
   * Update an agreement
   * @param businessId - Business ID
   * @param agreementId - Agreement ID
   * @param input - Update data
   * @returns Updated agreement with party info
   */
  async updateAgreement(
    businessId: string,
    agreementId: string,
    input: UpdateAgreementInput,
    performer?: AuditPerformer
  ): Promise<AgreementWithParty> {
    // First find the agreement to get the party ID
    const existing = await this.partyRepository.findAgreementById(businessId, agreementId);

    if (!existing) {
      throw new NotFoundError('Agreement');
    }

    const updated = await this.partyRepository.updateAgreement(
      existing.party._id,
      agreementId,
      input
    );

    if (!updated) {
      throw new NotFoundError('Agreement');
    }

    const updatedAgreement = updated.agreements.find(a => a.agreementId === agreementId);
    if (!updatedAgreement) {
      throw new NotFoundError('Agreement');
    }

    logger.info('Agreement updated', { businessId, agreementId });

    if (performer) {
      const changes = AuditLogService.diffObjects(
        existing.agreement,
        updatedAgreement,
        ['startDate', 'endDate', 'status', 'terms']
      );
      this.auditLogService.logChange({
        businessId,
        documentId: agreementId,
        documentType: 'agreement',
        action: 'updated',
        changes,
        performedBy: performer,
      });
    }

    const site = updated.sites.find(s => s.code === updatedAgreement.siteCode);
    const siteStateCode = site?.stateCode ?? (updated.contact?.gst?.length === 15 ? updated.contact.gst.substring(0, 2) : undefined);
    return {
      agreementId: updatedAgreement.agreementId,
      siteCode: updatedAgreement.siteCode,
      siteAddress: site?.address,
      siteStateCode,
      partyId: updated._id.toString(),
      partyName: updated.name,
      startDate: updatedAgreement.startDate,
      endDate: updatedAgreement.endDate,
      status: updatedAgreement.status,
      terms: updatedAgreement.terms,
      rates: updatedAgreement.rates.map(r => ({
        itemId: r.itemId.toString(),
        ratePerDay: r.ratePerDay,
        openingBalance: r.openingBalance ?? 0,
      })),
      createdAt: updatedAgreement.createdAt,
    };
  }

  /**
   * Add an item to an agreement
   * @param businessId - Business ID
   * @param agreementId - Agreement ID
   * @param itemId - Inventory item ID
   * @param ratePerDay - Rate per day for the item
   * @returns Updated agreement with party info
   */
  async addItemToAgreement(
    businessId: string,
    agreementId: string,
    itemId: string,
    ratePerDay: number,
    openingBalance: number = 0
  ): Promise<AgreementWithParty> {
    // Find the agreement
    const existing = await this.partyRepository.findAgreementById(businessId, agreementId);
    if (!existing) {
      throw new NotFoundError('Agreement');
    }

    // Check if agreement is active
    if (existing.agreement.status !== 'active') {
      throw new ValidationError('Cannot add items to a non-active agreement');
    }

    // Check if inventory item exists
    const inventoryItem = await this.inventoryRepository.findByIdInBusiness(businessId, itemId);
    if (!inventoryItem) {
      throw new NotFoundError('Inventory item');
    }

    // Check if item is already in the agreement
    const itemExists = existing.agreement.rates.some(
      r => r.itemId.toString() === itemId
    );
    if (itemExists) {
      throw new ConflictError('Item already exists in agreement');
    }

    // Add the rate to the agreement
    const updated = await this.partyRepository.addAgreementRate(
      existing.party._id,
      agreementId,
      { itemId: new Types.ObjectId(itemId), ratePerDay, openingBalance }
    );

    if (!updated) {
      throw new NotFoundError('Agreement');
    }

    const updatedAgreement = updated.agreements.find(a => a.agreementId === agreementId);
    if (!updatedAgreement) {
      throw new NotFoundError('Agreement');
    }

    logger.info('Item added to agreement', { businessId, agreementId, itemId, ratePerDay });

    const site = updated.sites.find(s => s.code === updatedAgreement.siteCode);
    const siteStateCode = site?.stateCode ?? (updated.contact?.gst?.length === 15 ? updated.contact.gst.substring(0, 2) : undefined);
    return {
      agreementId: updatedAgreement.agreementId,
      siteCode: updatedAgreement.siteCode,
      siteAddress: site?.address,
      siteStateCode,
      partyId: updated._id.toString(),
      partyName: updated.name,
      startDate: updatedAgreement.startDate,
      endDate: updatedAgreement.endDate,
      status: updatedAgreement.status,
      terms: updatedAgreement.terms,
      rates: updatedAgreement.rates.map(r => ({
        itemId: r.itemId.toString(),
        ratePerDay: r.ratePerDay,
        openingBalance: r.openingBalance ?? 0,
      })),
      createdAt: updatedAgreement.createdAt,
    };
  }

  /**
   * Update a rate in an agreement
   * @param businessId - Business ID
   * @param agreementId - Agreement ID
   * @param itemId - Inventory item ID
   * @param ratePerDay - New rate per day
   * @returns Updated agreement with party info
   */
  async updateAgreementRate(
    businessId: string,
    agreementId: string,
    itemId: string,
    data: { ratePerDay?: number; openingBalance?: number }
  ): Promise<AgreementWithParty> {
    // Find the agreement
    const existing = await this.partyRepository.findAgreementById(businessId, agreementId);
    if (!existing) {
      throw new NotFoundError('Agreement');
    }

    // Check if agreement is active
    if (existing.agreement.status !== 'active') {
      throw new ValidationError('Cannot update rates in a non-active agreement');
    }

    // Check if item exists in the agreement
    const itemExists = existing.agreement.rates.some(
      r => r.itemId.toString() === itemId
    );
    if (!itemExists) {
      throw new NotFoundError('Item not found in agreement');
    }

    // Update the rate
    const updated = await this.partyRepository.updateAgreementRate(
      existing.party._id,
      agreementId,
      itemId,
      data
    );

    if (!updated) {
      throw new NotFoundError('Agreement');
    }

    const updatedAgreement = updated.agreements.find(a => a.agreementId === agreementId);
    if (!updatedAgreement) {
      throw new NotFoundError('Agreement');
    }

    logger.info('Agreement rate updated', { businessId, agreementId, itemId, ...data });

    const site = updated.sites.find(s => s.code === updatedAgreement.siteCode);
    const siteStateCode = site?.stateCode ?? (updated.contact?.gst?.length === 15 ? updated.contact.gst.substring(0, 2) : undefined);
    return {
      agreementId: updatedAgreement.agreementId,
      siteCode: updatedAgreement.siteCode,
      siteAddress: site?.address,
      siteStateCode,
      partyId: updated._id.toString(),
      partyName: updated.name,
      startDate: updatedAgreement.startDate,
      endDate: updatedAgreement.endDate,
      status: updatedAgreement.status,
      terms: updatedAgreement.terms,
      rates: updatedAgreement.rates.map(r => ({
        itemId: r.itemId.toString(),
        ratePerDay: r.ratePerDay,
        openingBalance: r.openingBalance ?? 0,
      })),
      createdAt: updatedAgreement.createdAt,
    };
  }

  /**
   * Get all rates for an agreement with item details
   * @param businessId - Business ID
   * @param agreementId - Agreement ID
   * @returns Agreement rates with item details
   */
  async getAgreementItems(
    businessId: string,
    agreementId: string
  ): Promise<AgreementRateWithItem[]> {
    const existing = await this.partyRepository.findAgreementById(businessId, agreementId);
    if (!existing) {
      throw new NotFoundError('Agreement');
    }

    // Fetch item details for each rate
    const ratesWithItems: AgreementRateWithItem[] = [];
    for (const rate of existing.agreement.rates) {
      const item = await this.inventoryRepository.findById(rate.itemId);
      if (item) {
        ratesWithItems.push({
          itemId: rate.itemId.toString(),
          itemCode: item.code,
          itemName: item.name,
          itemCategory: item.category,
          ratePerDay: rate.ratePerDay,
          openingBalance: rate.openingBalance ?? 0,
        });
      }
    }

    return ratesWithItems;
  }

  /**
   * Add a new site to an existing party
   * @param businessId - Business ID
   * @param partyId - Party ID
   * @param site - Site data (code is optional, will be auto-generated)
   * @returns Updated party
   */
  async addSiteToParty(
    businessId: string,
    partyId: string,
    site: { code?: string; address: string; stateCode?: string },
    performer?: AuditPerformer
  ): Promise<IParty> {
    const party = await this.getPartyById(businessId, partyId);

    // Validate address
    if (!site.address) {
      throw new ValidationError('Site address is required');
    }

    // Get existing site codes for this party
    const existingSiteCodes = party.sites.map(s => s.code);

    // Generate or validate site code
    let siteCode = site.code?.toUpperCase();
    if (siteCode) {
      // Check if code already exists within this party
      if (existingSiteCodes.map(c => c.toUpperCase()).includes(siteCode)) {
        throw new ConflictError(`Site code '${siteCode}' already exists for this party`);
      }
    } else {
      // Auto-generate site code from address
      siteCode = generateSiteCode(site.address, existingSiteCodes);
    }

    const newSite: ISite = {
      code: siteCode,
      address: site.address,
      ...(site.stateCode && { stateCode: site.stateCode }),
    };

    const updated = await this.partyRepository.addSite(partyId, newSite);
    if (!updated) {
      throw new NotFoundError('Party');
    }

    logger.info('Site added to party', { businessId, partyId, siteCode });

    if (performer) {
      this.auditLogService.logChange({
        businessId,
        documentId: partyId,
        documentType: 'party',
        action: 'updated',
        changes: [{ field: `sites.${siteCode}`, oldValue: null, newValue: newSite }],
        performedBy: performer,
      });
    }

    return updated;
  }

  /**
   * Update an existing site on a party
   * @param businessId - Business ID
   * @param partyId - Party ID
   * @param siteCode - Current site code to locate
   * @param update - Partial site data to update (code, address)
   * @returns Updated party
   */
  async updateSite(
    businessId: string,
    partyId: string,
    siteCode: string,
    update: { code?: string; address?: string; stateCode?: string },
    performer?: AuditPerformer
  ): Promise<IParty> {
    const party = await this.getPartyById(businessId, partyId);

    const existingSite = party.sites.find(s => s.code === siteCode);
    if (!existingSite) {
      throw new NotFoundError(`Site with code '${siteCode}'`);
    }

    // Capture old site as plain object before update
    const oldSitePlain = party.toObject().sites.find((s: ISite) => s.code === siteCode);

    if (update.code) {
      const newCode = update.code.toUpperCase();
      if (newCode !== siteCode && party.sites.some(s => s.code.toUpperCase() === newCode)) {
        throw new ConflictError(`Site code '${newCode}' already exists for this party`);
      }
      update.code = newCode;
    }

    const updated = await this.partyRepository.updateSite(partyId, siteCode, update);
    if (!updated) {
      throw new NotFoundError('Party or site');
    }

    logger.info('Site updated on party', { businessId, partyId, siteCode });

    if (performer && oldSitePlain) {
      const newSitePlain = updated.toObject().sites.find((s: ISite) => s.code === (update.code || siteCode));
      const changes = AuditLogService.diffObjects(oldSitePlain, newSitePlain || {});
      const prefixedChanges = changes.map(c => ({
        ...c,
        field: `sites.${siteCode}.${c.field}`,
      }));
      this.auditLogService.logChange({
        businessId,
        documentId: partyId,
        documentType: 'party',
        action: 'updated',
        changes: prefixedChanges,
        performedBy: performer,
      });
    }

    return updated;
  }
}

export default PartyService;
