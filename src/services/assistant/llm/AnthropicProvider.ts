/**
 * @file AnthropicProvider
 * @description Maps the neutral LLMProvider contract onto Anthropic's Messages API
 * with streaming + tool-use. Translates neutral ChatMessages ↔ Anthropic content
 * blocks and re-emits raw stream events as neutral StreamEvents.
 */

import Anthropic from '@anthropic-ai/sdk';
import { assistantConfig } from '../../../config';
import { logger } from '../../../utils/logger';
import { LLMProvider } from './LLMProvider';
import {
  ChatMessage,
  StopReason,
  StreamChatOptions,
  StreamEvent,
  ToolCall,
  ToolDefinition,
} from './types';

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'not-configured' });
  }

  isEnabled(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  /** Neutral tools → Anthropic tool specs. */
  private toAnthropicTools(tools: ToolDefinition[]): Anthropic.Tool[] {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool.InputSchema,
    }));
  }

  /** Neutral conversation → Anthropic message params. */
  private toAnthropicMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
    const out: Anthropic.MessageParam[] = [];
    for (const m of messages) {
      if (m.role === 'user') {
        out.push({ role: 'user', content: m.content ?? '' });
      } else if (m.role === 'assistant') {
        const blocks: Anthropic.ContentBlockParam[] = [];
        if (m.content) blocks.push({ type: 'text', text: m.content });
        for (const call of m.toolCalls ?? []) {
          blocks.push({ type: 'tool_use', id: call.id, name: call.name, input: call.input });
        }
        out.push({ role: 'assistant', content: blocks });
      } else {
        // tool results are carried on a 'user' message in Anthropic's protocol
        const blocks: Anthropic.ContentBlockParam[] = (m.toolResults ?? []).map((r) => ({
          type: 'tool_result',
          tool_use_id: r.toolCallId,
          content: r.content,
          is_error: r.isError,
        }));
        out.push({ role: 'user', content: blocks });
      }
    }
    return out;
  }

  async *streamChat(opts: StreamChatOptions): AsyncIterable<StreamEvent> {
    const stream = this.client.messages.stream({
      model: assistantConfig.model,
      max_tokens: opts.maxTokens ?? assistantConfig.maxTokens,
      temperature: opts.temperature,
      system: opts.system,
      tools: this.toAnthropicTools(opts.tools),
      messages: this.toAnthropicMessages(opts.messages),
    });

    // Per-content-block accumulators keyed by block index.
    const blocks = new Map<number, { type: 'text' | 'tool_use'; id?: string; name?: string; json: string }>();
    let fullText = '';
    const toolCalls: ToolCall[] = [];
    let stopReason: StopReason = 'end_turn';
    let usage: { inputTokens: number; outputTokens: number } | undefined;

    try {
      for await (const event of stream) {
        switch (event.type) {
          case 'message_start':
            usage = {
              inputTokens: event.message.usage.input_tokens,
              outputTokens: 0,
            };
            break;

          case 'content_block_start': {
            const cb = event.content_block;
            if (cb.type === 'tool_use') {
              blocks.set(event.index, { type: 'tool_use', id: cb.id, name: cb.name, json: '' });
            } else if (cb.type === 'text') {
              blocks.set(event.index, { type: 'text', json: '' });
            }
            break;
          }

          case 'content_block_delta': {
            const d = event.delta;
            if (d.type === 'text_delta') {
              fullText += d.text;
              yield { type: 'text', text: d.text };
            } else if (d.type === 'input_json_delta') {
              const b = blocks.get(event.index);
              if (b) b.json += d.partial_json;
            }
            break;
          }

          case 'content_block_stop': {
            const b = blocks.get(event.index);
            if (b && b.type === 'tool_use' && b.id && b.name) {
              let input: Record<string, unknown> = {};
              try {
                input = b.json ? JSON.parse(b.json) : {};
              } catch (err) {
                logger.warn('Assistant: failed to parse tool_use input JSON', {
                  tool: b.name,
                  raw: b.json.slice(0, 500),
                });
              }
              const call: ToolCall = { id: b.id, name: b.name, input };
              toolCalls.push(call);
              yield { type: 'tool_call', call };
            }
            break;
          }

          case 'message_delta':
            if (event.delta.stop_reason) {
              stopReason = this.mapStopReason(event.delta.stop_reason);
            }
            if (usage) usage.outputTokens = event.usage.output_tokens;
            break;

          case 'message_stop':
          default:
            break;
        }
      }
    } catch (err) {
      logger.error('Anthropic stream failed', {
        message: err instanceof Error ? err.message : String(err),
      });
      stopReason = 'error';
    }

    yield { type: 'done', stopReason, text: fullText, toolCalls, usage };
  }

  private mapStopReason(reason: string | null): StopReason {
    switch (reason) {
      case 'tool_use':
        return 'tool_use';
      case 'max_tokens':
        return 'max_tokens';
      case 'end_turn':
      case 'stop_sequence':
        return 'end_turn';
      default:
        return 'end_turn';
    }
  }
}
