/**
 * @file Member routes
 * @description Routes for business member management (list, update role, remove).
 * All routes are nested under /businesses/:businessId/members
 * and require authentication + business scope validation.
 */

import { Router } from 'express';
import { MemberController } from '../../controllers/MemberController';
import { authenticate, validateBusinessAccess } from '../../middleware';

const router = Router({ mergeParams: true });
const memberController = new MemberController();

router.use(authenticate, validateBusinessAccess);

/** GET /businesses/:businessId/members */
router.get('/', memberController.getMembers);

/** PATCH /businesses/:businessId/members/:memberId */
router.patch('/:memberId', memberController.updateMemberRole);

/** DELETE /businesses/:businessId/members/:memberId */
router.delete('/:memberId', memberController.removeMember);

export default router;
