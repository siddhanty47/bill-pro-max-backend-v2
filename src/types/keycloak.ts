/**
 * @file Keycloak types
 * @description TypeScript types for Keycloak integration
 */

/**
 * Keycloak user representation
 */
export interface KeycloakUser {
  id: string;
  username: string;
  email?: string;
  emailVerified?: boolean;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  attributes?: Record<string, string[]>;
  realmRoles?: string[];
  clientRoles?: Record<string, string[]>;
  groups?: string[];
  createdTimestamp?: number;
  requiredActions?: string[];
}

/**
 * Keycloak token claims
 */
export interface KeycloakTokenClaims {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  auth_time?: number;
  nonce?: string;
  acr?: string;
  azp?: string;
  session_state?: string;
  preferred_username?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  realm_access?: {
    roles: string[];
  };
  resource_access?: Record<
    string,
    {
      roles: string[];
    }
  >;
  scope?: string;
  businessIds?: string[];
}

/**
 * Keycloak realm role
 */
export interface KeycloakRealmRole {
  id: string;
  name: string;
  description?: string;
  composite?: boolean;
  clientRole?: boolean;
  containerId?: string;
}

/**
 * Keycloak client representation
 */
export interface KeycloakClient {
  id: string;
  clientId: string;
  name?: string;
  description?: string;
  enabled?: boolean;
  protocol?: string;
  publicClient?: boolean;
  bearerOnly?: boolean;
  serviceAccountsEnabled?: boolean;
  redirectUris?: string[];
  webOrigins?: string[];
}

/**
 * Keycloak group representation
 */
export interface KeycloakGroup {
  id: string;
  name: string;
  path: string;
  subGroups?: KeycloakGroup[];
  attributes?: Record<string, string[]>;
  realmRoles?: string[];
  clientRoles?: Record<string, string[]>;
}

/**
 * Keycloak admin API response types
 */
export interface KeycloakAdminResponse<T> {
  data: T;
  status: number;
}

/**
 * User creation payload for Keycloak admin API
 */
export interface CreateKeycloakUserPayload {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  emailVerified?: boolean;
  credentials?: Array<{
    type: 'password';
    value: string;
    temporary: boolean;
  }>;
  attributes?: Record<string, string[]>;
  realmRoles?: string[];
  groups?: string[];
}

/**
 * User update payload for Keycloak admin API
 * Important: Include requiredActions: [] to prevent Keycloak from adding default required actions
 */
export interface UpdateKeycloakUserPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  enabled?: boolean;
  emailVerified?: boolean;
  attributes?: Record<string, string[]>;
  requiredActions?: string[];
}
