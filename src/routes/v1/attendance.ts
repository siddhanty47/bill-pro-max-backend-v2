/**
 * @file Attendance routes
 * @description API routes for employee attendance tracking
 * Nested under: /businesses/:businessId/employees/:employeeId/attendance
 */

import { Router } from 'express';
import { AttendanceController } from '../../controllers';
import { authenticate, validateBusinessAccess, validateBody, validateQuery, requirePermission } from '../../middleware';
import { markAttendanceSchema, attendanceQuerySchema, attendanceSummaryQuerySchema, salaryBreakdownQuerySchema } from '../../types/api';

const router = Router({ mergeParams: true });
const attendanceController = new AttendanceController();

router.use(authenticate, validateBusinessAccess);

/**
 * GET /businesses/:businessId/employees/:employeeId/attendance
 * Query: startDate, endDate
 */
router.get(
  '/',
  requirePermission('read', 'user'),
  validateQuery(attendanceQuerySchema),
  attendanceController.getAttendance
);

/**
 * GET /businesses/:businessId/employees/:employeeId/attendance/summary
 * Query: month, year
 */
router.get(
  '/summary',
  requirePermission('read', 'user'),
  validateQuery(attendanceSummaryQuerySchema),
  attendanceController.getMonthSummary
);

/**
 * GET /businesses/:businessId/employees/:employeeId/attendance/salary-breakdown
 * Query: month, year
 */
router.get(
  '/salary-breakdown',
  requirePermission('read', 'user'),
  validateQuery(salaryBreakdownQuerySchema),
  attendanceController.getSalaryBreakdown
);

/**
 * POST /businesses/:businessId/employees/:employeeId/attendance
 * Body: { date, status, notes?, overtimeHours? }
 */
router.post(
  '/',
  requirePermission('update', 'user'),
  validateBody(markAttendanceSchema),
  attendanceController.markAttendance
);

/**
 * DELETE /businesses/:businessId/employees/:employeeId/attendance/:date
 */
router.delete(
  '/:date',
  requirePermission('update', 'user'),
  attendanceController.deleteAttendance
);

export default router;
