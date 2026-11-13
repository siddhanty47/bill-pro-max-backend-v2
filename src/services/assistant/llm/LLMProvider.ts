/**
 * @file LLMProvider interface
 * @description The single seam between the agentic loop and any model vendor.
 * Implement this once per provider; the loop depends only on this interface.
 */

import { StreamChatOptions, StreamEvent } from './types';

export interface LLMProvider {
  /** Human-readable provider id, e.g. "anthropic". */
  readonly name: string;

  /** True when the provider has the credentials/config it needs to run. */
  isEnabled(): boolean;

  /**
   * Stream one assistant turn. Yields incremental text and fully-assembled tool
   * calls, then a terminal `done` event. Implementations must translate neutral
   * ChatMessages/ToolDefinitions to their wire format and back.
   */
  streamChat(opts: StreamChatOptions): AsyncIterable<StreamEvent>;
}
