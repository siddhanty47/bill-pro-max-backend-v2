/**
 * @file Keycloak Admin Service
 * @description Service for interacting with Keycloak Admin REST API
 */

import axios, { AxiosInstance } from 'axios';
import { keycloakConfig } from '../config/keycloak';
import { KeycloakUser, UpdateKeycloakUserPayload } from '../types/keycloak';
import { logger } from '../utils/logger';
import { AppError } from '../middleware';

/**
 * Keycloak admin configuration
 * Uses master realm admin credentials for reliable user management
 */
export interface KeycloakAdminConfig {
  /** Admin username (from master realm) */
  adminUsername: string;
  /** Admin password */
  adminPassword: string;
}

/**
 * Token response from Keycloak
 */
interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Keycloak Admin Service
 * Handles interactions with Keycloak Admin REST API for user management
 * Uses master realm admin credentials for reliable access to user management endpoints
 */
export class KeycloakAdminService {
  private config: KeycloakAdminConfig;
  private axiosInstance: AxiosInstance;
  private cachedToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.config = {
      adminUsername: process.env.KEYCLOAK_ADMIN_USERNAME || 'admin',
      adminPassword: process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin',
    };

    this.axiosInstance = axios.create({
      baseURL: keycloakConfig.serverUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get admin access token using master realm admin credentials
   * This approach is more reliable than service accounts for development
   * Caches the token until it expires
   * @returns Access token
   */
  async getAdminToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.cachedToken && Date.now() < this.tokenExpiry) {
      return this.cachedToken;
    }

    try {
      // Use master realm to get admin token
      const tokenUrl = '/realms/master/protocol/openid-connect/token';

      const params = new URLSearchParams();
      params.append('grant_type', 'password');
      params.append('client_id', 'admin-cli');
      params.append('username', this.config.adminUsername);
      params.append('password', this.config.adminPassword);

      const response = await this.axiosInstance.post<TokenResponse>(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      this.cachedToken = response.data.access_token;
      // Set expiry to 30 seconds before actual expiry for safety
      this.tokenExpiry = Date.now() + (response.data.expires_in - 30) * 1000;

      logger.debug('Obtained Keycloak admin token from master realm');

      return this.cachedToken;
    } catch (error) {
      logger.error('Failed to get Keycloak admin token', { error });
      throw new AppError(
        'Failed to authenticate with Keycloak admin API. Check KEYCLOAK_ADMIN_USERNAME and KEYCLOAK_ADMIN_PASSWORD.',
        500,
        'KEYCLOAK_AUTH_ERROR'
      );
    }
  }

  /**
   * Get user by Keycloak user ID
   * @param userId - Keycloak user ID (sub claim from JWT)
   * @returns Keycloak user representation
   */
  async getUserById(userId: string): Promise<KeycloakUser> {
    try {
      const token = await this.getAdminToken();
      const userUrl = `/admin/realms/${keycloakConfig.realm}/users/${userId}`;

      const response = await this.axiosInstance.get<KeycloakUser>(userUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        logger.warn('Keycloak user not found', { userId });
        throw new AppError('User not found in Keycloak', 404, 'USER_NOT_FOUND');
      }
      logger.error('Failed to get Keycloak user', { userId, error });
      throw new AppError('Failed to fetch user from Keycloak', 500, 'KEYCLOAK_ERROR');
    }
  }

  /**
   * Update user attributes in Keycloak
   * @param userId - Keycloak user ID
   * @param payload - Update payload
   */
  async updateUser(userId: string, payload: UpdateKeycloakUserPayload): Promise<void> {
    try {
      const token = await this.getAdminToken();
      const userUrl = `/admin/realms/${keycloakConfig.realm}/users/${userId}`;

      const response = await this.axiosInstance.put(userUrl, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      logger.info('Keycloak user updated successfully', { userId, status: response.status });
      
      // Verify the update by fetching the user again
      const verifyResponse = await this.axiosInstance.get(userUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      logger.info('User after update', { 
        userId, 
        attributes: verifyResponse.data.attributes 
      });
    } catch (error) {
      logger.error('Failed to update Keycloak user', { userId, error: error instanceof Error ? error.message : error });
      throw new AppError('Failed to update user in Keycloak', 500, 'KEYCLOAK_ERROR');
    }
  }

  /**
   * Add a business ID to user's businessIds attribute
   * @param userId - Keycloak user ID
   * @param businessId - Business ID to add
   */
  async addBusinessIdToUser(userId: string, businessId: string): Promise<void> {
    try {
      // Get current user to retrieve existing businessIds
      const user = await this.getUserById(userId);

      // Get current businessIds or initialize empty array
      const currentBusinessIds = user.attributes?.businessIds || [];

      // Check if business ID already exists
      if (currentBusinessIds.includes(businessId)) {
        logger.debug('Business ID already exists for user', { userId, businessId });
        return;
      }

      // Add new business ID
      const updatedBusinessIds = [...currentBusinessIds, businessId];

      // Update user attributes while preserving ALL user fields
      // Keycloak PUT replaces the entire user, so we must include all fields
      await this.updateUser(userId, {
        // Preserve essential user fields
        email: user.email,
        emailVerified: user.emailVerified,
        firstName: user.firstName,
        lastName: user.lastName,
        enabled: user.enabled,
        // Update attributes with new businessId
        attributes: {
          ...user.attributes,
          businessIds: updatedBusinessIds,
        },
        // Always clear required actions to ensure user can login
        requiredActions: [],
      });

      logger.info('Added business ID to Keycloak user', { userId, businessId });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to add business ID to user', { userId, businessId, error });
      throw new AppError('Failed to update user business access', 500, 'KEYCLOAK_ERROR');
    }
  }

  /**
   * Remove a business ID from user's businessIds attribute
   * @param userId - Keycloak user ID
   * @param businessId - Business ID to remove
   */
  async removeBusinessIdFromUser(userId: string, businessId: string): Promise<void> {
    try {
      // Get current user
      const user = await this.getUserById(userId);

      // Get current businessIds
      const currentBusinessIds = user.attributes?.businessIds || [];

      // Filter out the business ID
      const updatedBusinessIds = currentBusinessIds.filter(id => id !== businessId);

      // Update user attributes while preserving ALL user fields
      // Keycloak PUT replaces the entire user, so we must include all fields
      await this.updateUser(userId, {
        // Preserve essential user fields
        email: user.email,
        emailVerified: user.emailVerified,
        firstName: user.firstName,
        lastName: user.lastName,
        enabled: user.enabled,
        // Update attributes with removed businessId
        attributes: {
          ...user.attributes,
          businessIds: updatedBusinessIds,
        },
        // Always clear required actions to ensure user can login
        requiredActions: [],
      });

      logger.info('Removed business ID from Keycloak user', { userId, businessId });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to remove business ID from user', { userId, businessId, error });
      throw new AppError('Failed to update user business access', 500, 'KEYCLOAK_ERROR');
    }
  }

  /**
   * Assign a role to a user
   * @param userId - Keycloak user ID
   * @param roleName - Role name to assign
   */
  async assignRoleToUser(userId: string, roleName: string): Promise<void> {
    try {
      const token = await this.getAdminToken();

      // First, get the role by name
      const rolesUrl = `/admin/realms/${keycloakConfig.realm}/roles/${roleName}`;
      const roleResponse = await this.axiosInstance.get(rolesUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const role = roleResponse.data;

      // Assign role to user
      const userRolesUrl = `/admin/realms/${keycloakConfig.realm}/users/${userId}/role-mappings/realm`;
      await this.axiosInstance.post(userRolesUrl, [role], {
        headers: { Authorization: `Bearer ${token}` },
      });

      logger.info('Assigned role to Keycloak user', { userId, roleName });
    } catch (error) {
      logger.error('Failed to assign role to user', { userId, roleName, error });
      throw new AppError('Failed to assign role to user', 500, 'KEYCLOAK_ERROR');
    }
  }

  /**
   * Look up a Keycloak user by email address.
   * @param email - The email to search for
   * @returns The Keycloak user if found, or null
   */
  async getUserByEmail(email: string): Promise<KeycloakUser | null> {
    try {
      const token = await this.getAdminToken();
      const searchUrl = `/admin/realms/${keycloakConfig.realm}/users`;

      const response = await this.axiosInstance.get<KeycloakUser[]>(searchUrl, {
        headers: { Authorization: `Bearer ${token}` },
        params: { email, exact: true },
      });

      const users = response.data;
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      logger.error('Failed to search Keycloak user by email', { email, error });
      return null;
    }
  }

  /**
   * Check if the Keycloak admin connection is healthy
   * @returns True if connection is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.getAdminToken();
      return true;
    } catch {
      return false;
    }
  }
}

export default KeycloakAdminService;
