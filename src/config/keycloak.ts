/**
 * @file Keycloak configuration settings
 * @description Configuration for Keycloak authentication integration
 */

/**
 * Keycloak configuration interface
 */
interface KeycloakConfig {
  /** Keycloak server URL */
  serverUrl: string;
  /** Keycloak realm name */
  realm: string;
  /** Client ID for the backend API */
  clientId: string;
  /** Client secret for confidential client */
  clientSecret: string;
  /** JWT issuer URL */
  issuer: string;
  /** JWKS URI for token verification */
  jwksUri: string;
}

/**
 * Keycloak configuration settings
 */
export const keycloakConfig: KeycloakConfig = {
  serverUrl: process.env.KEYCLOAK_URL || 'http://localhost:8080',
  realm: process.env.KEYCLOAK_REALM || 'billpromax',
  clientId: process.env.KEYCLOAK_CLIENT_ID || 'billpromax-api',
  clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',
  issuer:
    process.env.JWT_ISSUER ||
    `${process.env.KEYCLOAK_URL || 'http://localhost:8080'}/realms/${process.env.KEYCLOAK_REALM || 'billpromax'}`,
  jwksUri: `${process.env.KEYCLOAK_URL || 'http://localhost:8080'}/realms/${process.env.KEYCLOAK_REALM || 'billpromax'}/protocol/openid-connect/certs`,
};

/**
 * Keycloak Connect configuration for Express middleware
 */
export const keycloakConnectConfig = {
  realm: keycloakConfig.realm,
  'auth-server-url': keycloakConfig.serverUrl,
  'ssl-required': 'external',
  resource: keycloakConfig.clientId,
  'confidential-port': 0,
  'bearer-only': true,
};

/**
 * Keycloak Admin API configuration
 * Used for server-to-server communication to update user attributes
 * Uses master realm admin credentials for reliable access
 */
export interface KeycloakAdminConfig {
  /** Admin username (from master realm) */
  adminUsername: string;
  /** Admin password */
  adminPassword: string;
}

/**
 * Keycloak Admin configuration settings
 * Uses master realm admin credentials (admin/admin by default in development)
 * This provides full access to manage users across all realms
 */
export const keycloakAdminConfig: KeycloakAdminConfig = {
  adminUsername: process.env.KEYCLOAK_ADMIN_USERNAME || 'admin',
  adminPassword: process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin',
};

/**
 * Available user roles in the system
 */
export const UserRoles = {
  OWNER: 'owner',
  MANAGER: 'manager',
  STAFF: 'staff',
  ACCOUNTANT: 'accountant',
  VIEWER: 'viewer',
  CLIENT_PORTAL: 'client-portal',
} as const;

export type UserRole = (typeof UserRoles)[keyof typeof UserRoles];
