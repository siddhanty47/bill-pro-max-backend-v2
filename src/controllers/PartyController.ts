/**
 * @file Party Controller
 * @description HTTP request handlers for party management
 */

import { Request, Response, NextFunction } from 'express';
import { PartyService } from '../services';
import { BusinessScopedRequest } from '../middleware';
import { paginationSchema } from '../types/api';
import { logger } from '../utils/logger';

/**
 * Party Controller class
 */
export class PartyController {
  private partyService: PartyService;

  constructor() {
    this.partyService = new PartyService();
  }

  /**
   * Get all parties
   */
  getParties = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;
      const pagination = paginationSchema.parse(req.query);
      const { role, search } = req.query;

      const result = await this.partyService.getParties(
        businessId,
        {
          role: role as 'client' | 'supplier' | undefined,
          search: search as string | undefined,
          isActive: true,
        },
        pagination
      );

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        message: 'Parties retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get party by ID
   */
  getPartyById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, id } = req.params;

      const party = await this.partyService.getPartyById(businessId, id);

      res.status(200).json({
        success: true,
        data: party,
        message: 'Party retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create a party
   */
  createParty = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;

      const party = await this.partyService.createParty(businessId, req.body);

      res.status(201).json({
        success: true,
        data: party,
        message: 'Party created successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update a party
   */
  updateParty = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, id } = req.params;

      const party = await this.partyService.updateParty(businessId, id, req.body);

      res.status(200).json({
        success: true,
        data: party,
        message: 'Party updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete a party
   */
  deleteParty = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, id } = req.params;

      await this.partyService.deleteParty(businessId, id);

      res.status(200).json({
        success: true,
        message: 'Party deleted successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create agreement for a party
   */
  createAgreement = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, id } = req.params;

      const party = await this.partyService.createAgreement(businessId, id, req.body);

      res.status(201).json({
        success: true,
        data: party,
        message: 'Agreement created successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all agreements for a business
   */
  getAllAgreements = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;

      const agreements = await this.partyService.getAllAgreements(businessId);

      res.status(200).json({
        success: true,
        data: agreements,
        message: 'Agreements retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get a specific agreement by ID
   */
  getAgreementById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, agreementId } = req.params;

      const agreement = await this.partyService.getAgreementById(businessId, agreementId);

      res.status(200).json({
        success: true,
        data: agreement,
        message: 'Agreement retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update an agreement
   */
  updateAgreement = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, agreementId } = req.params;

      const agreement = await this.partyService.updateAgreement(businessId, agreementId, req.body);

      res.status(200).json({
        success: true,
        data: agreement,
        message: 'Agreement updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Generate a party code for a given name
   */
  generateCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;
      const { name } = req.query;

      if (!name || typeof name !== 'string') {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Name query parameter is required' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const code = await this.partyService.generatePartyCodeForName(businessId, name);

      res.status(200).json({
        success: true,
        data: { code },
        message: 'Code generated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Check if a party code exists
   */
  checkCodeExists = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;
      const { code } = req.query;

      if (!code || typeof code !== 'string') {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Code query parameter is required' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const exists = await this.partyService.checkPartyCodeExists(businessId, code);

      res.status(200).json({
        success: true,
        data: { exists },
        message: 'Code check completed',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all rates/items for an agreement
   */
  getAgreementRates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, agreementId } = req.params;

      const rates = await this.partyService.getAgreementItems(businessId, agreementId);

      res.status(200).json({
        success: true,
        data: rates,
        message: 'Agreement rates retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Add an item/rate to an agreement
   */
  addAgreementRate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, agreementId } = req.params;
      const { itemId, ratePerDay } = req.body;

      const agreement = await this.partyService.addItemToAgreement(
        businessId,
        agreementId,
        itemId,
        ratePerDay
      );

      res.status(201).json({
        success: true,
        data: agreement,
        message: 'Item added to agreement successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update a rate in an agreement
   */
  updateAgreementRate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, agreementId, itemId } = req.params;
      const { ratePerDay } = req.body;

      const agreement = await this.partyService.updateAgreementRate(
        businessId,
        agreementId,
        itemId,
        ratePerDay
      );

      res.status(200).json({
        success: true,
        data: agreement,
        message: 'Agreement rate updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Add a site to a party
   */
  addSite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, id } = req.params;

      const party = await this.partyService.addSiteToParty(businessId, id, req.body);

      res.status(201).json({
        success: true,
        data: party,
        message: 'Site added successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update an existing site on a party
   */
  updateSite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, id, siteCode } = req.params;

      const party = await this.partyService.updateSite(businessId, id, siteCode, req.body);

      res.status(200).json({
        success: true,
        data: party,
        message: 'Site updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}

export default PartyController;
