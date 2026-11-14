/**
 * @file AssistantService
 * @description The conversational agent's control loop. Drives a provider-neutral
 * LLM through a tool-use cycle: stream text → run requested tools (RBAC-checked,
 * write-gated) → feed results back → repeat until the model ends its turn. All
 * live output is streamed to the user over WebSocket; the full exchange is
 * persisted to the Conversation document so a paused (awaiting-confirmation) turn
 * can be resumed statelessly.
 */

import { Types } from 'mongoose';
import { assistantConfig } from '../config';
import { logger } from '../utils/logger';
import { getIO } from '../websocket';
import { NotFoundError } from '../middleware';
import { BusinessScopedUser } from '../middleware/businessScope';
import { Conversation, IConversation, IConversationMessage, IConvAttachment } from '../models/Conversation';
import { getLLMProvider, ChatMessage, ToolCall, ImagePart, ImageMediaType } from './assistant/llm';
import { toolRegistry } from './assistant/ToolRegistry';
import { ToolContext, ToolAttachment } from './assistant/tools/types';

/** Media types we can send to the model as inline vision input. */
const VISION_MEDIA_TYPES: ImageMediaType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Context for a single assistant turn. */
export interface AssistantRunContext {
  businessId: string;
  businessName?: string;
  user: BusinessScopedUser;
}

/** Outcome of driving the loop. */
export type AssistantRunResult =
  | { status: 'completed'; conversationId: string; message: string }
  | {
      status: 'awaiting_confirmation';
      conversationId: string;
      action: { summary: string; calls: Array<{ name: string; input: Record<string, unknown> }> };
    }
  | { status: 'error'; conversationId: string; error: string };

export class AssistantService {
  private provider = getLLMProvider();

  // ---- public API ------------------------------------------------------------

  /**
   * Start (or continue) a conversation with a new user message. `attachments`
   * are files uploaded with this turn (images for vision / challan photos); their
   * bytes are held in memory for this turn only — the conversation stores just a
   * metadata marker.
   */
  async sendMessage(
    ctx: AssistantRunContext,
    conversationId: string | undefined,
    userMessage: string,
    attachments: ToolAttachment[] = []
  ): Promise<AssistantRunResult> {
    if (!this.provider.isEnabled()) {
      throw new NotFoundError('AI assistant is not configured (missing provider API key).');
    }

    const convo = conversationId
      ? await this.loadConversation(ctx, conversationId)
      : await Conversation.create({
          businessId: new Types.ObjectId(ctx.businessId),
          userId: ctx.user.id,
          title: this.deriveTitle(userMessage || 'Photo'),
          messages: [],
        });

    const markers: IConvAttachment[] = attachments.map((a) => ({
      kind: a.kind,
      mediaType: a.mimeType,
      filename: a.filename,
    }));
    convo.messages.push({
      role: 'user',
      content: userMessage,
      attachments: markers.length ? markers : undefined,
      createdAt: new Date(),
    });
    await convo.save();

    return this.drive(ctx, convo, attachments);
  }

  /**
   * Resolve a pending write action: run it (approve) or decline it, then let the
   * model continue the turn.
   */
  async confirmAction(
    ctx: AssistantRunContext,
    conversationId: string,
    approve: boolean
  ): Promise<AssistantRunResult> {
    const convo = await this.loadConversation(ctx, conversationId);
    const pending = convo.pendingAction;
    if (!pending) {
      throw new NotFoundError('No action awaiting confirmation for this conversation.');
    }

    const calls: ToolCall[] = pending.toolCalls.map((c) => ({ id: c.id, name: c.name, input: c.input }));
    convo.pendingAction = null;

    if (!approve) {
      const declined = calls.map((c) => ({
        toolCallId: c.id,
        content: JSON.stringify({ declined: true, reason: 'User declined this action.' }),
        isError: false,
      }));
      convo.messages.push({ role: 'tool', toolResults: declined, createdAt: new Date() });
      await convo.save();
      return this.drive(ctx, convo);
    }

    // Approved — execute the batch with confirmation granted.
    const results = await this.executeBatch(calls, { ...this.toToolContext(ctx), confirmed: true }, conversationId);
    convo.messages.push({ role: 'tool', toolResults: results, createdAt: new Date() });
    await convo.save();
    return this.drive(ctx, convo);
  }

  // ---- core loop -------------------------------------------------------------

  private async drive(
    ctx: AssistantRunContext,
    convo: IConversation,
    attachments: ToolAttachment[] = []
  ): Promise<AssistantRunResult> {
    const convoId = convo._id.toString();
    const system = this.buildSystemPrompt(ctx);
    // Vision input for THIS turn only — attached to the latest user message.
    const liveImages = this.toImageParts(attachments);

    for (let iteration = 0; iteration < assistantConfig.maxToolIterations; iteration++) {
      const messages = this.toChatMessages(convo.messages, liveImages);

      // --- stream one model turn ---
      let assistantText = '';
      let toolCalls: ToolCall[] = [];
      let stopReason: string = 'end_turn';
      try {
        for await (const ev of this.provider.streamChat({
          system,
          messages,
          tools: toolRegistry.definitions(),
        })) {
          if (ev.type === 'text') {
            this.emit(ctx.user.id, 'assistant:delta', { conversationId: convoId, text: ev.text });
          } else if (ev.type === 'done') {
            assistantText = ev.text;
            toolCalls = ev.toolCalls;
            stopReason = ev.stopReason;
          }
        }
      } catch (err) {
        return this.fail(ctx, convoId, err);
      }

      // persist the assistant turn (text + any tool requests)
      convo.messages.push({
        role: 'assistant',
        content: assistantText || undefined,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        createdAt: new Date(),
      });
      await convo.save();

      // no tools requested → turn is done
      if (stopReason !== 'tool_use' || toolCalls.length === 0) {
        this.emit(ctx.user.id, 'assistant:message', {
          conversationId: convoId,
          message: assistantText,
        });
        return { status: 'completed', conversationId: convoId, message: assistantText };
      }

      // confirmation gate: if the batch contains a write the user hasn't approved, pause
      const needsConfirm = toolCalls.some((c) => {
        const t = toolRegistry.get(c.name);
        return t?.isWrite;
      });
      if (needsConfirm) {
        const summary = this.describeActions(toolCalls);
        convo.pendingAction = {
          toolCalls: toolCalls.map((c) => ({ id: c.id, name: c.name, input: c.input })),
          summary,
          createdAt: new Date(),
        };
        await convo.save();
        const action = {
          summary,
          calls: toolCalls.map((c) => ({ name: c.name, input: c.input })),
        };
        this.emit(ctx.user.id, 'assistant:confirm', { conversationId: convoId, action });
        return { status: 'awaiting_confirmation', conversationId: convoId, action };
      }

      // all read tools → execute and feed back, then loop
      const results = await this.executeBatch(
        toolCalls,
        { ...this.toToolContext(ctx), confirmed: false, attachments },
        convoId
      );
      convo.messages.push({ role: 'tool', toolResults: results, createdAt: new Date() });
      await convo.save();
    }

    // iteration cap hit
    const msg = 'The assistant reached its step limit for this request. Please refine and try again.';
    this.emit(ctx.user.id, 'assistant:error', { conversationId: convoId, error: msg });
    return { status: 'error', conversationId: convoId, error: msg };
  }

  /** Run a batch of tool calls, enforcing RBAC per tool. Returns neutral tool results. */
  private async executeBatch(
    calls: ToolCall[],
    ctx: ToolContext,
    conversationId: string
  ): Promise<IConversationMessage['toolResults']> {
    const results: NonNullable<IConversationMessage['toolResults']> = [];
    for (const call of calls) {
      const tool = toolRegistry.get(call.name);
      if (!tool) {
        results.push({ toolCallId: call.id, content: JSON.stringify({ error: `Unknown tool: ${call.name}` }), isError: true });
        continue;
      }
      if (!toolRegistry.isAllowed(tool, ctx.user)) {
        results.push({
          toolCallId: call.id,
          content: JSON.stringify({ error: `Permission denied: your role cannot ${tool.perm.action} ${tool.perm.resource}.` }),
          isError: true,
        });
        continue;
      }
      if (tool.isWrite && !ctx.confirmed) {
        // Should not happen (gate handled upstream), but never mutate unconfirmed.
        results.push({ toolCallId: call.id, content: JSON.stringify({ error: 'Write action was not confirmed.' }), isError: true });
        continue;
      }
      this.emit(ctx.user.id, 'assistant:tool', { conversationId, name: tool.name, status: 'running' });
      try {
        const out = await tool.handler(call.input, ctx);
        results.push({ toolCallId: call.id, content: JSON.stringify(out ?? null), isError: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Tool execution failed';
        logger.warn('Assistant tool failed', { tool: tool.name, error: message });
        results.push({ toolCallId: call.id, content: JSON.stringify({ error: message }), isError: true });
      }
    }
    return results;
  }

  // ---- helpers ---------------------------------------------------------------

  private async loadConversation(ctx: AssistantRunContext, conversationId: string): Promise<IConversation> {
    if (!Types.ObjectId.isValid(conversationId)) throw new NotFoundError('Conversation');
    const convo = await Conversation.findOne({
      _id: conversationId,
      businessId: new Types.ObjectId(ctx.businessId),
      userId: ctx.user.id,
    });
    if (!convo) throw new NotFoundError('Conversation');
    return convo;
  }

  private toToolContext(ctx: AssistantRunContext): ToolContext {
    return { businessId: ctx.businessId, user: ctx.user, confirmed: false };
  }

  /**
   * Map persisted messages → neutral ChatMessages, trimmed to the history window.
   * `liveImages` (the current turn's uploaded images) are attached to the most
   * recent user message so the model sees them as vision input. Older messages'
   * image bytes aren't retained — only this turn's are sent.
   */
  private toChatMessages(messages: IConversationMessage[], liveImages: ImagePart[] = []): ChatMessage[] {
    const windowed = messages.slice(-assistantConfig.historyWindow);
    const mapped: ChatMessage[] = windowed.map((m) => ({
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls?.map((c) => ({ id: c.id, name: c.name, input: c.input })),
      toolResults: m.toolResults?.map((r) => ({ toolCallId: r.toolCallId, content: r.content, isError: r.isError })),
    }));

    if (liveImages.length) {
      for (let i = mapped.length - 1; i >= 0; i--) {
        if (mapped[i].role === 'user') {
          mapped[i].images = liveImages;
          break;
        }
      }
    }
    return mapped;
  }

  /** Turn in-memory image uploads into neutral vision parts (non-images ignored). */
  private toImageParts(attachments: ToolAttachment[]): ImagePart[] {
    return attachments
      .filter((a) => a.kind === 'image' && VISION_MEDIA_TYPES.includes(a.mimeType as ImageMediaType))
      .map((a) => ({
        mediaType: a.mimeType as ImageMediaType,
        dataBase64: a.buffer.toString('base64'),
      }));
  }

  private buildSystemPrompt(ctx: AssistantRunContext): string {
    const today = new Date().toISOString().slice(0, 10);
    return [
      'You are the BillProMax assistant, embedded in a scaffolding/equipment rental business management app.',
      `Business: ${ctx.businessName || 'the current business'}. User: ${ctx.user.name} (role: ${ctx.user.businessRole || 'member'}). Today: ${today}.`,
      '',
      'Your job: answer questions about this business\'s data and perform actions, using the provided tools.',
      'Rules:',
      '- ALWAYS use tools to fetch real data. Never invent parties, items, bills, amounts, or ids.',
      '- Resolve names to ids with the search tools before calling id-based tools.',
      '- Amounts are in INR. Dates are ISO (YYYY-MM-DD). Be concise and use simple tables/bullets.',
      '- For actions that change data, call the appropriate write tool; the system will ask the user to confirm before it runs. Do not claim an action is done until a tool result confirms it.',
      '- If a tool returns a permission error, tell the user their role lacks access — do not retry.',
      '- If you lack enough information (e.g. which party), ask a brief clarifying question instead of guessing.',
      '- Photos: when the user attaches an image, you can see it. If it is a delivery/return challan and they want to add it, call extract_challan_from_photo to get a catalog-resolved draft, show them a short summary (party, items, quantities, warnings), then call create_challan to save it. For any other photo, just look at it and answer. Never call create_challan with ids you did not get from a tool result.',
    ].join('\n');
  }

  /** Build a human-readable confirmation summary for a batch of (write) tool calls. */
  private describeActions(calls: ToolCall[]): string {
    return calls
      .map((c) => {
        const t = toolRegistry.get(c.name);
        const label = t?.description?.split('.')[0] || c.name;
        return `${label} — ${JSON.stringify(c.input)}`;
      })
      .join('; ');
  }

  private deriveTitle(firstMessage: string): string {
    const t = firstMessage.trim().replace(/\s+/g, ' ');
    return t.length > 60 ? `${t.slice(0, 57)}…` : t || 'New conversation';
  }

  private fail(ctx: AssistantRunContext, conversationId: string, err: unknown): AssistantRunResult {
    const error = err instanceof Error ? err.message : 'Assistant request failed';
    logger.error('Assistant run failed', { conversationId, error });
    this.emit(ctx.user.id, 'assistant:error', { conversationId, error });
    return { status: 'error', conversationId, error };
  }

  private emit(userId: string, event: string, payload: Record<string, unknown>): void {
    try {
      getIO().to(`user:${userId}`).emit(event, payload);
    } catch {
      // WebSocket not initialized (e.g. scripts/tests) — streaming is best-effort.
    }
  }
}
