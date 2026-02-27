/**
 * @file Auth Controller
 * @description Handles auth-related HTTP requests (user sync after login).
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { AuthenticatedRequest } from '../middleware';
import { logger } from '../utils/logger';

/**
 * Auth Controller class.
 * Handles the POST /auth/sync endpoint called by the frontend
 * after each OIDC login/signup to sync user data into MongoDB.
 */
export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Sync user data from JWT into MongoDB.
   * POST /auth/sync
   */
  syncUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;

      const result = await this.authService.syncUser({
        keycloakUserId: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        roles: user.roles,
        businessIds: user.businessIds,
      });

      logger.info('Auth sync completed', {
        userId: user.id,
        isNewUser: result.isNewUser,
      });

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: result.user.keycloakUserId,
            email: result.user.email,
            name: result.user.name,
          },
          isNewUser: result.isNewUser,
        },
        message: 'User synced successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}

export default AuthController;
