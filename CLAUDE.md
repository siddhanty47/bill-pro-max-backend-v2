# BillProMax Backend

Express.js backend for scaffolding rental business management. See README.md for setup and API docs. This file focuses on architecture patterns and change guidance.

## Layered Architecture

```
Controller  →  Service  →  Repository  →  Model (Mongoose)
```

- **Controllers** (`src/controllers/`): Parse HTTP request, call service, format response. No business logic.
- **Services** (`src/services/`): All business logic lives here. Orchestrate cross-entity operations, call repositories.
- **Repositories** (`src/repositories/`): Data access only. Extend `BaseRepository` (`src/repositories/BaseRepository.ts`) which provides generic CRUD + pagination.
- **Models** (`src/models/`): Mongoose schema definitions. 16 collections.

When adding logic, put it in the service layer. Controllers should be thin.

## Middleware Chain (Order Matters)

**Global middleware** (applied to all routes in `src/server.ts`):
1. `helmet` — Security headers
2. `cors` — Cross-origin config
3. `requestLogger` — Winston request logging
4. `express.json()` — Body parser

**Per-route middleware** (applied in route files `src/routes/v1/*.ts`):
1. `authenticate` — Verify Supabase JWT, set `req.user`
2. `validate(schema)` — Zod validation of body/params/query
3. `requireRoles(...)` / `requirePermission(...)` — RBAC check
4. `validateBusinessAccess` — Multi-tenant isolation (extracts `businessId`, verifies membership)
5. Controller handler

**Critical:** NEVER skip `validateBusinessAccess` on business-scoped routes. This enforces multi-tenant data isolation.

## Multi-Tenancy

- Every business-scoped document has a `businessId` field
- `businessScope.ts` middleware extracts `businessId` from URL params and verifies user has access
- **All repository queries for business-scoped entities MUST filter by `businessId`**
- Route structure in `src/routes/v1/index.ts`:
  - **Standalone** (no business scope): `/auth`, `/gstin`, `/invitations`, `/share`, `/notifications`, `/presets`
  - **Business-nested**: `/businesses/:businessId/parties`, `/inventory`, `/challans`, `/bills`, `/payments`, `/reports`, `/agreements`, `/gstin`, `/members`, `/invitations`, `/employees`, `/presets`, and `/parties/:partyId/share-links`

## Auth System

- Supabase JWT (ES256) verified via JWKS public key endpoint
- JWKS key cached 1 hour, auto-refreshes on key rotation (`src/middleware/supabaseAuth.ts`)
- User lookup uses LRU cache (500 entries, 60s TTL) to avoid DB query per request
- `authenticate` middleware sets `req.user: AuthenticatedUser`
- `authenticateOptional` allows unauthenticated access (used for public share link routes)
- User sync: `POST /auth/sync` creates/updates local User document from Supabase JWT claims

## RBAC

Roles defined in `src/config/roles.ts`:

| Role | Hierarchy Level | Scope |
|------|----------------|-------|
| `owner` | Highest | Full business management |
| `manager` | Below owner | Manage entities, limited billing |
| `staff` | Below manager | Create/update challans, read-only for rest |
| `accountant` | Parallel to staff | Financial data (bills, payments, reports) |
| `viewer` | Lowest | Read-only access |
| `client-portal` | External | Party-specific read access via share links |

**Role is per-BusinessMember, not per-User.** A user can have different roles in different businesses.

Middleware: `requireRoles('owner', 'manager')`, `requirePermission('create', 'bill')`.

## Billing Engine

Three components work together:

1. **`src/billing/BillingCalculator.ts`** — Pure calculation logic. Computes rental days, quantities, rates, taxes (SGST/CGST/IGST), discounts, totals. No side effects.
2. **`src/billing/InvoiceGenerator.ts`** — Generates PDFs using React-PDF. Renders templates from `src/templates/`.
3. **`src/services/BillingService.ts`** — Orchestrator. Fetches data (party, agreements, challans) -> calls BillingCalculator -> calls InvoiceGenerator -> saves bill.

**Utilities:** `src/billing/utils/dateUtils.ts` (rental day calculations), `src/billing/utils/mathUtils.ts` (financial rounding).

**Templates:** `src/templates/invoice.tsx`, `src/templates/challan.tsx` — React-PDF components.

To change **calculation logic**: modify `BillingCalculator.ts`.
To change **PDF layout**: modify templates in `src/templates/`.
To change **billing workflow**: modify `BillingService.ts`.

## Background Jobs

Bull queues backed by Redis. Files in `src/jobs/`:

| File | Queue | Purpose |
|------|-------|---------|
| `scheduler.ts` | — | Cron schedule setup, queue initialization |
| `billingJob.ts` | `billingQueue` | Monthly billing (1st, 00:00), overdue checks (daily, 09:00), async single/bulk bill generation |
| `notificationJob.ts` | `notificationQueue` | Email sending via Resend |
| `reminderJob.ts` | `reminderQueue` | Payment due reminders (daily, 10:00) |
| `batchTracker.ts` | — | Tracks bulk bill generation progress, emits WebSocket events |

Jobs emit WebSocket events for real-time progress updates (e.g., bulk bill generation progress).

Controlled by `ENABLE_SCHEDULED_JOBS` env var. Redis URL from `REDIS_URL` env var.

## Error Handling

Custom error classes in `src/middleware/errorHandler.ts`:

| Class | Status | Code |
|-------|--------|------|
| `AppError` | any | any |
| `ValidationError` | 400 | `VALIDATION_ERROR` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` |
| `ForbiddenError` | 403 | `FORBIDDEN` |
| `ConflictError` | 409 | `CONFLICT` |

**Always throw typed errors from services.** The centralized `errorHandler` middleware catches them and formats a consistent response:
```json
{ "success": false, "error": { "code": "...", "message": "..." }, "timestamp": "..." }
```

## Adding a New Entity

1. Create model: `src/models/NewEntity.ts` (follow pattern from `Party.ts` — include `businessId` if business-scoped)
2. Create repository: `src/repositories/NewEntityRepository.ts` extending `BaseRepository`
3. Create service: `src/services/NewEntityService.ts`
4. Create controller: `src/controllers/NewEntityController.ts`
5. Create route: `src/routes/v1/newEntity.ts` (apply middleware: `authenticate`, `validate`, `requireRoles`, `validateBusinessAccess`)
6. Register in `src/routes/v1/index.ts` under business-nested or standalone section
7. Add Zod schemas to `src/types/api.ts`
8. **Then update frontend** — see root `CLAUDE.md` for full-stack checklist

## Regression Risks

- **Model schema changes**: Existing MongoDB documents keep the old shape. New required fields need defaults or must be optional. No auto-migration.
- **Route URL changes**: Breaks frontend API calls. Search `bill-pro-max-frontend/src/api/` for the URL pattern before changing.
- **Response field removal/rename**: Frontend components destructure response data. Check corresponding frontend type in `types/index.ts`.
- **Validation schema changes**: Frontend forms may submit data that now fails stricter validation. Keep Zod schemas in sync.
- **WebSocket event changes**: Frontend hooks depend on event names and payload shapes. Check `bill-pro-max-frontend/src/hooks/`.
- **Middleware order changes**: Can silently break auth or business scoping. The chain is: authenticate -> validate -> RBAC -> businessScope -> controller.
