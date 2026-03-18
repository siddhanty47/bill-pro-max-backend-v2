# Share Link Architecture

## Overview

Share links allow businesses to generate read-only portal URLs for their parties (customers). A party visits `/share/:token` and can view challans, running items, bills, payments, and an aggregated summary — all without authentication. Access is controlled via a unique, revocable, optionally-expiring token.

## Request Flow

```
Party browser                         Backend
─────────────                         ───────
GET /share/:token
        │
        ▼
  ┌─────────────┐                ┌───────────────────┐
  │ Rate Limiter │──── 429 ────► │ 60 req/min/IP     │
  │ (express-    │               │ portalRateLimiter  │
  │  rate-limit) │               └───────────────────┘
  └──────┬──────┘
         ▼
  ┌──────────────────┐           ┌───────────────────┐
  │ ShareLink        │──────────►│ ShareLink         │
  │ Controller       │           │ Service            │
  │ (public handler) │◄──────────│ .resolveToken()   │
  └──────────────────┘           └─────────┬─────────┘
                                           │
                              ┌────────────┼────────────┐
                              ▼            ▼            ▼
                        ShareLink    Party/Business  Challan/Bill/
                        Repository   Repository     Payment Repository
                              │            │            │
                              ▼            ▼            ▼
                           MongoDB      MongoDB      MongoDB
```

Every portal request follows the same pattern:
1. Rate limiter checks IP (60 req/min)
2. Controller calls `service.resolveToken(token)` — validates token exists, is active, not expired
3. Service increments access count (fire-and-forget)
4. Controller calls the appropriate data method on the service
5. Service queries repositories, applies site-scoping if needed, strips internal fields, returns minimal data

## Backend Architecture

### Model: `ShareLink`

**File:** `src/models/ShareLink.ts`

| Field | Type | Description |
|-------|------|-------------|
| `businessId` | ObjectId | Owning business |
| `partyId` | ObjectId | Target party |
| `token` | string | Unique 256-bit hex (`crypto.randomBytes(32)`) |
| `siteCode` | string? | Restricts portal to a single site's data |
| `label` | string? | Human-readable label for management UI |
| `expiresAt` | Date? | Optional expiry timestamp |
| `status` | `active` \| `revoked` | Current link state |
| `createdBy` | string | Keycloak userId of creator |
| `lastAccessedAt` | Date? | Last portal access |
| `accessCount` | number | Total portal hits |

**Indexes:** `token` (unique), `businessId + partyId` (compound)

### Repository: `ShareLinkRepository`

**File:** `src/repositories/ShareLinkRepository.ts`

Extends `BaseRepository<IShareLink>`.

| Method | Description |
|--------|-------------|
| `findByToken(token)` | Look up link by token (returns `null` if revoked) |
| `findByParty(businessId, partyId)` | List all links for a party |
| `revokeLink(linkId)` | Set status to `revoked` |
| `incrementAccessCount(linkId)` | Atomically increment `accessCount` and set `lastAccessedAt` |

### Service: `ShareLinkService`

**File:** `src/services/ShareLinkService.ts`

The service is split into two groups:

**Management methods** (called by authenticated endpoints):

| Method | Description |
|--------|-------------|
| `createShareLink(businessId, partyId, input, createdBy)` | Validates party/site, generates 256-bit token, creates record |
| `getShareLinks(businessId, partyId)` | Returns all links for a party |
| `updateShareLink(linkId, businessId, input)` | Updates label and/or expiry with ownership validation |
| `revokeShareLink(linkId, businessId)` | Revokes with ownership validation, prevents double-revoke |

**Portal methods** (called by public endpoints):

| Method | Description |
|--------|-------------|
| `resolveToken(token)` | Validates token status + expiry, increments access (fire-and-forget). Throws `SHARE_LINK_INVALID` (404) or `SHARE_LINK_EXPIRED` (410) |
| `getPortalInfo(shareLink)` | Returns party name, business name, site scope |
| `getPortalChallans(shareLink, filters?)` | Paginated confirmed challans, site-scoped if applicable. Filters: `type`, `dateFrom`, `dateTo` |
| `getPortalRunningItems(shareLink)` | Net item quantities from delivery/return challans. Merges across agreements when site-scoped |
| `getPortalBills(shareLink, filters?)` | Paginated bills, site-scoped via agreementId filtering. Filters: `status` |
| `getPortalPayments(shareLink, filters?)` | Paginated payments for the party, sorted by date desc |
| `getPortalSummary(shareLink)` | Aggregated stats: outstanding, billed, paid, items in use, bill count, overdue count |
| `getPortalChallanPdf(shareLink, challanId)` | Generates PDF after validating challan belongs to party + site scope. Delegates to `ChallanService.generateChallanPdf` |
| `getPortalBillPdf(shareLink, billId)` | Same pattern, delegates to `BillingService.generateBillPdf` |

**Site scoping** (`getScopedAgreementIds`): When a link has `siteCode`, the service looks up agreements on the party matching that site code and restricts all queries (challans, bills, running items) to those agreement IDs. Payments are not site-scoped since they are recorded at the party level.

### Controller: `ShareLinkController`

**File:** `src/controllers/ShareLinkController.ts`

**Management handlers** (authenticated, OWNER/MANAGER role enforced):
- `createShareLink` — POST
- `getShareLinks` — GET
- `updateShareLink` — PATCH
- `revokeShareLink` — DELETE

**Portal handlers** (public, rate-limited):
- `getPortalInfo` — GET `:token`
- `getPortalChallans` — GET `:token/challans` (query params: `type`, `dateFrom`, `dateTo`, `page`, `pageSize`)
- `getPortalRunningItems` — GET `:token/running-items`
- `getPortalBills` — GET `:token/bills` (query params: `status`, `page`, `pageSize`)
- `getPortalPayments` — GET `:token/payments` (query params: `page`, `pageSize`)
- `getPortalSummary` — GET `:token/summary`
- `getPortalChallanPdf` — GET `:token/challans/:challanId/pdf`
- `getPortalBillPdf` — GET `:token/bills/:billId/pdf`

### Routes

**File:** `src/routes/v1/shareLink.ts`

```
Business-scoped (authenticated via authenticate + validateBusinessAccess):
  POST   /businesses/:businessId/parties/:partyId/share-links
  GET    /businesses/:businessId/parties/:partyId/share-links
  PATCH  /businesses/:businessId/parties/:partyId/share-links/:linkId
  DELETE /businesses/:businessId/parties/:partyId/share-links/:linkId

Public portal (portalRateLimiter: 60 req/min/IP):
  GET /share/:token
  GET /share/:token/challans
  GET /share/:token/running-items
  GET /share/:token/bills
  GET /share/:token/payments
  GET /share/:token/summary
  GET /share/:token/challans/:challanId/pdf
  GET /share/:token/bills/:billId/pdf
```

### Security Model

| Layer | Mechanism |
|-------|-----------|
| **Token entropy** | 256-bit random hex (`crypto.randomBytes(32)`) — infeasible to guess |
| **Rate limiting** | 60 req/min/IP on all public routes (429 `RATE_LIMIT_EXCEEDED`) |
| **Expiry** | Optional `expiresAt`; expired links return 410 `SHARE_LINK_EXPIRED` |
| **Revocation** | Setting status to `revoked` immediately invalidates; `findByToken` filters revoked |
| **Site scoping** | `siteCode` restricts visible data to a single site's agreements |
| **Read-only** | Portal routes are all GET — no mutations possible |
| **PDF ownership** | PDF downloads verify the document belongs to the party + site scope before generating |
| **Data minimization** | Portal responses strip internal fields (`businessId`, `partyId`, `agreementId`, etc.) |
| **Role enforcement** | Management endpoints require OWNER or MANAGER role |

### Data Minimization

Portal responses intentionally strip internal ObjectIds and fields. Each portal method maps full documents to a minimal shape:

- **Challans:** `_id` (for PDF download), `challanNumber`, `type`, `date`, `items` (name+qty only), `status`
- **Bills:** `_id` (for PDF download), `billNumber`, `billingPeriod`, `billDate`, `totalAmount`, `amountPaid`, `status`, `dueDate`
- **Payments:** `_id`, `amount`, `method`, `date`, `status`, `reference`, `notes`
- **Running items:** `itemName`, `quantity`

---

## Frontend Integration

### API Layer

**File:** `bill-pro-max-frontend/src/api/shareLinkApi.ts`

RTK Query API slice (`baseApi.injectEndpoints`) with auto-generated hooks:
- Management: `useGetShareLinksQuery`, `useCreateShareLinkMutation`, `useUpdateShareLinkMutation`, `useRevokeShareLinkMutation`
- Portal: `useGetPortalInfoQuery`, `useGetPortalChallansQuery`, `useGetPortalRunningItemsQuery`, `useGetPortalBillsQuery`, `useGetPortalPaymentsQuery`, `useGetPortalSummaryQuery`, `useLazyGetPortalChallanPdfQuery`, `useLazyGetPortalBillPdfQuery`

### Portal Types

**File:** `bill-pro-max-frontend/src/types/index.ts`

- `PortalInfo` — party/business names, site scope
- `PortalSummary` — aggregated financial stats + items breakdown
- `PortalChallan` — challan record with items array
- `PortalBill` — bill record with billing period, amounts, status
- `PortalPayment` — payment amount, method, date, status, reference, notes
- `PortalRunningItem` — item name + quantity

### UI Components

- **`SharedPortalPage.tsx`** (`/share/:token`) — Public page, no auth. Lazy-loads tab data (summary, challans, running items, bills, payments) as user navigates. Uses `DataTable`, `LoadingSpinner`, and global design system classes.
- **`ShareLinkManager.tsx`** (embedded in `PartyDetailPage`) — Authenticated management UI for creating, copying, and revoking share links.
