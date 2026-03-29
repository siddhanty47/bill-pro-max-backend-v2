/**
 * @file Employee Service
 * @description Business logic for employee management
 */

import { Types } from 'mongoose';
import { EmployeeRepository, EmployeeFilterOptions, PaginationOptions, PaginatedResult } from '../repositories';
import { IEmployee, EmployeeType, ITransporterDetails, IEmergencyContact, SalaryType } from '../models';
import { NotFoundError, ValidationError, ConflictError } from '../middleware';
import { logger } from '../utils/logger';
import { AuditLogService } from './AuditLogService';
import { AuditPerformer } from '../types/api';

/**
 * Create employee input
 */
export interface CreateEmployeeInput {
  name: string;
  phone?: string;
  type: EmployeeType;
  details?: ITransporterDetails;
  designation?: string;
  address?: string;
  joiningDate?: Date;
  salaryType?: SalaryType;
  monthlySalary?: number;
  dailyRate?: number;
  overtimeRatePerHour?: number;
  emergencyContact?: IEmergencyContact;
  notes?: string;
}

/**
 * Update employee input
 */
export interface UpdateEmployeeInput {
  name?: string;
  phone?: string;
  details?: Partial<ITransporterDetails>;
  designation?: string;
  address?: string;
  joiningDate?: Date;
  salaryType?: SalaryType;
  monthlySalary?: number;
  dailyRate?: number;
  overtimeRatePerHour?: number;
  emergencyContact?: Partial<IEmergencyContact>;
  notes?: string;
}

/**
 * Employee Service class
 */
export class EmployeeService {
  private employeeRepository: EmployeeRepository;
  private auditLogService: AuditLogService;

  constructor() {
    this.employeeRepository = new EmployeeRepository();
    this.auditLogService = new AuditLogService();
  }

  /**
   * Get employees for a business
   */
  async getEmployees(
    businessId: string,
    filters: EmployeeFilterOptions = {},
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<IEmployee>> {
    return this.employeeRepository.findByBusiness(businessId, filters, pagination);
  }

  /**
   * Get employee by ID
   */
  async getEmployeeById(businessId: string, employeeId: string): Promise<IEmployee> {
    const employee = await this.employeeRepository.findByIdInBusiness(businessId, employeeId);
    if (!employee) {
      throw new NotFoundError('Employee');
    }
    return employee;
  }

  /**
   * Create a new employee
   */
  async createEmployee(businessId: string, input: CreateEmployeeInput, performer?: AuditPerformer): Promise<IEmployee> {
    if (input.type === 'transporter' && !input.details?.vehicleNumber) {
      throw new ValidationError('Vehicle number is required for transporter');
    }

    try {
      const employee = await this.employeeRepository.create({
        businessId: new Types.ObjectId(businessId),
        name: input.name,
        phone: input.phone,
        type: input.type,
        details: input.details,
        designation: input.designation,
        address: input.address,
        joiningDate: input.joiningDate,
        salaryType: input.salaryType,
        monthlySalary: input.monthlySalary,
        dailyRate: input.dailyRate,
        overtimeRatePerHour: input.overtimeRatePerHour,
        emergencyContact: input.emergencyContact,
        notes: input.notes,
        isActive: true,
      });

      logger.info('Employee created', {
        businessId,
        employeeId: employee._id,
        type: input.type,
        name: input.name,
      });

      if (performer) {
        this.auditLogService.logChange({
          businessId,
          documentId: employee._id.toString(),
          documentType: 'employee',
          action: 'created',
          changes: [],
          performedBy: performer,
        });
      }

      return employee;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && (error as { code: number }).code === 11000) {
        throw new ConflictError(`Employee "${input.name}" of type "${input.type}" already exists`);
      }
      throw error;
    }
  }

  /**
   * Update an employee
   */
  async updateEmployee(
    businessId: string,
    employeeId: string,
    input: UpdateEmployeeInput,
    performer?: AuditPerformer
  ): Promise<IEmployee> {
    const employee = await this.getEmployeeById(businessId, employeeId);
    const oldEmployee = employee.toObject();

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.designation !== undefined) updateData.designation = input.designation;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.joiningDate !== undefined) updateData.joiningDate = input.joiningDate;
    if (input.salaryType !== undefined) updateData.salaryType = input.salaryType;
    if (input.monthlySalary !== undefined) updateData.monthlySalary = input.monthlySalary;
    if (input.dailyRate !== undefined) updateData.dailyRate = input.dailyRate;
    if (input.overtimeRatePerHour !== undefined) updateData.overtimeRatePerHour = input.overtimeRatePerHour;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.details) {
      for (const [key, value] of Object.entries(input.details)) {
        updateData[`details.${key}`] = value;
      }
    }
    if (input.emergencyContact) {
      for (const [key, value] of Object.entries(input.emergencyContact)) {
        updateData[`emergencyContact.${key}`] = value;
      }
    }

    const updated = await this.employeeRepository.updateById(employee._id, updateData);
    if (!updated) {
      throw new NotFoundError('Employee');
    }

    logger.info('Employee updated', { businessId, employeeId });

    if (performer) {
      const changes = AuditLogService.diffObjects(
        oldEmployee,
        updated.toObject(),
        ['name', 'phone', 'type', 'designation', 'address', 'joiningDate', 'salaryType', 'monthlySalary', 'dailyRate', 'overtimeRatePerHour', 'notes', 'isActive']
      );
      if (changes.length > 0) {
        this.auditLogService.logChange({
          businessId,
          documentId: employeeId,
          documentType: 'employee',
          action: 'updated',
          changes,
          performedBy: performer,
        });
      }
    }

    return updated;
  }

  /**
   * Soft delete an employee
   */
  async deleteEmployee(businessId: string, employeeId: string, performer?: AuditPerformer): Promise<IEmployee> {
    await this.getEmployeeById(businessId, employeeId);

    const deleted = await this.employeeRepository.softDelete(employeeId);
    if (!deleted) {
      throw new NotFoundError('Employee');
    }

    logger.info('Employee soft-deleted', { businessId, employeeId });

    if (performer) {
      this.auditLogService.logChange({
        businessId,
        documentId: employeeId,
        documentType: 'employee',
        action: 'deleted',
        changes: [],
        performedBy: performer,
      });
    }

    return deleted;
  }
}

export default EmployeeService;
