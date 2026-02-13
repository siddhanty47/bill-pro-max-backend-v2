/**
 * @file API v1 routes index
 * @description Combines all v1 API routes
 */

import { Router } from 'express';
import businessRoutes from './business';
import partyRoutes from './party';
import inventoryRoutes from './inventory';
import challanRoutes from './challan';
import billRoutes from './bill';
import paymentRoutes from './payment';
import reportRoutes from './report';
import agreementRoutes from './agreement';
import gstinRoutes, { standaloneGstinRouter } from './gstin';

const router = Router();

// Standalone GSTIN lookup (auth-only, no business scope — for business creation)
router.use('/gstin', standaloneGstinRouter);

// Business routes
router.use('/businesses', businessRoutes);

// Nested routes under business
router.use('/businesses/:businessId/parties', partyRoutes);
router.use('/businesses/:businessId/inventory', inventoryRoutes);
router.use('/businesses/:businessId/challans', challanRoutes);
router.use('/businesses/:businessId/bills', billRoutes);
router.use('/businesses/:businessId/payments', paymentRoutes);
router.use('/businesses/:businessId/reports', reportRoutes);
router.use('/businesses/:businessId/agreements', agreementRoutes);
router.use('/businesses/:businessId/gstin', gstinRoutes);

export default router;
