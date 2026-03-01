/**
 * @file Employee routes
 * @description API routes for employee (transporter, worker, etc.) management
 */

import { Router } from 'express';
import { EmployeeController } from '../../controllers';
import { authenticate, validateBusinessAccess, validateBody, requirePermission } from '../../middleware';
import { createEmployeeSchema, updateEmployeeSchema } from '../../types/api';

const router = Router({ mergeParams: true });
const employeeController = new EmployeeController();

router.use(authenticate, validateBusinessAccess);

/**
 * GET /businesses/:businessId/employees
 * List employees (query: type, isActive, pagination)
 */
router.get(
  '/',
  requirePermission('read', 'user'),
  employeeController.getEmployees
);

/**
 * POST /businesses/:businessId/employees
 * Create a new employee
 */
router.post(
  '/',
  requirePermission('create', 'user'),
  validateBody(createEmployeeSchema),
  employeeController.createEmployee
);

/**
 * GET /businesses/:businessId/employees/:id
 * Get a specific employee
 */
router.get(
  '/:id',
  requirePermission('read', 'user'),
  employeeController.getEmployeeById
);

/**
 * PATCH /businesses/:businessId/employees/:id
 * Update an employee
 */
router.patch(
  '/:id',
  requirePermission('update', 'user'),
  validateBody(updateEmployeeSchema),
  employeeController.updateEmployee
);

/**
 * DELETE /businesses/:businessId/employees/:id
 * Soft delete an employee
 */
router.delete(
  '/:id',
  requirePermission('delete', 'user'),
  employeeController.deleteEmployee
);

export default router;
