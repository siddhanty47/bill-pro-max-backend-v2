/**
 * @file Party Repository
 * @description Repository for party entity operations
 */

import { Types, FilterQuery } from 'mongoose';
import { BaseRepository, PaginationOptions, PaginatedResult } from './BaseRepository';
import { Party, IParty, PartyRole, IAgreement, IAgreementRate, ISite } from '../models';

/**
 * Party filter options
 */
export interface PartyFilterOptions {
  /** Filter by role */
  role?: PartyRole;
  /** Filter by active status */
  isActive?: boolean;
  /** Search term (name or contact person) */
  search?: string;
}

/**
 * Party repository class
 */
export class PartyRepository extends BaseRepository<IParty> {
  constructor() {
    super(Party);
  }

  /**
   * Find parties by business ID with filters
   * @param businessId - Business ID
   * @param filters - Filter options
   * @param pagination - Pagination options
   * @returns Paginated parties
   */
  async findByBusiness(
    businessId: string | Types.ObjectId,
    filters: PartyFilterOptions = {},
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<IParty>> {
    const query: FilterQuery<IParty> = {
      businessId: new Types.ObjectId(businessId.toString()),
    };

    if (filters.role) {
      query.roles = filters.role;
    }

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    return this.findPaginated(query, pagination);
  }

  /**
   * Find clients for a business
   * @param businessId - Business ID
   * @param pagination - Pagination options
   * @returns Paginated clients
   */
  async findClients(
    businessId: string | Types.ObjectId,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<IParty>> {
    return this.findByBusiness(businessId, { role: 'client', isActive: true }, pagination);
  }

  /**
   * Find suppliers for a business
   * @param businessId - Business ID
   * @param pagination - Pagination options
   * @returns Paginated suppliers
   */
  async findSuppliers(
    businessId: string | Types.ObjectId,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<IParty>> {
    return this.findByBusiness(businessId, { role: 'supplier', isActive: true }, pagination);
  }

  /**
   * Find party by ID within a business
   * @param businessId - Business ID
   * @param partyId - Party ID
   * @returns Party or null
   */
  async findByIdInBusiness(
    businessId: string | Types.ObjectId,
    partyId: string | Types.ObjectId
  ): Promise<IParty | null> {
    return this.findOne({
      _id: new Types.ObjectId(partyId.toString()),
      businessId: new Types.ObjectId(businessId.toString()),
    });
  }

  /**
   * Find party by email within a business
   * @param businessId - Business ID
   * @param email - Contact email
   * @returns Party or null
   */
  async findByEmail(
    businessId: string | Types.ObjectId,
    email: string
  ): Promise<IParty | null> {
    return this.findOne({
      businessId: new Types.ObjectId(businessId.toString()),
      'contact.email': email.toLowerCase(),
    });
  }

  /**
   * Find party by code within a business
   * @param businessId - Business ID
   * @param code - Party code
   * @returns Party or null
   */
  async findByCode(
    businessId: string | Types.ObjectId,
    code: string
  ): Promise<IParty | null> {
    return this.findOne({
      businessId: new Types.ObjectId(businessId.toString()),
      code: code.toUpperCase(),
    });
  }

  /**
   * Get all party codes for a business
   * @param businessId - Business ID
   * @returns Array of party codes
   */
  async getAllCodes(businessId: string | Types.ObjectId): Promise<string[]> {
    const parties = await this.find({
      businessId: new Types.ObjectId(businessId.toString()),
    });
    return parties.map(p => p.code).filter(Boolean);
  }

  /**
   * Add agreement to party
   * @param partyId - Party ID
   * @param agreement - Agreement data
   * @returns Updated party
   */
  async addAgreement(
    partyId: string | Types.ObjectId,
    agreement: IAgreement
  ): Promise<IParty | null> {
    return this.updateById(partyId, {
      $push: { agreements: agreement },
    });
  }

  /**
   * Update agreement status
   * @param partyId - Party ID
   * @param agreementId - Agreement ID
   * @param status - New status
   * @returns Updated party
   */
  async updateAgreementStatus(
    partyId: string | Types.ObjectId,
    agreementId: string,
    status: 'active' | 'expired' | 'terminated'
  ): Promise<IParty | null> {
    return this.updateOne(
      {
        _id: new Types.ObjectId(partyId.toString()),
        'agreements.agreementId': agreementId,
      },
      {
        $set: { 'agreements.$.status': status },
      }
    );
  }

  /**
   * Get active agreement for party
   * @param partyId - Party ID
   * @returns Active agreement or undefined
   */
  async getActiveAgreement(partyId: string | Types.ObjectId): Promise<IAgreement | undefined> {
    const party = await this.findById(partyId);
    return party?.agreements.find(a => a.status === 'active');
  }

  /**
   * Find parties with active agreements
   * @param businessId - Business ID
   * @returns Parties with active agreements
   */
  async findWithActiveAgreements(businessId: string | Types.ObjectId): Promise<IParty[]> {
    return this.find({
      businessId: new Types.ObjectId(businessId.toString()),
      roles: 'client',
      isActive: true,
      'agreements.status': 'active',
    });
  }

  /**
   * Soft delete party (mark as inactive)
   * @param partyId - Party ID
   * @returns Updated party
   */
  async softDelete(partyId: string | Types.ObjectId): Promise<IParty | null> {
    return this.updateById(partyId, { isActive: false });
  }

  /**
   * Find all agreements across all parties in a business
   * @param businessId - Business ID
   * @returns Array of agreements with party info
   */
  async findAllAgreements(
    businessId: string | Types.ObjectId
  ): Promise<Array<{ party: IParty; agreement: IAgreement }>> {
    const parties = await this.find({
      businessId: new Types.ObjectId(businessId.toString()),
      isActive: true,
      'agreements.0': { $exists: true },
    });

    const result: Array<{ party: IParty; agreement: IAgreement }> = [];
    for (const party of parties) {
      for (const agreement of party.agreements) {
        result.push({ party, agreement });
      }
    }
    return result;
  }

  /**
   * Find a specific agreement by ID
   * @param businessId - Business ID
   * @param agreementId - Agreement ID
   * @returns Party and agreement or null
   */
  async findAgreementById(
    businessId: string | Types.ObjectId,
    agreementId: string
  ): Promise<{ party: IParty; agreement: IAgreement } | null> {
    const party = await this.findOne({
      businessId: new Types.ObjectId(businessId.toString()),
      'agreements.agreementId': agreementId,
    });

    if (!party) return null;

    const agreement = party.agreements.find(a => a.agreementId === agreementId);
    if (!agreement) return null;

    return { party, agreement };
  }

  /**
   * Update an agreement
   * @param partyId - Party ID
   * @param agreementId - Agreement ID
   * @param updates - Fields to update
   * @returns Updated party
   */
  async updateAgreement(
    partyId: string | Types.ObjectId,
    agreementId: string,
    updates: {
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
  ): Promise<IParty | null> {
    const updateFields: Record<string, unknown> = {};

    if (updates.startDate) {
      updateFields['agreements.$.startDate'] = updates.startDate;
    }
    if (updates.endDate !== undefined) {
      updateFields['agreements.$.endDate'] = updates.endDate;
    }
    if (updates.status) {
      updateFields['agreements.$.status'] = updates.status;
    }
    if (updates.terms) {
      if (updates.terms.billingCycle) {
        updateFields['agreements.$.terms.billingCycle'] = updates.terms.billingCycle;
      }
      if (updates.terms.paymentDueDays !== undefined) {
        updateFields['agreements.$.terms.paymentDueDays'] = updates.terms.paymentDueDays;
      }
      if (updates.terms.securityDeposit !== undefined) {
        updateFields['agreements.$.terms.securityDeposit'] = updates.terms.securityDeposit;
      }
      if (updates.terms.deliveryCartage !== undefined) {
        updateFields['agreements.$.terms.deliveryCartage'] = updates.terms.deliveryCartage;
      }
      if (updates.terms.returnCartage !== undefined) {
        updateFields['agreements.$.terms.returnCartage'] = updates.terms.returnCartage;
      }
      if (updates.terms.loadingCharge !== undefined) {
        updateFields['agreements.$.terms.loadingCharge'] = updates.terms.loadingCharge;
      }
      if (updates.terms.unloadingCharge !== undefined) {
        updateFields['agreements.$.terms.unloadingCharge'] = updates.terms.unloadingCharge;
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return this.findById(partyId);
    }

    return this.updateOne(
      {
        _id: new Types.ObjectId(partyId.toString()),
        'agreements.agreementId': agreementId,
      },
      { $set: updateFields }
    );
  }

  /**
   * Add a rate to an agreement
   * @param partyId - Party ID
   * @param agreementId - Agreement ID
   * @param rate - Rate to add (itemId and ratePerDay)
   * @returns Updated party
   */
  async addAgreementRate(
    partyId: string | Types.ObjectId,
    agreementId: string,
    rate: IAgreementRate
  ): Promise<IParty | null> {
    return this.updateOne(
      {
        _id: new Types.ObjectId(partyId.toString()),
        'agreements.agreementId': agreementId,
      },
      {
        $push: { 'agreements.$.rates': rate },
      }
    );
  }

  /**
   * Update a rate in an agreement
   * @param partyId - Party ID
   * @param agreementId - Agreement ID
   * @param itemId - Item ID to update
   * @param ratePerDay - New rate per day
   * @returns Updated party
   */
  async updateAgreementRate(
    partyId: string | Types.ObjectId,
    agreementId: string,
    itemId: string | Types.ObjectId,
    ratePerDay: number
  ): Promise<IParty | null> {
    // MongoDB doesn't support updating nested array elements directly with $
    // We need to use arrayFilters
    return this.model.findOneAndUpdate(
      {
        _id: new Types.ObjectId(partyId.toString()),
        'agreements.agreementId': agreementId,
      },
      {
        $set: { 'agreements.$[agr].rates.$[rate].ratePerDay': ratePerDay },
      },
      {
        arrayFilters: [
          { 'agr.agreementId': agreementId },
          { 'rate.itemId': new Types.ObjectId(itemId.toString()) },
        ],
        new: true,
      }
    ).exec();
  }

  /**
   * Get all rates for an agreement
   * @param businessId - Business ID
   * @param agreementId - Agreement ID
   * @returns Agreement rates or null
   */
  async getAgreementRates(
    businessId: string | Types.ObjectId,
    agreementId: string
  ): Promise<IAgreementRate[] | null> {
    const result = await this.findAgreementById(businessId, agreementId);
    if (!result) return null;
    return result.agreement.rates;
  }

  /**
   * Check if an item exists in an agreement's rates
   * @param partyId - Party ID
   * @param agreementId - Agreement ID
   * @param itemId - Item ID to check
   * @returns True if item exists in agreement rates
   */
  async isItemInAgreement(
    partyId: string | Types.ObjectId,
    agreementId: string,
    itemId: string | Types.ObjectId
  ): Promise<boolean> {
    const party = await this.findOne({
      _id: new Types.ObjectId(partyId.toString()),
      'agreements.agreementId': agreementId,
    });

    if (!party) return false;

    const agreement = party.agreements.find(a => a.agreementId === agreementId);
    if (!agreement) return false;

    return agreement.rates.some(r => r.itemId.toString() === itemId.toString());
  }

  /**
   * Add a site to a party
   * @param partyId - Party ID
   * @param site - Site data (code and address)
   * @returns Updated party
   */
  async addSite(
    partyId: string | Types.ObjectId,
    site: ISite
  ): Promise<IParty | null> {
    return this.updateById(partyId, {
      $push: { sites: site },
    });
  }

  /**
   * Update a site within a party by matching siteCode via the positional $ operator
   * @param partyId - Party ID
   * @param siteCode - Current site code to locate the array element
   * @param update - Partial site fields to update
   * @returns Updated party, or null if party/site not found
   */
  async updateSite(
    partyId: string | Types.ObjectId,
    siteCode: string,
    update: Partial<ISite>
  ): Promise<IParty | null> {
    const setFields: Record<string, unknown> = {};
    if (update.code !== undefined) setFields['sites.$.code'] = update.code;
    if (update.address !== undefined) setFields['sites.$.address'] = update.address;
    if (update.stateCode !== undefined) setFields['sites.$.stateCode'] = update.stateCode;

    if (Object.keys(setFields).length === 0) return null;

    return this.updateOne(
      { _id: new Types.ObjectId(partyId.toString()), 'sites.code': siteCode },
      { $set: setFields }
    );
  }
}

export default PartyRepository;
