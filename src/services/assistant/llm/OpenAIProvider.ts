/**
 * @file OpenAIProvider (stub)
 * @description Proves the provider seam without pulling the OpenAI SDK into this
 * branch. The mapping is intentionally sketched, not wired: OpenAI's chat/tool
 * protocol differs (tools → `tools[].function`, tool calls → `tool_calls`, results
 * → role:'tool' messages, streamed via `stream: true` SSE chunks). To activate:
 *   1. `npm i openai`
 *   2. dynamic-import the SDK here (keep it out of the static type graph)
 *   3. translate StreamChatOptions ↔ ChatCompletion params, re-emit StreamEvents.
 * Left unimplemented so `ASSISTANT_PROVIDER=anthropic` ships with zero dead deps.
 */

import { assistantConfig } from '../../../config';
import { LLMProvider } from './LLMProvider';
import { StreamChatOptions, StreamEvent } from './types';

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';

  isEnabled(): boolean {
    return !!assistantConfig.openaiApiKey;
  }

  // eslint-disable-next-line require-yield
  async *streamChat(_opts: StreamChatOptions): AsyncIterable<StreamEvent> {
    throw new Error(
      'OpenAIProvider is not implemented in this build. Set ASSISTANT_PROVIDER=anthropic, ' +
        'or implement the OpenAI adapter (see file header).'
    );
  }
}
