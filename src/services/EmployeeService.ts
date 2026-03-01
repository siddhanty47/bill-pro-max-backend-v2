/**
 * @file Employee Service
 * @description Business logic for employee management
 */

import { Types } from 'mongoose';
import { EmployeeRepository, EmployeeFilterOptions, PaginationOptions, PaginatedResult } from '../repositories';
import { IEmployee, EmployeeType, ITransporterDetails } from '../models';
import { NotFoundError, ValidationError, ConflictError } from '../middleware';
import { logger } from '../utils/logger';

/**
 * Create employee input
 */
export interface CreateEmployeeInput {
  name: string;
  phone?: string;
  type: EmployeeType;
  details: ITransporterDetails;
}

/**
 * Update employee input
 */
export interface UpdateEmployeeInput {
  name?: string;
  phone?: string;
  details?: Partial<ITransporterDetails>;
}

/**
 * Employee Service class
 */
export class EmployeeService {
  private employeeRepository: EmployeeRepository;

  constructor() {
    this.employeeRepository = new EmployeeRepository();
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
  async createEmployee(businessId: string, input: CreateEmployeeInput): Promise<IEmployee> {
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
        isActive: true,
      });

      logger.info('Employee created', {
        businessId,
        employeeId: employee._id,
        type: input.type,
        name: input.name,
      });

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
    input: UpdateEmployeeInput
  ): Promise<IEmployee> {
    const employee = await this.getEmployeeById(businessId, employeeId);

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.details) {
      for (const [key, value] of Object.entries(input.details)) {
        updateData[`details.${key}`] = value;
      }
    }

    const updated = await this.employeeRepository.updateById(employee._id, updateData);
    if (!updated) {
      throw new NotFoundError('Employee');
    }

    logger.info('Employee updated', { businessId, employeeId });

    return updated;
  }

  /**
   * Soft delete an employee
   */
  async deleteEmployee(businessId: string, employeeId: string): Promise<IEmployee> {
    await this.getEmployeeById(businessId, employeeId);

    const deleted = await this.employeeRepository.softDelete(employeeId);
    if (!deleted) {
      throw new NotFoundError('Employee');
    }

    logger.info('Employee soft-deleted', { businessId, employeeId });

    return deleted;
  }
}

export default EmployeeService;
