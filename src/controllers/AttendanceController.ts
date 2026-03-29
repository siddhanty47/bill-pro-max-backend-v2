/**
 * @file Attendance Controller
 * @description HTTP request handlers for employee attendance
 */

import { Request, Response, NextFunction } from 'express';
import { AttendanceService } from '../services/AttendanceService';
import { AuditPerformer } from '../types/api';
import { AuthenticatedRequest } from '../middleware';

/**
 * Attendance Controller class
 */
export class AttendanceController {
  private attendanceService: AttendanceService;

  constructor() {
    this.attendanceService = new AttendanceService();
  }

  /**
   * GET /businesses/:businessId/employees/:employeeId/attendance
   * Query: startDate, endDate
   */
  getAttendance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, employeeId } = req.params;
      const { startDate, endDate } = req.query;

      const records = await this.attendanceService.getAttendance(
        businessId,
        employeeId,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.status(200).json({
        success: true,
        data: records,
        message: 'Attendance records retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /businesses/:businessId/employees/:employeeId/attendance/summary
   * Query: month, year
   */
  getMonthSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, employeeId } = req.params;
      const month = parseInt(req.query.month as string, 10);
      const year = parseInt(req.query.year as string, 10);

      const summary = await this.attendanceService.getMonthSummary(
        businessId,
        employeeId,
        month,
        year
      );

      res.status(200).json({
        success: true,
        data: summary,
        message: 'Attendance summary retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /businesses/:businessId/employees/:employeeId/attendance
   * Body: { date, status, notes? }
   */
  markAttendance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, employeeId } = req.params;
      const authReq = req as AuthenticatedRequest;
      const performer: AuditPerformer = { userId: authReq.user.id, name: authReq.user.name };

      const { date, status, notes, overtimeHours } = req.body;

      const record = await this.attendanceService.markAttendance(
        businessId,
        employeeId,
        new Date(date),
        status,
        notes,
        overtimeHours,
        performer
      );

      res.status(200).json({
        success: true,
        data: record,
        message: 'Attendance marked successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /businesses/:businessId/employees/:employeeId/attendance/salary-breakdown
   * Query: month, year
   */
  getSalaryBreakdown = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, employeeId } = req.params;
      const month = parseInt(req.query.month as string, 10);
      const year = parseInt(req.query.year as string, 10);

      const breakdown = await this.attendanceService.getSalaryBreakdown(
        businessId,
        employeeId,
        month,
        year
      );

      res.status(200).json({
        success: true,
        data: breakdown,
        message: 'Salary breakdown retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /businesses/:businessId/employees/:employeeId/attendance/:date
   */
  deleteAttendance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, employeeId, date } = req.params;
      const authReq = req as AuthenticatedRequest;
      const performer: AuditPerformer = { userId: authReq.user.id, name: authReq.user.name };

      const record = await this.attendanceService.deleteAttendance(
        businessId,
        employeeId,
        new Date(date),
        performer
      );

      res.status(200).json({
        success: true,
        data: record,
        message: 'Attendance record deleted successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}

export default AttendanceController;
