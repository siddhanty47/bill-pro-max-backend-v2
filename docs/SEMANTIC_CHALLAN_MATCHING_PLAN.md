# Semantic Challan Matching — Implementation Plan

Branch: `feature/semantic-challan-matching` (backend + frontend worktrees)

## Goal

Replace "dump whole catalog into the vision prompt and let Claude fuzzy-match"
with a **retrieve-then-confirm** pipeline:

1. Vision extracts raw verbatim text (no matching).
2. Hybrid semantic search (MongoDB Atlas Vector Search + lexical) narrows each
   extracted field to top-K candidates, scoped per business.
3. A cheap text-only LLM call picks the final `itemId` / `partyId` /
   `agreementId` from those candidates.

Wins: cheaper prompts at scale, better recall on messy handwriting, and a fix
for the size↔quantity mapping errors (the #1 pain).

## Scale assumptions (per business)

~100 items, ~100 parties, 2000–5000 challans/year. Only the **catalog**
(items + parties + sites ≈ 200 vectors/business) is embedded. Challans are
queries, never stored vectors. Tiny index — no dedicated vector DB needed.

## Response contract (unchanged + 2 new fields)

`ExtractedChallanData` keeps its current shape. **Add**:
- `partyGstin: string | null` — raw GSTIN/PAN from challan (exact party key)
- `siteAddress: string | null` — raw site address (agreement/site key)

Everything else (type, challanNumber, date, partyName, partyId, agreementId,
items[], damagedItems[], transporterName, vehicleNumber, cartageAmount,
confidence, warnings) stays. Frontend `types/index.ts` + `applyExtractedData()`
get the two new fields. No other frontend change required beyond displaying
them.

## Pipeline detail

```
upload photo
  → CALL 1 (Claude vision, Haiku): extract RAW, no matching
      items: [{ line, sizeTokens:[...], subQtys:[...], lineTotalQty }]
      partyNameRaw, partyGstinRaw, siteAddressRaw, officeAddressRaw, ...
  → EmbeddingService.embed(each atomic token / name / address)   [OpenAI]
  → EntityMatchingService: Atlas $vectorSearch (filter businessId) + lexical
      → top-K candidates per field (hybrid, RRF-fused)
  → CALL 2 (Claude, Haiku, TEXT-only): raw extraction + candidate lists
      → final ExtractedChallanData (ids + confidence + warnings)
  → frontend applyExtractedData()
```

- **Per-field retrieval**, **single LLM confirm call** (all fields at once —
  keeps cross-field context: agreement depends on chosen party+site).
- Call 2 is text-only to start. Add image to call 2 behind a config flag only
  if accuracy proves insufficient. Measure first.

## Size↔quantity fix (checksum)

Observed on sample: `LADHER 1.5MTR + 1MTR + .850MTR` with sub-qtys
`193 / 10 / 21` and a Qty/Unit total `224`; `193+10+21 = 224`.

Call-1 prompt rules:
- Split a multi-size row into N items, pairing size token `i` → sub-qty `i`.
- Emit the row's Qty/Unit total as `lineTotalQty`.
- Validate `sum(subQtys) == lineTotalQty`. Match → high confidence. Mismatch →
  warning + low confidence (never silently guess).
- Preserve positional order so call-2 maps token `i` → candidate item `i`.

## Hybrid matching rules (per entity)

| Entity | Vector embed text | Lexical / exact keys |
|--------|-------------------|----------------------|
| Inventory item | `code + name + description` | code exact; size tokens (2x2, 3mtr) |
| Party | `name + officeAddress` | **GSTIN exact → short-circuit**; name trigram |
| Site | `siteAddress (+ site name/code)` | sector/pincode tokens |

Fusion: run vector search + lexical query, merge with Reciprocal Rank Fusion in
app. Party GSTIN exact match wins outright (skip vector).

## Atlas Vector Search indexes (USER creates via UI)

DB `billpromax`, type **Vector Search**, JSON:
```json
{ "fields": [
  { "type": "vector", "path": "embedding", "numDimensions": 1536, "similarity": "cosine" },
  { "type": "filter", "path": "businessId" }
] }
```
| Collection | Index name |
|-----------|-----------|
| `inventories` | `inventory_vector_index` |
| `parties` | `party_vector_index` |
| `sites` | `site_vector_index` (after model is pushed) |

## Config / env (backend)

- `OPENAI_API_KEY` (new, gitignored) — from user
- `OPENAI_EMBEDDING_MODEL=text-embedding-3-small` (default)
- `EMBEDDING_DIMENSIONS=1536` (default)
- Existing `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` reused for both vision calls.

## Build order (phases)

**Phase 0 — infra**
- Config entries + OpenAI client wrapper.
- `EmbeddingService` (embed one/many strings, batch, retry).

**Phase 1 — data model + embeddings**
- Add `embedding: number[]` (+ `embeddingUpdatedAt`) to Inventory, Party.
- Verify/add Party `gstin` + `officeAddress`; create flattened `Site` model/
  collection (siteAddress, businessId, agreementId, partyId, embedding).
- Embed-on-write: fire-and-forget hook in Inventory/Party/Agreement services
  (same pattern as audit logging). Add `performer`-style optional, non-blocking.
- Backfill script: embed existing 109 items + parties + sites.

**Phase 2 — retrieval**
- `EntityMatchingService` + repo `$vectorSearch` methods (filter businessId,
  numCandidates ~100, limit K ~8). Lexical queries + RRF fusion. GSTIN exact
  short-circuit.

**Phase 3 — extraction refactor**
- Split `ChallanExtractionService` into `extractRaw()` (call 1, new prompt +
  checksum + GSTIN/siteAddress) and `resolveMatches()` (call 2, text-only).
- New Zod schemas for raw extraction + final output (+ 2 new fields).
- Controller orchestrates: extractRaw → match → resolve.

**Phase 4 — frontend**
- `ExtractedChallanData` + `ExtractedChallanItem` types: add `partyGstin`,
  `siteAddress`. `applyExtractedData()` populate. Show GSTIN/site in review UI.
- PartyForm: add GSTIN + office address fields if not already present (needed so
  the party catalog actually has GSTIN/address to match against).

**Phase 5 — validation**
- Run both sample challans end-to-end; verify size-split checksum, GSTIN exact
  party match, site→agreement match. Tune K and prompts.

## Open items / risks

- `$vectorSearch` requires the Atlas indexes ACTIVE before retrieval works;
  code must degrade gracefully (fall back to lexical) if index missing.
- Embedding cost is negligible at this scale but add simple caching / skip if
  text unchanged (hash compare) to avoid re-embedding on no-op updates.
- Keep the extraction output contract stable so the frontend ChallanForm keeps
  working through the refactor.
