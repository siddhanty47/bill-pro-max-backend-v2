/**
 * @file Employee Controller
 * @description HTTP request handlers for employee management
 */

import { Request, Response, NextFunction } from 'express';
import { EmployeeService } from '../services';
import { paginationSchema } from '../types/api';
import { EmployeeType } from '../models';

/**
 * Employee Controller class
 */
export class EmployeeController {
  private employeeService: EmployeeService;

  constructor() {
    this.employeeService = new EmployeeService();
  }

  /**
   * Get all employees for a business
   */
  getEmployees = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;
      const pagination = paginationSchema.parse(req.query);
      const { type, isActive } = req.query;

      const result = await this.employeeService.getEmployees(
        businessId,
        {
          type: type as EmployeeType | undefined,
          isActive: isActive !== undefined ? isActive === 'true' : undefined,
        },
        pagination
      );

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        message: 'Employees retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get employee by ID
   */
  getEmployeeById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, id } = req.params;
      const employee = await this.employeeService.getEmployeeById(businessId, id);

      res.status(200).json({
        success: true,
        data: employee,
        message: 'Employee retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create a new employee
   */
  createEmployee = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;
      const employee = await this.employeeService.createEmployee(businessId, req.body);

      res.status(201).json({
        success: true,
        data: employee,
        message: 'Employee created successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update an employee
   */
  updateEmployee = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, id } = req.params;
      const employee = await this.employeeService.updateEmployee(businessId, id, req.body);

      res.status(200).json({
        success: true,
        data: employee,
        message: 'Employee updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Soft delete an employee
   */
  deleteEmployee = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, id } = req.params;
      const employee = await this.employeeService.deleteEmployee(businessId, id);

      res.status(200).json({
        success: true,
        data: employee,
        message: 'Employee deleted successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}

export default EmployeeController;
