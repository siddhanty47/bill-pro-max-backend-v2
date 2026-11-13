/**
 * @file Conversation model
 * @description Persisted chat history for the AI assistant. One document per
 * conversation, scoped to a business + user (multi-tenant). Stores the neutral
 * message sequence (user/assistant/tool) plus any write action awaiting user
 * confirmation, so a paused turn can be resumed statelessly.
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/** A tool call the model requested. */
export interface IConvToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** The result of running a tool, fed back to the model. */
export interface IConvToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

/** One message in the conversation (neutral shape, provider-agnostic). */
export interface IConversationMessage {
  role: 'user' | 'assistant' | 'tool';
  content?: string;
  toolCalls?: IConvToolCall[];
  toolResults?: IConvToolResult[];
  createdAt: Date;
}

/** A write action proposed by the model, held until the user confirms. */
export interface IPendingAction {
  /** The batch of tool calls to run on approval (may include reads + one/more writes). */
  toolCalls: IConvToolCall[];
  /** Human-readable summary shown in the confirm prompt. */
  summary: string;
  createdAt: Date;
}

export interface IConversation extends Document {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  /** Owning user (Supabase/local user id). */
  userId: string;
  title?: string;
  messages: IConversationMessage[];
  pendingAction?: IPendingAction | null;
  createdAt: Date;
  updatedAt: Date;
}

const ToolCallSchema = new Schema<IConvToolCall>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    input: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const ToolResultSchema = new Schema<IConvToolResult>(
  {
    toolCallId: { type: String, required: true },
    content: { type: String, required: true },
    isError: { type: Boolean, default: false },
  },
  { _id: false }
);

const MessageSchema = new Schema<IConversationMessage>(
  {
    role: { type: String, enum: ['user', 'assistant', 'tool'], required: true },
    content: { type: String },
    toolCalls: { type: [ToolCallSchema], default: undefined },
    toolResults: { type: [ToolResultSchema], default: undefined },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const PendingActionSchema = new Schema<IPendingAction>(
  {
    toolCalls: { type: [ToolCallSchema], required: true },
    summary: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ConversationSchema = new Schema<IConversation>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    userId: { type: String, required: true, index: true },
    title: { type: String },
    messages: { type: [MessageSchema], default: [] },
    pendingAction: { type: PendingActionSchema, default: null },
  },
  { timestamps: true }
);

// Primary access pattern: a user's conversations within a business, most recent first.
ConversationSchema.index({ businessId: 1, userId: 1, updatedAt: -1 });

export const Conversation: Model<IConversation> = mongoose.model<IConversation>(
  'Conversation',
  ConversationSchema
);
