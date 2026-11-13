/**
 * @file Assistant routes
 * @description Business-scoped routes for the conversational AI assistant.
 * Base gate: authenticated + business member with read access. Finer-grained
 * authorization is enforced per-tool inside the agent loop (each tool declares
 * its own action/resource permission).
 */

import { Router } from 'express';
import { AssistantController } from '../../controllers';
import { authenticate, validateBusinessAccess, requirePermission } from '../../middleware';

const router = Router({ mergeParams: true });
const controller = new AssistantController();

// All assistant routes require auth + business membership.
router.use(authenticate, validateBusinessAccess);

/** POST /businesses/:businessId/assistant/chat — send a message, drive the agent. */
router.post('/chat', requirePermission('read', 'business'), controller.chat);

/** POST /businesses/:businessId/assistant/confirm — approve/decline a pending write. */
router.post('/confirm', requirePermission('read', 'business'), controller.confirm);

/** GET /businesses/:businessId/assistant/conversations — list the user's conversations. */
router.get('/conversations', requirePermission('read', 'business'), controller.listConversations);

/** GET /businesses/:businessId/assistant/conversations/:conversationId — full history. */
router.get('/conversations/:conversationId', requirePermission('read', 'business'), controller.getConversation);

export default router;
