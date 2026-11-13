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
`list_overdue_bills`, `search_inventory`, `get_inventory_item`, `list_challans`, `get_bill`.

**Write** (confirmation-gated): `create_party`, `record_payment`, `adjust_stock`.

Each tool declares an RBAC `{ action, resource }` and `isWrite`. A tool is a thin
wrapper over an existing service method — so audit logging, validation, and
WebSocket events keep firing exactly as they do from REST.

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
| POST | `/businesses/:businessId/assistant/chat` | send a message, drive the agent |
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
loop or tool changes required.

## Not included (v1)

`create_challan` is intentionally omitted — creating a challan needs the
party/item/agreement resolution that lives in the photo-scan extraction pipeline;
a half-resolved version would let the model invent item ids. Add it once that
resolution is reusable as a tool.
