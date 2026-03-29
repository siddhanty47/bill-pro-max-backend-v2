/**
 * @file Attendance Service
 * @description Business logic for employee attendance tracking.
 * Non-marked weekdays (Mon-Sat) count as implicit present.
 * Sundays default as leave unless explicitly marked.
 * Sundays marked present add to effectiveDays (overtime day).
 */

import { AttendanceRepository } from '../repositories';
import { IAttendance, AttendanceStatus } from '../models/Attendance';
import { EmployeeRepository } from '../repositories';
import { IEmployee } from '../models';
import { NotFoundError } from '../middleware';
import { logger } from '../utils/logger';
import { AuditLogService } from './AuditLogService';
import { AuditPerformer } from '../types/api';

/**
 * Month summary result
 */
export interface AttendanceMonthSummary {
  present: number;
  absent: number;
  halfDay: number;
  leave: number;
  totalDays: number;
  workingDays: number;
  effectiveDays: number;
  overtimeHours: number;
  sundaysWorked: number;
}

/**
 * Salary breakdown result
 */
export interface SalaryBreakdown {
  month: number;
  year: number;
  workingDays: number;
  effectiveDays: number;
  overtimeHours: number;
  sundaysWorked: number;
  salaryType: 'monthly' | 'daily' | null;
  monthlySalary: number;
  dailyRate: number;
  overtimeRatePerHour: number;
  baseSalary: number;
  overtimePay: number;
  totalPay: number;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Attendance Service class
 */
export class AttendanceService {
  private attendanceRepository: AttendanceRepository;
  private employeeRepository: EmployeeRepository;
  private auditLogService: AuditLogService;

  constructor() {
    this.attendanceRepository = new AttendanceRepository();
    this.employeeRepository = new EmployeeRepository();
    this.auditLogService = new AuditLogService();
  }

  /**
   * Get attendance records for an employee within a date range
   */
  async getAttendance(
    businessId: string,
    employeeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<IAttendance[]> {
    await this.validateEmployee(businessId, employeeId);
    return this.attendanceRepository.findByEmployeeAndDateRange(
      businessId,
      employeeId,
      startDate,
      endDate
    );
  }

  /**
   * Mark attendance for a specific date (upsert)
   */
  async markAttendance(
    businessId: string,
    employeeId: string,
    date: Date,
    status: AttendanceStatus,
    notes?: string,
    overtimeHours?: number,
    performer?: AuditPerformer
  ): Promise<IAttendance> {
    await this.validateEmployee(businessId, employeeId);

    const existing = await this.attendanceRepository.findByDate(businessId, employeeId, date);
    const isUpdate = !!existing;

    const record = await this.attendanceRepository.upsertAttendance(
      businessId,
      employeeId,
      date,
      status,
      notes,
      overtimeHours
    );

    logger.info('Attendance marked', {
      businessId,
      employeeId,
      date: date.toISOString(),
      status,
      overtimeHours,
      action: isUpdate ? 'updated' : 'created',
    });

    if (performer) {
      if (isUpdate) {
        const changes = [];
        if (existing!.status !== status) {
          changes.push({ field: 'status', oldValue: existing!.status, newValue: status });
        }
        if (existing!.notes !== (notes ?? existing!.notes)) {
          changes.push({ field: 'notes', oldValue: existing!.notes ?? '', newValue: notes ?? '' });
        }
        const oldOT = existing!.overtimeHours ?? 0;
        const newOT = overtimeHours ?? oldOT;
        if (oldOT !== newOT) {
          changes.push({ field: 'overtimeHours', oldValue: oldOT, newValue: newOT });
        }
        if (changes.length > 0) {
          this.auditLogService.logChange({
            businessId,
            documentId: record._id.toString(),
            documentType: 'attendance',
            action: 'updated',
            changes,
            performedBy: performer,
          });
        }
      } else {
        this.auditLogService.logChange({
          businessId,
          documentId: record._id.toString(),
          documentType: 'attendance',
          action: 'created',
          changes: [],
          performedBy: performer,
        });
      }
    }

    return record;
  }

  /**
   * Delete attendance record for a specific date
   */
  async deleteAttendance(
    businessId: string,
    employeeId: string,
    date: Date,
    performer?: AuditPerformer
  ): Promise<IAttendance> {
    await this.validateEmployee(businessId, employeeId);

    const deleted = await this.attendanceRepository.deleteByDate(businessId, employeeId, date);
    if (!deleted) {
      throw new NotFoundError('Attendance record');
    }

    logger.info('Attendance deleted', {
      businessId,
      employeeId,
      date: date.toISOString(),
    });

    if (performer) {
      this.auditLogService.logChange({
        businessId,
        documentId: deleted._id.toString(),
        documentType: 'attendance',
        action: 'deleted',
        changes: [],
        performedBy: performer,
      });
    }

    return deleted;
  }

  /**
   * Get month summary for an employee.
   * Non-marked weekdays (Mon-Sat) up to today count as implicit present.
   * Sundays default as leave unless explicitly marked.
   */
  async getMonthSummary(
    businessId: string,
    employeeId: string,
    month: number,
    year: number
  ): Promise<AttendanceMonthSummary> {
    await this.validateEmployee(businessId, employeeId);

    const startDate = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Only count up to today for current/future months
    const endDate = lastDayOfMonth <= today ? lastDayOfMonth : today;

    const records = await this.attendanceRepository.findByEmployeeAndDateRange(
      businessId,
      employeeId,
      startDate,
      lastDayOfMonth
    );

    // Build map of dateKey -> record
    const recordMap = new Map<string, IAttendance>();
    for (const record of records) {
      recordMap.set(toDateKey(record.date), record);
    }

    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let leave = 0;
    let workingDays = 0;
    let effectiveDays = 0;
    let overtimeHours = 0;
    let sundaysWorked = 0;
    const totalDays = lastDayOfMonth.getDate();

    // Enumerate each day from start to endDate
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const key = toDateKey(d);
      const record = recordMap.get(key);
      const isSunday = d.getDay() === 0;

      if (isSunday) {
        // Sunday logic
        if (!record) {
          // Implicit leave
          leave++;
        } else {
          const ot = record.overtimeHours ?? 0;
          overtimeHours += ot;
          switch (record.status) {
            case 'present':
              sundaysWorked++;
              effectiveDays++;
              present++;
              break;
            case 'half-day':
              halfDay++;
              effectiveDays += 0.5;
              break;
            case 'absent':
              absent++;
              break;
            case 'leave':
              leave++;
              break;
          }
        }
      } else {
        // Weekday (Mon-Sat)
        workingDays++;
        if (!record) {
          // Implicit present
          present++;
          effectiveDays++;
        } else {
          const ot = record.overtimeHours ?? 0;
          overtimeHours += ot;
          switch (record.status) {
            case 'present':
              present++;
              effectiveDays++;
              break;
            case 'half-day':
              halfDay++;
              effectiveDays += 0.5;
              break;
            case 'absent':
              absent++;
              break;
            case 'leave':
              leave++;
              break;
          }
        }
      }
    }

    return {
      present,
      absent,
      halfDay,
      leave,
      totalDays,
      workingDays,
      effectiveDays,
      overtimeHours,
      sundaysWorked,
    };
  }

  /**
   * Get salary breakdown for a month
   */
  async getSalaryBreakdown(
    businessId: string,
    employeeId: string,
    month: number,
    year: number
  ): Promise<SalaryBreakdown> {
    const employee = await this.getEmployee(businessId, employeeId);
    const summary = await this.getMonthSummary(businessId, employeeId, month, year);

    const salaryType = employee.salaryType ?? null;
    const monthlySalary = employee.monthlySalary ?? 0;
    const dailyRate = employee.dailyRate ?? 0;
    const overtimeRatePerHour = employee.overtimeRatePerHour ?? 0;

    let baseSalary = 0;
    if (salaryType === 'monthly' && summary.workingDays > 0) {
      // Prorated: (effectiveDays / workingDays) * monthlySalary
      baseSalary = (summary.effectiveDays / summary.workingDays) * monthlySalary;
    } else if (salaryType === 'daily') {
      baseSalary = summary.effectiveDays * dailyRate;
    }

    const overtimePay = summary.overtimeHours * overtimeRatePerHour;
    const totalPay = baseSalary + overtimePay;

    return {
      month,
      year,
      workingDays: summary.workingDays,
      effectiveDays: summary.effectiveDays,
      overtimeHours: summary.overtimeHours,
      sundaysWorked: summary.sundaysWorked,
      salaryType,
      monthlySalary,
      dailyRate,
      overtimeRatePerHour,
      baseSalary: Math.round(baseSalary * 100) / 100,
      overtimePay: Math.round(overtimePay * 100) / 100,
      totalPay: Math.round(totalPay * 100) / 100,
    };
  }

  /**
   * Validate that the employee exists in the business
   */
  private async validateEmployee(businessId: string, employeeId: string): Promise<void> {
    const employee = await this.employeeRepository.findByIdInBusiness(businessId, employeeId);
    if (!employee) {
      throw new NotFoundError('Employee');
    }
  }

  /**
   * Get employee (throws if not found)
   */
  private async getEmployee(businessId: string, employeeId: string): Promise<IEmployee> {
    const employee = await this.employeeRepository.findByIdInBusiness(businessId, employeeId);
    if (!employee) {
      throw new NotFoundError('Employee');
    }
    return employee;
  }
}

export default AttendanceService;
