/**
 * @file Attendance model
 * @description Mongoose schema for employee daily attendance records.
 * One record per employee per day in a separate collection.
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/**
 * Attendance status
 */
export type AttendanceStatus = 'present' | 'absent' | 'half-day' | 'leave';

/**
 * Attendance document interface
 */
export interface IAttendance extends Document {
  businessId: Types.ObjectId;
  employeeId: Types.ObjectId;
  date: Date;
  status: AttendanceStatus;
  overtimeHours?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Attendance schema
 */
const AttendanceSchema = new Schema<IAttendance>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: [true, 'Business ID is required'],
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Employee ID is required'],
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'half-day', 'leave'],
      required: [true, 'Status is required'],
    },
    overtimeHours: {
      type: Number,
      min: [0, 'Overtime hours cannot be negative'],
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// One record per employee per day
AttendanceSchema.index({ businessId: 1, employeeId: 1, date: 1 }, { unique: true });
// Range queries
AttendanceSchema.index({ businessId: 1, employeeId: 1, date: -1 });

export const Attendance: Model<IAttendance> = mongoose.model<IAttendance>(
  'Attendance',
  AttendanceSchema
);
