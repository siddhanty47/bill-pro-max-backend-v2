/**
 * @file Base Repository
 * @description Generic repository pattern implementation for Mongoose models
 */

import mongoose, {
  Model,
  Document,
  FilterQuery,
  UpdateQuery,
  QueryOptions,
  Types,
  ProjectionType,
} from 'mongoose';

/**
 * Pagination options
 */
export interface PaginationOptions {
  /** Page number (1-based) */
  page?: number;
  /** Page size */
  pageSize?: number;
  /** Sort field */
  sortBy?: string;
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  /** Data items */
  data: T[];
  /** Pagination info */
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Base repository class with common CRUD operations
 */
export class BaseRepository<T extends Document> {
  protected model: Model<T>;

  /**
   * Create a new BaseRepository
   * @param model - Mongoose model
   */
  constructor(model: Model<T>) {
    this.model = model;
  }

  /**
   * Create a new document
   * @param data - Document data
   * @returns Created document
   */
  async create(data: Partial<T>): Promise<T> {
    const document = new this.model(data);
    return document.save();
  }

  /**
   * Create multiple documents
   * @param data - Array of document data
   * @returns Created documents
   */
  async createMany(data: Partial<T>[]): Promise<T[]> {
    const result = await this.model.insertMany(data);
    return result as unknown as T[];
  }

  /**
   * Find document by ID
   * @param id - Document ID
   * @param projection - Fields to include/exclude
   * @returns Document or null
   */
  async findById(
    id: string | Types.ObjectId,
    projection?: ProjectionType<T>
  ): Promise<T | null> {
    return this.model.findById(id, projection).exec();
  }

  /**
   * Find one document matching query
   * @param query - Filter query
   * @param projection - Fields to include/exclude
   * @returns Document or null
   */
  async findOne(
    query: FilterQuery<T>,
    projection?: ProjectionType<T>
  ): Promise<T | null> {
    return this.model.findOne(query, projection).exec();
  }

  /**
   * Find all documents matching query
   * @param query - Filter query
   * @param projection - Fields to include/exclude
   * @param options - Query options
   * @returns Array of documents
   */
  async find(
    query: FilterQuery<T>,
    projection?: ProjectionType<T>,
    options?: QueryOptions
  ): Promise<T[]> {
    return this.model.find(query, projection, options).exec();
  }

  /**
   * Find documents with pagination
   * @param query - Filter query
   * @param options - Pagination options
   * @param projection - Fields to include/exclude
   * @returns Paginated result
   */
  async findPaginated(
    query: FilterQuery<T>,
    options: PaginationOptions = {},
    projection?: ProjectionType<T>
  ): Promise<PaginatedResult<T>> {
    const { page = 1, pageSize = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    const skip = (page - 1) * pageSize;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
      this.model.find(query, projection).sort({ [sortBy]: sortDirection }).skip(skip).limit(pageSize).exec(),
      this.model.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Update document by ID
   * @param id - Document ID
   * @param data - Update data
   * @param options - Query options
   * @returns Updated document
   */
  async updateById(
    id: string | Types.ObjectId,
    data: UpdateQuery<T>,
    options: QueryOptions = { new: true }
  ): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, data, options).exec();
  }

  /**
   * Update one document matching query
   * @param query - Filter query
   * @param data - Update data
   * @param options - Query options
   * @returns Updated document
   */
  async updateOne(
    query: FilterQuery<T>,
    data: UpdateQuery<T>,
    options: QueryOptions = { new: true }
  ): Promise<T | null> {
    return this.model.findOneAndUpdate(query, data, options).exec();
  }

  /**
   * Update multiple documents
   * @param query - Filter query
   * @param data - Update data
   * @returns Update result
   */
  async updateMany(
    query: FilterQuery<T>,
    data: UpdateQuery<T>
  ): Promise<{ matchedCount: number; modifiedCount: number }> {
    const result = await this.model.updateMany(query, data).exec();
    return {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    };
  }

  /**
   * Delete document by ID
   * @param id - Document ID
   * @returns Deleted document
   */
  async deleteById(id: string | Types.ObjectId): Promise<T | null> {
    return this.model.findByIdAndDelete(id).exec();
  }

  /**
   * Delete one document matching query
   * @param query - Filter query
   * @returns Deleted document
   */
  async deleteOne(query: FilterQuery<T>): Promise<T | null> {
    return this.model.findOneAndDelete(query).exec();
  }

  /**
   * Delete multiple documents
   * @param query - Filter query
   * @returns Delete result
   */
  async deleteMany(query: FilterQuery<T>): Promise<{ deletedCount: number }> {
    const result = await this.model.deleteMany(query).exec();
    return { deletedCount: result.deletedCount };
  }

  /**
   * Count documents matching query
   * @param query - Filter query
   * @returns Count
   */
  async count(query: FilterQuery<T>): Promise<number> {
    return this.model.countDocuments(query).exec();
  }

  /**
   * Check if document exists
   * @param query - Filter query
   * @returns True if exists
   */
  async exists(query: FilterQuery<T>): Promise<boolean> {
    const result = await this.model.exists(query).exec();
    return result !== null;
  }

  /**
   * Aggregate documents
   * @param pipeline - Aggregation pipeline
   * @returns Aggregation result
   */
  async aggregate<R>(pipeline: mongoose.PipelineStage[]): Promise<R[]> {
    return this.model.aggregate(pipeline).exec();
  }
}

export default BaseRepository;
