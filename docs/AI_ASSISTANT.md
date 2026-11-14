# AI Assistant

Conversational assistant embedded in the app. Answers questions about a business's
data and performs actions, by letting an LLM call tools that wrap the existing
service layer. Provider-abstracted (Anthropic today; OpenAI adapter stubbed).

## Request flow

```
Frontend chat  ──POST /businesses/:businessId/assistant/chat {message, conversationId?}
     │          (authenticate → validateBusinessAccess → requirePermission('read','business'))
     ▼
AssistantController ── builds { businessId, businessName, user } context
     ▼
AssistantService.sendMessage ── the agentic loop:
     │   1. load/create Conversation, append user message
     │   2. provider.streamChat(system, messages, tools)  ── streams text deltas → WebSocket
     │   3. on tool_use: for each call → RBAC check → run handler → collect result
     │   4. feed tool results back, repeat (until end_turn or iteration cap)
     ▼
ToolRegistry ── tools wrap PartyService / InventoryService / ChallanService /
                BillingService / StatementService / PaymentService
```

Live tokens stream over WebSocket (`user:${userId}` room); the HTTP response carries
the authoritative final result for the client cache.

## Components

| Layer | Path |
|-------|------|
| Provider seam | `services/assistant/llm/` — `types.ts` (neutral chat/tool/stream), `LLMProvider`, `AnthropicProvider`, `OpenAIProvider` (stub), `index.ts` (factory) |
| Tools | `services/assistant/tools/` — `readTools.ts`, `writeTools.ts`, `types.ts`; `services/assistant/ToolRegistry.ts` |
| Loop | `services/AssistantService.ts` |
| Persistence | `models/Conversation.ts` |
| HTTP | `controllers/AssistantController.ts`, `routes/v1/assistant.ts` |
| Config | `config/index.ts` → `assistantConfig` |

## Tools

**Read** (auto-run): `search_parties`, `get_party_ledger`, `get_outstanding_balance`,
`list_overdue_bills`, `search_inventory`, `get_inventory_item`, `list_challans`,
`get_bill`, `extract_challan_from_photo`.

**Write** (confirmation-gated): `create_party`, `record_payment`, `adjust_stock`,
`create_challan`.

Each tool declares an RBAC `{ action, resource }` and `isWrite`. A tool is a thin
wrapper over an existing service method — so audit logging, validation, and
WebSocket events keep firing exactly as they do from REST.

## Voice & photo input

- **Voice**: the user records a note; `POST …/assistant/transcribe` runs it through
  the configured speech provider (OpenAI, `gpt-4o-mini-transcribe`) and returns `{ text }`. The
  frontend drops the transcript in the chat box for review — it is never auto-sent.
  Provider seam: `services/assistant/speech/` (mirrors the LLM seam).
- **Photo (vision)**: images attach to the `chat` request (multipart `images`).
  They're sent to the model as vision input on the turn they're uploaded. Bytes are
  held in memory for that turn only — the Conversation stores a metadata marker, not
  the image (keeps docs small, bounds token cost; older turns aren't re-sent).
- **Challan from photo**: when the user attaches a delivery/return challan and asks
  to add it, the model calls `extract_challan_from_photo` (runs the existing
  vision + semantic-match pipeline on the in-memory image → catalog-resolved draft),
  summarises it, then calls `create_challan` (confirmation-gated). Because the ids
  come from extraction, the model never invents them — this is the resolution v1 was
  waiting on before `create_challan` could be exposed.

## Security model

- **Per-tool RBAC**: before a tool runs, `userHasPermission(user, action, resource)`
  is checked against the user's per-business role — the same check REST routes use.
  A denied tool returns an error result the model relays; it does not mutate.
- **Write-confirmation gate**: if a model turn requests any write tool, the loop
  pauses, persists the proposed batch as `pendingAction`, and returns
  `awaiting_confirmation`. Nothing mutates until the user approves via
  `POST …/assistant/confirm { approve: true }`. `ToolContext.confirmed` guards the
  handler as a second line of defense.
- **Multi-tenancy**: every tool query is scoped by `businessId`.
- **Iteration cap**: `assistantConfig.maxToolIterations` bounds tool rounds per turn.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/businesses/:businessId/assistant/chat` | send a message (+ optional `images`, multipart), drive the agent |
| POST | `/businesses/:businessId/assistant/transcribe` | voice note (`audio` file) → `{ text }` |
| POST | `/businesses/:businessId/assistant/confirm` | approve/decline a pending write |
| GET | `/businesses/:businessId/assistant/conversations` | list the user's conversations |
| GET | `/businesses/:businessId/assistant/conversations/:conversationId` | full history |

## Configuration

```bash
ASSISTANT_PROVIDER=anthropic              # anthropic | openai
ASSISTANT_MODEL=claude-haiku-4-5-20251001 # defaults to ANTHROPIC_MODEL, then the vision model
ASSISTANT_MAX_TOKENS=4096
ASSISTANT_MAX_TOOL_ITERATIONS=8
ASSISTANT_HISTORY_WINDOW=20               # prior messages sent as context

# Voice input (speech-to-text)
ASSISTANT_STT_PROVIDER=openai                 # openai
ASSISTANT_STT_MODEL=gpt-4o-mini-transcribe    # or whisper-1, gpt-4o-transcribe
# reuses OPENAI_API_KEY (same key as semantic embeddings)
```

The default model is the one already used for photo-scan vision (guaranteed account
access). Bump `ASSISTANT_MODEL` to a stronger reasoning tier once access is confirmed.

## Adding a tool

1. Define an `AssistantTool` in `readTools.ts` or `writeTools.ts`: `name`,
   `description`, JSON-schema `parameters`, `perm { action, resource }`, `isWrite`,
   and a `handler` that calls the relevant service.
2. Register it in `ToolRegistry.ts`.
3. Write tools must accept confirmation (the loop gates them) and pass `performer`
   so the mutation is audit-logged.

## Provider abstraction

The loop speaks only the neutral types in `llm/types.ts`. To add a provider,
implement `LLMProvider.streamChat` (translate neutral messages/tools to the vendor
wire format and re-emit neutral `StreamEvent`s) and wire it into the factory. No
loop or tool changes required. The speech-to-text provider uses the same seam
pattern under `services/assistant/speech/`.
