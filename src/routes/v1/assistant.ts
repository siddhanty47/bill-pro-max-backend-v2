/**
 * @file Assistant routes
 * @description Business-scoped routes for the conversational AI assistant.
 * Base gate: authenticated + business member with read access. Finer-grained
 * authorization is enforced per-tool inside the agent loop (each tool declares
 * its own action/resource permission).
 */

import { Router } from 'express';
import multer from 'multer';
import { AssistantController } from '../../controllers';
import { authenticate, validateBusinessAccess, requirePermission } from '../../middleware';

const router = Router({ mergeParams: true });
const controller = new AssistantController();

// In-memory uploads — image attachments (vision / challan photos) and voice audio.
// Bytes are used for the current turn only and never persisted.
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, cb) => cb(null, IMAGE_MIMES.includes(file.mimetype)),
});

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // Whisper's per-file ceiling.
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('audio/')),
});

// All assistant routes require auth + business membership.
router.use(authenticate, validateBusinessAccess);

/** POST /businesses/:businessId/assistant/chat — send a message (+ optional images), drive the agent. */
router.post('/chat', requirePermission('read', 'business'), imageUpload.array('images', 4), controller.chat);

/** POST /businesses/:businessId/assistant/transcribe — voice note → text (Whisper). */
router.post('/transcribe', requirePermission('read', 'business'), audioUpload.single('audio'), controller.transcribe);

/** POST /businesses/:businessId/assistant/confirm — approve/decline a pending write. */
router.post('/confirm', requirePermission('read', 'business'), controller.confirm);

/** GET /businesses/:businessId/assistant/conversations — list the user's conversations. */
router.get('/conversations', requirePermission('read', 'business'), controller.listConversations);

/** GET /businesses/:businessId/assistant/conversations/:conversationId — full history. */
router.get('/conversations/:conversationId', requirePermission('read', 'business'), controller.getConversation);

export default router;
