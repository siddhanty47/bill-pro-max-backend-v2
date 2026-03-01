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
import authRoutes from './auth';
import memberRoutes from './member';
import { businessInvitationRouter, standaloneInvitationRouter } from './invitation';
import notificationRoutes from './notification';
import employeeRoutes from './employee';

const router = Router();

// Auth routes (user sync after OIDC login)
router.use('/auth', authRoutes);

// Standalone routes (no business scope)
router.use('/gstin', standaloneGstinRouter);
router.use('/invitations', standaloneInvitationRouter);
router.use('/notifications', notificationRoutes);

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
router.use('/businesses/:businessId/members', memberRoutes);
router.use('/businesses/:businessId/invitations', businessInvitationRouter);
router.use('/businesses/:businessId/employees', employeeRoutes);

export default router;
