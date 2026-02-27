/**
 * @file Auth Service
 * @description Handles user sync from Keycloak JWT and post-signup invitation processing.
 * Called after every login/signup to ensure the MongoDB User document mirrors Keycloak.
 */

import { User, IUser } from '../models';
import { InvitationService } from './InvitationService';
import { logger } from '../utils/logger';

/**
 * Auth sync result
 */
export interface AuthSyncResult {
  user: IUser;
  isNewUser: boolean;
}

/**
 * JWT-derived user payload used for syncing
 */
export interface SyncUserPayload {
  keycloakUserId: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  name: string;
  roles: string[];
  businessIds: string[];
}

/**
 * Auth Service class.
 * Synchronises Keycloak user data into MongoDB on every login.
 * Also processes pending invitations for new users.
 */
export class AuthService {
  private invitationService: InvitationService;

  constructor() {
    this.invitationService = new InvitationService();
  }
  /**
   * Create or update a User document from JWT claims.
   * @param payload - User data extracted from the JWT
   * @returns The synced user and whether it was newly created
   */
  async syncUser(payload: SyncUserPayload): Promise<AuthSyncResult> {
    const existing = await User.findOne({ keycloakUserId: payload.keycloakUserId });

    if (existing) {
      existing.email = payload.email;
      existing.username = payload.username;
      existing.firstName = payload.firstName;
      existing.lastName = payload.lastName;
      existing.name = payload.name;
      existing.roles = payload.roles;
      existing.lastLogin = new Date();
      await existing.save();

      logger.info('User synced (existing)', { userId: payload.keycloakUserId });
      return { user: existing, isNewUser: false };
    }

    const newUser = await User.create({
      keycloakUserId: payload.keycloakUserId,
      email: payload.email,
      username: payload.username,
      firstName: payload.firstName,
      lastName: payload.lastName,
      name: payload.name,
      roles: payload.roles,
      businessIds: [],
      isActive: true,
      lastLogin: new Date(),
    });

    logger.info('User synced (new)', { userId: payload.keycloakUserId });

    // Process any pending invitations for this email
    try {
      await this.invitationService.processPostSignupInvitations(
        payload.email,
        payload.keycloakUserId,
        payload.name || payload.email
      );
    } catch (invError) {
      logger.warn('Failed to process post-signup invitations', {
        email: payload.email,
        error: invError,
      });
    }

    return { user: newUser, isNewUser: true };
  }
}

export default AuthService;
