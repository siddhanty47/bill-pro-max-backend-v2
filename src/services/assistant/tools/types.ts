/**
 * @file Assistant tool types
 * @description An AssistantTool wraps ONE capability the model can invoke. Each
 * tool declares its RBAC permission and whether it mutates data, so the agentic
 * loop can enforce access + a confirmation gate uniformly — the tool handler just
 * calls the existing service layer.
 */

import { PermissionAction, ResourceType } from '../../../middleware/rbac';
import { BusinessScopedUser } from '../../../middleware/businessScope';
import { ToolDefinition } from '../llm/types';

/** Runtime context every tool handler receives. */
export interface ToolContext {
  /** Tenant scope — all queries MUST filter by this. */
  businessId: string;
  /** The business-scoped user (carries `businessRole` for RBAC + name for audit). */
  user: BusinessScopedUser;
  /**
   * True only when the user has explicitly confirmed a pending write action.
   * Write tools must refuse to mutate unless this is true (the loop sets it on
   * the confirm step).
   */
  confirmed: boolean;
}

/** A single model-invokable capability. */
export interface AssistantTool {
  /** Stable tool name exposed to the model. */
  name: string;
  /** Description the model uses to decide when/how to call it. */
  description: string;
  /** JSON Schema for the tool's arguments. */
  parameters: Record<string, unknown>;
  /** RBAC permission required to run it (same model as REST routes). */
  perm: { action: PermissionAction; resource: ResourceType };
  /** True if the tool mutates data (gated behind user confirmation). */
  isWrite: boolean;
  /** Executes the tool against the service layer. Return value is JSON-serialized for the model. */
  handler: (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

/** Project an AssistantTool down to the neutral schema the LLM provider needs. */
export function toToolDefinition(tool: AssistantTool): ToolDefinition {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  };
}
