/**
 * @file Provider-neutral LLM types
 * @description Vendor-agnostic chat/tool-use shapes. The agentic loop speaks ONLY
 * these types; each provider adapter (Anthropic, OpenAI, …) maps them to its own
 * wire format. Swapping providers = new adapter, zero loop changes.
 */

/** A tool the model is allowed to call (neutral JSON-schema form). */
export interface ToolDefinition {
  /** Unique tool name, e.g. "get_party_ledger". */
  name: string;
  /** Natural-language description the model uses to decide when to call it. */
  description: string;
  /** JSON Schema (object) describing the tool's input parameters. */
  parameters: Record<string, unknown>;
}

/** A single tool invocation requested by the model. */
export interface ToolCall {
  /** Provider-assigned id, echoed back when returning the result. */
  id: string;
  /** Tool name to invoke. */
  name: string;
  /** Parsed arguments object. */
  input: Record<string, unknown>;
}

/** The outcome of running a tool, fed back to the model. */
export interface ToolResult {
  /** Id of the ToolCall this answers. */
  toolCallId: string;
  /** Stringified result payload (JSON) shown to the model. */
  content: string;
  /** True if the tool threw / failed. */
  isError?: boolean;
}

/** Supported inline image media types for vision input. */
export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

/** An image attached to a user message, sent to the model as vision input. */
export interface ImagePart {
  mediaType: ImageMediaType;
  /** Base64-encoded image bytes (no data: prefix). */
  dataBase64: string;
}

/** One turn in the conversation, in neutral form. */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool';
  /** Assistant/user free text (optional on assistant turns that only call tools). */
  content?: string;
  /** Images attached to a user turn (vision input). Only set on the current turn. */
  images?: ImagePart[];
  /** Present on assistant turns that requested tool calls. */
  toolCalls?: ToolCall[];
  /** Present on 'tool' turns carrying results back to the model. */
  toolResults?: ToolResult[];
}

/** Why the model stopped producing output this turn. */
export type StopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'error';

/** Incremental events emitted while streaming a model turn. */
export type StreamEvent =
  /** A chunk of assistant free text. */
  | { type: 'text'; text: string }
  /** A fully-assembled tool call (emitted once its args JSON is complete). */
  | { type: 'tool_call'; call: ToolCall }
  /** Terminal event for the turn. */
  | {
      type: 'done';
      stopReason: StopReason;
      /** Full assistant text produced this turn (concatenation of text events). */
      text: string;
      /** All tool calls requested this turn. */
      toolCalls: ToolCall[];
      usage?: { inputTokens: number; outputTokens: number };
    };

/** Options for a single streamed model turn. */
export interface StreamChatOptions {
  system: string;
  messages: ChatMessage[];
  tools: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
}
