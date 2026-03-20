/**
 * @file Invitation Service
 * @description Business logic for creating, accepting, declining, and managing invitations.
 * Implements the hybrid flow: checks if the invited user already has a BillProMax account.
 */

import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Types } from 'mongoose';
import { InvitationRepository } from '../repositories/InvitationRepository';
import { BusinessMemberRepository } from '../repositories/BusinessMemberRepository';
import { BusinessRepository } from '../repositories';
import { KeycloakAdminService } from './KeycloakAdminService';
import { NotificationService } from './NotificationService';
import { InAppNotificationService } from './InAppNotificationService';
import { IInvitation } from '../models/Invitation';
import { UserRole } from '../config/keycloak';
import { AppError, ConflictError, NotFoundError, ForbiddenError } from '../middleware';
import { logger } from '../utils/logger';
import { InvitationExistingUserEmail, InvitationNewUserEmail } from '../emails';

const INVITATION_EXPIRY_DAYS = 7;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5174';

/**
 * Invitation creation input
 */
export interface CreateInvitationInput {
  email: string;
  role: string;
}

/**
 * Invitation Service class.
 * Handles the full lifecycle of business invitations.
 */
export class InvitationService {
  private invitationRepository: InvitationRepository;
  private memberRepository: BusinessMemberRepository;
  private businessRepository: BusinessRepository;
  private keycloakAdminService: KeycloakAdminService;
  private notificationService: NotificationService;
  private inAppNotificationService: InAppNotificationService;

  constructor() {
    this.invitationRepository = new InvitationRepository();
    this.memberRepository = new BusinessMemberRepository();
    this.businessRepository = new BusinessRepository();
    this.keycloakAdminService = new KeycloakAdminService();
    this.notificationService = new NotificationService();
    this.inAppNotificationService = new InAppNotificationService();
  }

  /**
   * Create and send an invitation.
   * Checks for duplicate invitations, looks up the user in Keycloak,
   * and sends the appropriate email/notification.
   * @param businessId - Business document ID
   * @param input - Invitation data (email + role)
   * @param invitedBy - Keycloak user ID of the inviter
   * @param inviterName - Display name of the inviter
   * @returns The created invitation
   */
  async createInvitation(
    businessId: string,
    input: CreateInvitationInput,
    invitedBy: string,
    inviterName: string
  ): Promise<IInvitation> {
    const email = input.email.toLowerCase();

    // Check for existing member
    const existingMembers = await this.memberRepository.findByBusiness(businessId);
    if (existingMembers.some((m) => m.email === email)) {
      throw new ConflictError('This user is already a member of this business');
    }

    // Check for duplicate pending invitation
    const existingInvitation = await this.invitationRepository.findPendingByBusinessAndEmail(
      businessId,
      email
    );
    if (existingInvitation) {
      throw new ConflictError('A pending invitation already exists for this email');
    }

    const business = await this.businessRepository.findById(businessId);
    if (!business) {
      throw new NotFoundError('Business');
    }

    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    const invitation = await this.invitationRepository.create({
      businessId: new Types.ObjectId(businessId),
      email,
      role: input.role,
      invitedBy,
      inviterName,
      businessName: business.name,
      status: 'pending',
      token,
      expiresAt,
    } as Partial<IInvitation>);

    // Check if the invited user already has a Keycloak account
    const keycloakUser = await this.keycloakAdminService.getUserByEmail(email);

    if (keycloakUser) {
      // Existing user: send in-app notification + email
      await this.inAppNotificationService.createNotification(
        keycloakUser.id,
        'invitation',
        `Invitation to join ${business.name}`,
        `You have been invited to join ${business.name} as ${input.role} by ${inviterName}.`,
        { invitationToken: token, businessName: business.name, role: input.role }
      );

      const acceptUrl = `${FRONTEND_URL}/invitations/${token}`;
      await this.notificationService.sendEmail({
        to: email,
        subject: `You're invited to join ${business.name} on BillProMax`,
        react: React.createElement(InvitationExistingUserEmail, {
          businessName: business.name,
          role: input.role,
          inviterName,
          acceptUrl,
          expiryDays: INVITATION_EXPIRY_DAYS,
        }),
      });

      logger.info('Invitation sent to existing user', { email, businessId });
    } else {
      // New user: send email with sign-up link
      const newUserAcceptUrl = `${FRONTEND_URL}/invitations/${token}`;
      await this.notificationService.sendEmail({
        to: email,
        subject: `You're invited to join ${business.name} on BillProMax`,
        react: React.createElement(InvitationNewUserEmail, {
          businessName: business.name,
          role: input.role,
          inviterName,
          acceptUrl: newUserAcceptUrl,
          expiryDays: INVITATION_EXPIRY_DAYS,
        }),
      });

      logger.info('Invitation sent to new user', { email, businessId });
    }

    return invitation;
  }

  /**
   * Accept an invitation using its token.
   * Creates a BusinessMember record and updates Keycloak.
   * @param token - Invitation token
   * @param userId - Keycloak user ID of the accepting user
   * @param userEmail - Email of the accepting user
   * @param userName - Display name of the accepting user
   */
  async acceptInvitation(
    token: string,
    userId: string,
    userEmail: string,
    userName: string
  ): Promise<void> {
    const invitation = await this.invitationRepository.findByToken(token);

    if (!invitation) {
      throw new NotFoundError('Invitation');
    }

    if (invitation.status !== 'pending') {
      throw new AppError(`Invitation has already been ${invitation.status}`, 400, 'INVITATION_INVALID');
    }

    if (invitation.expiresAt < new Date()) {
      await this.invitationRepository.updateStatus(invitation._id, 'expired');
      throw new AppError('Invitation has expired', 400, 'INVITATION_EXPIRED');
    }

    if (invitation.email !== userEmail.toLowerCase()) {
      throw new ForbiddenError('This invitation was sent to a different email address');
    }

    // Check if already a member
    const existingMember = await this.memberRepository.findByBusinessAndUser(
      invitation.businessId.toString(),
      userId
    );
    if (existingMember) {
      await this.invitationRepository.updateStatus(invitation._id, 'accepted');
      return;
    }

    // Create BusinessMember record
    await this.memberRepository.create({
      businessId: invitation.businessId,
      userId,
      email: userEmail,
      name: userName,
      role: invitation.role as UserRole,
      joinedAt: new Date(),
      invitedBy: invitation.invitedBy,
    } as Partial<import('../models/BusinessMember').IBusinessMember>);

    // Add businessId to user's Keycloak attributes
    try {
      await this.keycloakAdminService.addBusinessIdToUser(
        userId,
        invitation.businessId.toString()
      );
    } catch (keycloakError) {
      logger.error('Failed to update Keycloak after invitation acceptance', {
        userId,
        businessId: invitation.businessId.toString(),
        error: keycloakError,
      });
    }

    await this.invitationRepository.updateStatus(invitation._id, 'accepted');

    logger.info('Invitation accepted', {
      token,
      userId,
      businessId: invitation.businessId.toString(),
      role: invitation.role,
    });
  }

  /**
   * Decline an invitation.
   * @param token - Invitation token
   * @param userId - Keycloak user ID of the declining user
   * @param userEmail - Email of the declining user
   */
  async declineInvitation(token: string, userId: string, userEmail: string): Promise<void> {
    const invitation = await this.invitationRepository.findByToken(token);

    if (!invitation) {
      throw new NotFoundError('Invitation');
    }

    if (invitation.status !== 'pending') {
      throw new AppError(`Invitation has already been ${invitation.status}`, 400, 'INVITATION_INVALID');
    }

    if (invitation.email !== userEmail.toLowerCase()) {
      throw new ForbiddenError('This invitation was sent to a different email address');
    }

    await this.invitationRepository.updateStatus(invitation._id, 'declined');

    logger.info('Invitation declined', { token, userId });
  }

  /**
   * Cancel an invitation (by the business owner/manager).
   * @param invitationId - Invitation document ID
   * @param businessId - Business ID (for authorization)
   */
  async cancelInvitation(invitationId: string, businessId: string): Promise<void> {
    const invitation = await this.invitationRepository.findById(invitationId);

    if (!invitation || invitation.businessId.toString() !== businessId) {
      throw new NotFoundError('Invitation');
    }

    if (invitation.status !== 'pending') {
      throw new AppError('Only pending invitations can be cancelled', 400, 'INVITATION_INVALID');
    }

    await this.invitationRepository.updateStatus(invitationId, 'cancelled');

    logger.info('Invitation cancelled', { invitationId, businessId });
  }

  /**
   * Update the role on a pending invitation.
   * @param invitationId - Invitation document ID
   * @param businessId - Business ID (for authorization)
   * @param newRole - New role to assign
   * @returns Updated invitation
   */
  async updateInvitationRole(
    invitationId: string,
    businessId: string,
    newRole: string
  ): Promise<IInvitation> {
    const invitation = await this.invitationRepository.findById(invitationId);

    if (!invitation || invitation.businessId.toString() !== businessId) {
      throw new NotFoundError('Invitation');
    }

    if (invitation.status !== 'pending') {
      throw new AppError('Only pending invitations can be updated', 400, 'INVITATION_INVALID');
    }

    const updated = await this.invitationRepository.updateById(invitationId, { role: newRole });
    if (!updated) {
      throw new NotFoundError('Invitation');
    }

    logger.info('Invitation role updated', { invitationId, newRole });
    return updated;
  }

  /**
   * Verify an invitation token (public endpoint for the accept page).
   * @param token - Invitation token
   * @returns The invitation details
   */
  async verifyInvitation(token: string): Promise<IInvitation> {
    const invitation = await this.invitationRepository.findByToken(token);

    if (!invitation) {
      throw new NotFoundError('Invitation');
    }

    if (invitation.status !== 'pending') {
      throw new AppError(`Invitation has been ${invitation.status}`, 400, 'INVITATION_INVALID');
    }

    if (invitation.expiresAt < new Date()) {
      await this.invitationRepository.updateStatus(invitation._id, 'expired');
      throw new AppError('Invitation has expired', 400, 'INVITATION_EXPIRED');
    }

    return invitation;
  }

  /**
   * Get all invitations for a business.
   * @param businessId - Business document ID
   * @returns Array of invitations
   */
  async getInvitations(businessId: string): Promise<IInvitation[]> {
    return this.invitationRepository.findByBusiness(businessId);
  }

  /**
   * Process pending invitations for a user who just signed up.
   * Called from AuthService.syncUser after a new user login.
   * @param email - The new user's email
   * @param userId - The new user's Keycloak ID
   * @param userName - Display name
   */
  async processPostSignupInvitations(
    email: string,
    userId: string,
    userName: string
  ): Promise<void> {
    const pendingInvitations = await this.invitationRepository.findPendingByEmail(email);

    for (const invitation of pendingInvitations) {
      try {
        await this.acceptInvitation(invitation.token, userId, email, userName);
        logger.info('Auto-accepted post-signup invitation', {
          email,
          businessId: invitation.businessId.toString(),
        });
      } catch (error) {
        logger.warn('Failed to auto-accept invitation', {
          email,
          token: invitation.token,
          error,
        });
      }
    }
  }

}

export default InvitationService;
