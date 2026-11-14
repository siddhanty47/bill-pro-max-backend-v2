/**
 * @file ToolRegistry
 * @description Single source of truth for the assistant's callable tools. Holds
 * the tool set, projects it to the neutral LLM schema, and centralizes the RBAC
 * check. The agentic loop owns the confirmation gate (it must pause the turn),
 * but the per-tool permission decision lives here so it can't be bypassed.
 */

import { userHasPermission } from '../../middleware/rbac';
import { BusinessScopedUser } from '../../middleware/businessScope';
import { ToolDefinition } from './llm/types';
import { AssistantTool, toToolDefinition } from './tools/types';
import { readTools } from './tools/readTools';
import { writeTools } from './tools/writeTools';
import { challanTools } from './tools/challanTools';

export class ToolRegistry {
  private tools = new Map<string, AssistantTool>();

  constructor(tools: AssistantTool[] = []) {
    this.registerAll(tools);
  }

  register(tool: AssistantTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Duplicate assistant tool: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  registerAll(tools: AssistantTool[]): void {
    tools.forEach((t) => this.register(t));
  }

  get(name: string): AssistantTool | undefined {
    return this.tools.get(name);
  }

  list(): AssistantTool[] {
    return [...this.tools.values()];
  }

  /** Neutral schemas handed to the LLM provider. */
  definitions(): ToolDefinition[] {
    return this.list().map(toToolDefinition);
  }

  /** True if the user's business role grants the tool's required permission. */
  isAllowed(tool: AssistantTool, user: BusinessScopedUser): boolean {
    return userHasPermission(user, tool.perm.action, tool.perm.resource);
  }
}

/**
 * Default registry: read tools + confirmation-gated write tools. Exported as a
 * singleton so the loop and controller share one instance.
 */
export const toolRegistry = new ToolRegistry([...readTools, ...writeTools, ...challanTools]);
