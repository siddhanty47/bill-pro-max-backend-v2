/**
 * @file Auth Service
 * @description Handles user sync from Supabase JWT and post-signup invitation processing.
 * Called after every login/signup to ensure the MongoDB User document mirrors auth provider.
 */

import { User, IUser } from '../models';
import { InvitationService } from './InvitationService';
import { clearUserCache } from '../middleware/supabaseAuth';
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
  authProviderId: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  name: string;
}

/**
 * Auth Service class.
 * Synchronises auth provider user data into MongoDB on every login.
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
    const existing = await User.findOne({ authProviderId: payload.authProviderId });

    if (existing) {
      existing.email = payload.email;
      existing.username = payload.username;
      existing.firstName = payload.firstName;
      existing.lastName = payload.lastName;
      existing.name = payload.name;
      existing.lastLogin = new Date();
      await existing.save();

      // Clear user cache so middleware picks up any changes
      clearUserCache(payload.authProviderId);

      logger.info('User synced (existing)', { userId: payload.authProviderId });
      return { user: existing, isNewUser: false };
    }

    const newUser = await User.create({
      authProviderId: payload.authProviderId,
      email: payload.email,
      username: payload.username,
      firstName: payload.firstName,
      lastName: payload.lastName,
      name: payload.name,
      roles: [],
      businessIds: [],
      isActive: true,
      lastLogin: new Date(),
    });

    logger.info('User synced (new)', { userId: payload.authProviderId });

    // Process any pending invitations for this email
    try {
      await this.invitationService.processPostSignupInvitations(
        payload.email,
        payload.authProviderId,
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
