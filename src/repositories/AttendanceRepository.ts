/**
 * @file Attendance Repository
 * @description Repository for employee attendance records
 */

import { Types } from 'mongoose';
import { BaseRepository } from './BaseRepository';
import { Attendance, IAttendance } from '../models/Attendance';

/**
 * Attendance repository class
 */
export class AttendanceRepository extends BaseRepository<IAttendance> {
  constructor() {
    super(Attendance);
  }

  /**
   * Find attendance records for an employee within a date range
   */
  async findByEmployeeAndDateRange(
    businessId: string | Types.ObjectId,
    employeeId: string | Types.ObjectId,
    startDate: Date,
    endDate: Date
  ): Promise<IAttendance[]> {
    return this.find(
      {
        businessId: new Types.ObjectId(businessId.toString()),
        employeeId: new Types.ObjectId(employeeId.toString()),
        date: { $gte: startDate, $lte: endDate },
      },
      undefined,
      { sort: { date: 1 } }
    );
  }

  /**
   * Find a single attendance record for an employee on a specific date
   */
  async findByDate(
    businessId: string | Types.ObjectId,
    employeeId: string | Types.ObjectId,
    date: Date
  ): Promise<IAttendance | null> {
    return this.findOne({
      businessId: new Types.ObjectId(businessId.toString()),
      employeeId: new Types.ObjectId(employeeId.toString()),
      date,
    });
  }

  /**
   * Upsert attendance for a specific date (create or update)
   */
  async upsertAttendance(
    businessId: string | Types.ObjectId,
    employeeId: string | Types.ObjectId,
    date: Date,
    status: string,
    notes?: string,
    overtimeHours?: number
  ): Promise<IAttendance> {
    const filter = {
      businessId: new Types.ObjectId(businessId.toString()),
      employeeId: new Types.ObjectId(employeeId.toString()),
      date,
    };

    const update: Record<string, unknown> = { status };
    if (notes !== undefined) {
      update.notes = notes;
    }
    if (overtimeHours !== undefined) {
      update.overtimeHours = overtimeHours;
    }

    const result = await Attendance.findOneAndUpdate(
      filter,
      { $set: update, $setOnInsert: filter },
      { upsert: true, new: true, runValidators: true }
    );

    return result;
  }

  /**
   * Delete attendance record for a specific date
   */
  async deleteByDate(
    businessId: string | Types.ObjectId,
    employeeId: string | Types.ObjectId,
    date: Date
  ): Promise<IAttendance | null> {
    return Attendance.findOneAndDelete({
      businessId: new Types.ObjectId(businessId.toString()),
      employeeId: new Types.ObjectId(employeeId.toString()),
      date,
    });
  }
}

export default AttendanceRepository;
