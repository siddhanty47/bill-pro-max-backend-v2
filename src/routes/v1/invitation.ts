/**
 * @file Invitation routes
 * @description Routes for invitation management.
 * Business-scoped routes (create, list, update, cancel) are mounted under /businesses/:businessId/invitations.
 * Public/authenticated routes (verify, accept, decline) are mounted at /invitations.
 */

import { Router } from 'express';
import { InvitationController } from '../../controllers/InvitationController';
import { authenticate, authenticateOptional, validateBusinessAccess } from '../../middleware';

const invitationController = new InvitationController();

/**
 * Business-scoped invitation routes.
 * Mounted at: /businesses/:businessId/invitations
 */
export const businessInvitationRouter = Router({ mergeParams: true });
businessInvitationRouter.use(authenticate, validateBusinessAccess);

businessInvitationRouter.post('/', invitationController.createInvitation);
businessInvitationRouter.get('/', invitationController.getInvitations);
businessInvitationRouter.patch('/:id', invitationController.updateInvitationRole);
businessInvitationRouter.delete('/:id', invitationController.cancelInvitation);
businessInvitationRouter.post('/:id/resend', invitationController.resendInvitation);

/**
 * Standalone invitation routes (not business-scoped).
 * Mounted at: /invitations
 */
export const standaloneInvitationRouter = Router();

standaloneInvitationRouter.get('/verify/:token', invitationController.verifyInvitation);
standaloneInvitationRouter.post('/:token/accept', authenticate, invitationController.acceptInvitation);
standaloneInvitationRouter.post('/:token/decline', authenticate, invitationController.declineInvitation);
