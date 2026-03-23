/**
 * @file Auth routes
 * @description Routes for authentication-related operations (user sync).
 */

import { Router } from 'express';
import { AuthController } from '../../controllers/AuthController';
import { authenticate } from '../../middleware';

const router = Router();
const authController = new AuthController();

/**
 * POST /auth/sync
 * Sync user data from Supabase JWT into MongoDB.
 * Called by the frontend after every OIDC login/signup.
 */
router.post('/sync', authenticate, authController.syncUser);

export default router;
