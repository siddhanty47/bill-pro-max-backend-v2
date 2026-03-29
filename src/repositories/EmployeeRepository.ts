/**
 * @file Employee Repository
 * @description Repository for employee entity operations
 */

import { Types, FilterQuery } from 'mongoose';
import { BaseRepository, PaginationOptions, PaginatedResult } from './BaseRepository';
import { Employee, IEmployee, EmployeeType } from '../models';

/**
 * Employee filter options
 */
export interface EmployeeFilterOptions {
  type?: EmployeeType;
  isActive?: boolean;
  search?: string;
}

/**
 * Employee repository class
 */
export class EmployeeRepository extends BaseRepository<IEmployee> {
  constructor() {
    super(Employee);
  }

  /**
   * Find employees by business ID with optional filters
   */
  async findByBusiness(
    businessId: string | Types.ObjectId,
    filters: EmployeeFilterOptions = {},
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<IEmployee>> {
    const query: FilterQuery<IEmployee> = {
      businessId: new Types.ObjectId(businessId.toString()),
    };

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters.search) {
      const searchRegex = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ name: searchRegex }, { phone: searchRegex }];
    }

    return this.findPaginated(query, { ...pagination, sortBy: 'name', sortOrder: 'asc' });
  }

  /**
   * Find employee by ID within a business
   */
  async findByIdInBusiness(
    businessId: string | Types.ObjectId,
    employeeId: string | Types.ObjectId
  ): Promise<IEmployee | null> {
    return this.findOne({
      _id: new Types.ObjectId(employeeId.toString()),
      businessId: new Types.ObjectId(businessId.toString()),
    });
  }

  /**
   * Find all active employees of a given type (unpaginated, for dropdowns)
   */
  async findActiveByType(
    businessId: string | Types.ObjectId,
    type: EmployeeType
  ): Promise<IEmployee[]> {
    return this.find(
      {
        businessId: new Types.ObjectId(businessId.toString()),
        type,
        isActive: true,
      },
      undefined,
      { sort: { name: 1 } }
    );
  }

  /**
   * Soft delete an employee (set isActive = false)
   */
  async softDelete(employeeId: string | Types.ObjectId): Promise<IEmployee | null> {
    return this.updateById(employeeId, { isActive: false });
  }
}

export default EmployeeRepository;
