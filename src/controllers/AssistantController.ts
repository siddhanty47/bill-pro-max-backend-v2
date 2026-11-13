/**
 * @file AssistantController
 * @description HTTP entry for the conversational AI assistant. Thin: builds the
 * run context from the authenticated, business-scoped request and delegates to
 * AssistantService. Live tokens stream over WebSocket; the HTTP response carries
 * the final result (completed message / awaiting-confirmation / error) for the
 * client cache.
 */

import { Request, Response, NextFunction } from 'express';
import { AssistantService, AssistantRunContext } from '../services/AssistantService';
import { BusinessService } from '../services';
import { getBusinessId, BusinessScopedUser } from '../middleware/businessScope';
import { getAuthenticatedUser } from '../middleware/businessScope';
import { Conversation } from '../models/Conversation';
import { Types } from 'mongoose';
import { ValidationError, NotFoundError } from '../middleware';
import { logger } from '../utils/logger';

export class AssistantController {
  private assistantService: AssistantService;
  private businessService: BusinessService;

  constructor() {
    this.assistantService = new AssistantService();
    this.businessService = new BusinessService();
  }

  private async buildContext(req: Request): Promise<AssistantRunContext> {
    const businessId = getBusinessId(req);
    const user = getAuthenticatedUser(req) as BusinessScopedUser;
    let businessName: string | undefined;
    try {
      const business = await this.businessService.getBusinessById(businessId);
      businessName = business?.name;
    } catch {
      /* name is best-effort context */
    }
    return { businessId, businessName, user };
  }

  /** POST /businesses/:businessId/assistant/chat */
  chat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { message, conversationId } = req.body as { message?: string; conversationId?: string };
      if (!message || !message.trim()) {
        throw new ValidationError('message is required.');
      }
      const ctx = await this.buildContext(req);
      logger.info('Assistant chat request', { businessId: ctx.businessId, userId: ctx.user.id, conversationId });

      const result = await this.assistantService.sendMessage(ctx, conversationId, message.trim());
      res.status(200).json({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (error) {
      next(error);
    }
  };

  /** POST /businesses/:businessId/assistant/confirm */
  confirm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { conversationId, approve } = req.body as { conversationId?: string; approve?: boolean };
      if (!conversationId) throw new ValidationError('conversationId is required.');
      if (typeof approve !== 'boolean') throw new ValidationError('approve (boolean) is required.');
      const ctx = await this.buildContext(req);

      const result = await this.assistantService.confirmAction(ctx, conversationId, approve);
      res.status(200).json({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (error) {
      next(error);
    }
  };

  /** GET /businesses/:businessId/assistant/conversations */
  listConversations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const businessId = getBusinessId(req);
      const user = getAuthenticatedUser(req) as BusinessScopedUser;
      const conversations = await Conversation.find(
        { businessId: new Types.ObjectId(businessId), userId: user.id },
        { title: 1, updatedAt: 1, createdAt: 1 }
      )
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean();
      res.status(200).json({ success: true, data: conversations, timestamp: new Date().toISOString() });
    } catch (error) {
      next(error);
    }
  };

  /** GET /businesses/:businessId/assistant/conversations/:conversationId */
  getConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const businessId = getBusinessId(req);
      const user = getAuthenticatedUser(req) as BusinessScopedUser;
      const { conversationId } = req.params;
      if (!Types.ObjectId.isValid(conversationId)) throw new NotFoundError('Conversation');
      const convo = await Conversation.findOne({
        _id: conversationId,
        businessId: new Types.ObjectId(businessId),
        userId: user.id,
      }).lean();
      if (!convo) throw new NotFoundError('Conversation');
      res.status(200).json({ success: true, data: convo, timestamp: new Date().toISOString() });
    } catch (error) {
      next(error);
    }
  };
}
