/**
 * @file Main routes index
 * @description Combines all API routes for the application
 */

import { Router } from 'express';
import v1Routes from './v1';

const router = Router();

// API v1 routes
router.use('/', v1Routes);

export default router;
