/**
 * @file Challan Extraction Service
 * @description Two-stage pipeline that turns a photographed handwritten challan
 * into structured, catalog-matched data:
 *
 *   1. extractRaw()      — Claude Vision reads the page verbatim (no catalog).
 *                          Splits multi-size rows and validates sub-quantities
 *                          against the row total (checksum).
 *   2. EntityMatching    — hybrid semantic search narrows each raw name/address
 *                          to top-K catalog candidates (per business).
 *   3. resolveMatches()  — Claude (text only) picks the final itemId / partyId /
 *                          agreementId from those candidates.
 *
 * This replaces the old "dump the whole catalog into the vision prompt" approach
 * so it scales and matches size variants far more reliably.
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { Types } from 'mongoose';
import { anthropicConfig } from '../config';
import { ValidationError } from '../middleware';
import { logger } from '../utils/logger';
import { Party } from '../models/Party';
import {
  EntityMatchingService,
  entityMatchingService,
  ItemCandidate,
  PartyCandidate,
} from './EntityMatchingService';

// ─── Output types (contract with the frontend) ───────────────────────────────

export interface ExtractedChallanItem {
  itemName: string;
  itemId: string | null;
  quantity: number;
}

export interface ExtractedChallanData {
  type: 'delivery' | 'return';
  challanNumber: string | null;
  date: string | null;
  partyName: string | null;
  partyId: string | null;
  /** Raw GSTIN/PAN read off the challan (exact party key) */
  partyGstin: string | null;
  /** Raw site address read off the challan (agreement key) */
  siteAddress: string | null;
  agreementId: string | null;
  items: ExtractedChallanItem[];
  transporterName: string | null;
  vehicleNumber: string | null;
  cartageAmount: number | null;
  damagedItems: ExtractedChallanItem[];
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

// ─── Raw (stage 1) types ─────────────────────────────────────────────────────

/**
 * A raw item ROW as transcribed by the vision stage. For a normal row, `baseName`
 * + `quantity` are set. For a multi-size row ("LADDER 1.5mtr + 1mtr + .850mtr"),
 * `baseName` is the shared prefix ("LADDER"), `sizes`/`quantities` hold the
 * per-size values, and `lineTotal` is the Qty/Unit column total (checksum). The
 * split into separate items happens deterministically in code (expandRow).
 */
interface RawItemRow {
  baseName: string;
  sizes?: string[] | null;
  quantities?: number[] | null;
  quantity?: number | null;
  lineTotal?: number | null;
}

/** A flattened, split item ready for matching. */
interface FlatItem {
  itemName: string;
  quantity: number;
}

interface RawChallanExtraction {
  type: 'delivery' | 'return';
  challanNumber: string | null;
  date: string | null;
  partyName: string | null;
  partyGstin: string | null;
  siteAddress: string | null;
  items: RawItemRow[];
  damagedItems: RawItemRow[];
  transporterName: string | null;
  vehicleNumber: string | null;
  cartageAmount: number | null;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

const rawItemSchema = z.object({
  baseName: z.string(),
  sizes: z.array(z.string()).nullable().optional(),
  quantities: z.array(z.number().int()).nullable().optional(),
  quantity: z.number().int().nullable().optional(),
  lineTotal: z.number().int().nullable().optional(),
});

const rawExtractionSchema = z.object({
  type: z.enum(['delivery', 'return']),
  challanNumber: z.string().nullable(),
  date: z.string().nullable(),
  partyName: z.string().nullable(),
  partyGstin: z.string().nullable(),
  siteAddress: z.string().nullable(),
  items: z.array(rawItemSchema),
  damagedItems: z.array(rawItemSchema),
  transporterName: z.string().nullable(),
  vehicleNumber: z.string().nullable(),
  cartageAmount: z.number().nullable(),
  confidence: z.enum(['high', 'medium', 'low']),
  warnings: z.array(z.string()),
});

// ─── Resolve (stage 3) schema ────────────────────────────────────────────────

const resolveItemSchema = z.object({
  itemName: z.string(),
  itemId: z.string().nullable(),
  quantity: z.number().int().min(1),
});

const resolveSchema = z.object({
  partyId: z.string().nullable(),
  agreementId: z.string().nullable(),
  items: z.array(resolveItemSchema),
  damagedItems: z.array(resolveItemSchema),
  confidence: z.enum(['high', 'medium', 'low']),
  warnings: z.array(z.string()),
});

// ─── Stage 1 system prompt (verbatim read + size checksum) ───────────────────

const EXTRACT_SYSTEM_PROMPT = `You are an expert at reading handwritten Indian scaffolding/equipment rental challans (delivery notes / return receipts). Read the photographed page and return a VERBATIM transcription as JSON. Do NOT match against any catalog — just read what is written.

## Determine type
- "delivery": header says Outward / Delivery / Dispatch.
- "return": header says Return / Receive / Inward.
- If unclear, default to "delivery".

## Fields to read
- challanNumber: the "Challan No." value (not Book No.).
- date: parse to YYYY-MM-DD. Indian formats DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY.
- partyName: the "M/s" / "Dispatch To" / "Dispatch Return M/s" customer name, exactly as written.
- partyGstin: the party's "GSTIN/PAN No." value (a 15-char GSTIN or 10-char PAN). This is the party's number near the party block — NOT the pre-printed business GSTIN in the header. If absent, null.
- siteAddress: the "Site Add." line (the construction site). If absent, null.
- transporterName, vehicleNumber (GR No. / vehicle reg), cartageAmount (number).

## Items — the critical part
Read every written item row. Do NOT merge or split — just transcribe each row's parts into the fields below. The system splits multi-size rows itself; your ONLY job is to report the pieces accurately.

NORMAL ROW (single item) — this is the COMMON case: set "baseName" to the FULL written text INCLUDING any dimension that is part of the item name (e.g. "STANDARD 3 MTR", "S PROP 2x2", "S PLATE 3x2", "JOINT PIN") and "quantity" to the Qty/Unit value. Leave "sizes" and "quantities" null. A single dimension like "3x2", "2x2", or "3 MTR" is part of the item name — it is NOT a multi-size row. Examples:
    "STANDARD 3 MTR"  qty 88  →  { "baseName": "STANDARD 3 MTR", "sizes": null, "quantities": null, "quantity": 88, "lineTotal": 88 }
    "S PLATE 3x2"     qty 4   →  { "baseName": "S PLATE 3x2", "sizes": null, "quantities": null, "quantity": 4, "lineTotal": 4 }

MULTI-SIZE ROW — ONLY when the row lists TWO OR MORE sizes joined by "+", each with its OWN sub-quantity, e.g.:
    "LADDER 1.5mtr + 1mtr + .850mtr"   sub-quantities "193 / 10 / 21"   Qty total 224
Report it as:
    { "baseName": "LADDER", "sizes": ["1.5mtr","1mtr","0.850mtr"], "quantities": [193,10,21], "lineTotal": 224 }
- "baseName" = the shared item name WITHOUT the sizes.
- "sizes" = each size token IN ORDER (left to right).
- "quantities" = the sub-quantity under each size, IN THE SAME ORDER. sizes.length MUST equal quantities.length.
- "lineTotal" = the single number in the Qty/Unit column for that row (used as a checksum). If no total is written, null.
Do NOT add the sub-quantities yourself — just read each one. Do NOT expand abbreviations.

If a sub-quantity is illegible, put your best integer reading and add a warning naming the row.

## Damaged items (return challans only)
If there is a breakage/damage section, read those into damagedItems the same way.

## Output — ONLY valid JSON, no markdown/code fences:
{
  "type": "delivery" | "return",
  "challanNumber": string | null,
  "date": "YYYY-MM-DD" | null,
  "partyName": string | null,
  "partyGstin": string | null,
  "siteAddress": string | null,
  "items": [ { "baseName": string, "sizes": string[] | null, "quantities": number[] | null, "quantity": number | null, "lineTotal": number | null } ],
  "damagedItems": [ { "baseName": string, "sizes": string[] | null, "quantities": number[] | null, "quantity": number | null, "lineTotal": number | null } ],
  "transporterName": string | null,
  "vehicleNumber": string | null,
  "cartageAmount": number | null,
  "confidence": "high" | "medium" | "low",
  "warnings": [ string ]
}

Rules: unreadable field → null, never guess. Quantities are positive integers. confidence reflects photo legibility overall.`;

// ─── Stage 3 system prompt (pick from candidates) ────────────────────────────

const RESOLVE_SYSTEM_PROMPT = `You resolve a raw challan transcription to catalog IDs. You are given the raw extraction plus, for each name/address, a short list of candidate records retrieved from the business database. Pick the best matching ID from the provided candidates ONLY — never invent an ID.

## Items
For each raw item, choose the candidate whose code/name best matches the raw text, paying close attention to SIZE (e.g. "2x2" vs "2x3", "1.5mtr" vs "1mtr" are DIFFERENT items). If no candidate is a credible match, set itemId to null and add a warning naming the item. Keep itemName and quantity exactly as given.

## Party
Prefer a candidate marked "exact": true (GSTIN match) — that is authoritative. Otherwise pick the closest NAME match. Handwritten GSTINs are frequently misread, so a GSTIN that differs from a candidate must NOT veto an otherwise strong name match — select the name match and lower confidence + add a warning noting the GSTIN discrepancy. Only set partyId null when no candidate's name is a credible match.

## Agreement
From the agreements list (belonging to the candidate parties), pick the one whose siteAddress best matches the raw siteAddress. If the chosen party has exactly one active agreement, select it regardless. If nothing matches, agreementId null.

## Output — ONLY valid JSON, no markdown:
{
  "partyId": string | null,
  "agreementId": string | null,
  "items": [ { "itemName": string, "itemId": string | null, "quantity": number } ],
  "damagedItems": [ { "itemName": string, "itemId": string | null, "quantity": number } ],
  "confidence": "high" | "medium" | "low",
  "warnings": [ string ]
}
Preserve item order and quantities exactly. Merge any new ambiguity into warnings.`;

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp';

// ─── Service ─────────────────────────────────────────────────────────────────

export class ChallanExtractionService {
  private client: Anthropic;
  private model: string;

  constructor(private readonly matching: EntityMatchingService = entityMatchingService) {
    if (!anthropicConfig.apiKey) {
      logger.warn('Anthropic API key not configured — challan photo extraction will be unavailable');
    }
    this.client = new Anthropic({ apiKey: anthropicConfig.apiKey || 'not-configured' });
    this.model = anthropicConfig.model;
  }

  /**
   * Full pipeline: vision extract → hybrid match → resolve. Returns the
   * frontend-facing ExtractedChallanData.
   */
  async extractAndMatch(
    imageBuffer: Buffer,
    mimeType: string,
    businessId: string
  ): Promise<ExtractedChallanData> {
    if (!anthropicConfig.apiKey) {
      throw new ValidationError(
        'Anthropic API key is not configured. Please set ANTHROPIC_API_KEY in environment variables.'
      );
    }

    const raw = await this.extractRaw(imageBuffer, mimeType);

    // Deterministically split multi-size rows + run the quantity checksum.
    const itemsExp = expandRows(raw.items, 'Item');
    const damagedExp = expandRows(raw.damagedItems, 'Damaged item');
    const flatItems = itemsExp.items;
    const flatDamaged = damagedExp.items;

    // Retrieve candidates for every split item name + party (scoped to business).
    const [itemCandidates, damagedCandidates, partyCandidates] = await Promise.all([
      this.matching.matchItems(businessId, flatItems.map((i) => i.itemName)),
      this.matching.matchItems(businessId, flatDamaged.map((i) => i.itemName)),
      this.matching.matchParty(businessId, {
        name: raw.partyName,
        gstin: raw.partyGstin,
        address: raw.siteAddress,
      }),
    ]);

    const agreements = await this.fetchAgreementsFor(businessId, partyCandidates);

    const resolved = await this.resolveMatches(flatItems, flatDamaged, {
      items: flatItems.map((it, i) => ({
        index: i,
        raw: it.itemName,
        quantity: it.quantity,
        candidates: slimItemCandidates(itemCandidates[i]),
      })),
      damagedItems: flatDamaged.map((it, i) => ({
        index: i,
        raw: it.itemName,
        quantity: it.quantity,
        candidates: slimItemCandidates(damagedCandidates[i]),
      })),
      party: {
        raw: raw.partyName,
        gstin: raw.partyGstin,
        candidates: partyCandidates.map((c) => ({
          partyId: c.partyId,
          name: c.name,
          gst: c.gst,
          exact: c.exact || false,
        })),
      },
      siteAddress: raw.siteAddress,
      agreements,
    });

    return {
      type: raw.type,
      challanNumber: raw.challanNumber,
      date: raw.date,
      partyName: raw.partyName,
      partyId: resolved.partyId,
      partyGstin: raw.partyGstin,
      siteAddress: raw.siteAddress,
      agreementId: resolved.agreementId,
      items: resolved.items,
      transporterName: raw.transporterName,
      vehicleNumber: raw.vehicleNumber,
      cartageAmount: raw.cartageAmount,
      damagedItems: resolved.damagedItems,
      confidence: resolved.confidence,
      warnings: [...raw.warnings, ...itemsExp.warnings, ...damagedExp.warnings, ...resolved.warnings],
    };
  }

  // ─── Stage 1: vision, verbatim ─────────────────────────────────────────────

  private async extractRaw(imageBuffer: Buffer, mimeType: string): Promise<RawChallanExtraction> {
    const base64Image = imageBuffer.toString('base64');
    logger.info('Challan extract (stage 1: vision)', { model: this.model, imageSize: imageBuffer.length });

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: EXTRACT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType as MediaType, data: base64Image },
            },
            { type: 'text', text: 'Transcribe this challan into the JSON described in your instructions.' },
          ],
        },
      ],
    });

    const text = this.firstText(response);
    const parsed = this.parseJson(text);
    const result = rawExtractionSchema.safeParse(parsed);
    if (!result.success) {
      logger.error('Stage 1 schema validation failed', { errors: result.error.issues, preview: text.slice(0, 500) });
      throw new ValidationError('Could not read the challan. Please try a clearer photo.');
    }
    logger.info('Stage 1 complete', {
      type: result.data.type,
      items: result.data.items.length,
      gstin: result.data.partyGstin,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
    return result.data;
  }

  // ─── Stage 3: text, pick IDs ───────────────────────────────────────────────

  private async resolveMatches(
    flatItems: FlatItem[],
    flatDamaged: FlatItem[],
    bundle: ResolveBundle
  ): Promise<z.infer<typeof resolveSchema>> {
    const passthrough = (confidence: 'high' | 'medium' | 'low', warning: string) => ({
      partyId: null,
      agreementId: null,
      items: flatItems.map((i) => ({ itemName: i.itemName, itemId: null, quantity: i.quantity })),
      damagedItems: flatDamaged.map((i) => ({ itemName: i.itemName, itemId: null, quantity: i.quantity })),
      confidence,
      warnings: [warning],
    });

    // Short-circuit: nothing to resolve against — return nulls, keep raw items.
    const nothingToMatch =
      bundle.items.every((i) => i.candidates.length === 0) &&
      bundle.damagedItems.every((i) => i.candidates.length === 0) &&
      bundle.party.candidates.length === 0;
    if (nothingToMatch) {
      return passthrough('low', 'No catalog candidates were found to match against.');
    }

    logger.info('Challan extract (stage 3: resolve)', {
      items: bundle.items.length,
      partyCandidates: bundle.party.candidates.length,
      agreements: bundle.agreements.length,
    });

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: RESOLVE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: [{ type: 'text', text: JSON.stringify(bundle) }] }],
    });

    const text = this.firstText(response);
    const parsed = this.parseJson(text);
    const result = resolveSchema.safeParse(parsed);
    if (!result.success) {
      logger.error('Stage 3 schema validation failed', { errors: result.error.issues, preview: text.slice(0, 500) });
      // Degrade gracefully: keep split items, no IDs.
      return passthrough('low', 'Automatic matching failed; please select items/party manually.');
    }
    return result.data;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Load active agreements (with site addresses) for the candidate parties. */
  private async fetchAgreementsFor(
    businessId: string,
    partyCandidates: PartyCandidate[]
  ): Promise<AgreementInfo[]> {
    if (partyCandidates.length === 0) return [];
    const partyIds = partyCandidates.map((c) => new Types.ObjectId(c.partyId));
    const parties = await Party.find({
      _id: { $in: partyIds },
      businessId: new Types.ObjectId(businessId),
    })
      .select('name sites agreements')
      .lean();

    const out: AgreementInfo[] = [];
    for (const p of parties) {
      for (const a of p.agreements || []) {
        if (a.status !== 'active') continue;
        const site = (p.sites || []).find((s) => s.code === a.siteCode);
        out.push({
          agreementId: a.agreementId,
          partyId: p._id.toString(),
          siteCode: a.siteCode,
          siteAddress: site?.address || a.siteCode,
          status: a.status,
        });
      }
    }
    return out;
  }

  private firstText(response: Anthropic.Message): string {
    const block = response.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') {
      throw new ValidationError('The model returned an empty response. Please try with a clearer photo.');
    }
    return block.text.trim();
  }

  private parseJson(text: string): unknown {
    let cleaned = text;
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    try {
      return JSON.parse(cleaned);
    } catch {
      logger.error('Failed to parse model JSON', { preview: text.slice(0, 500) });
      throw new ValidationError('Could not parse the extraction result. Please try with a clearer photo.');
    }
  }
}

// ─── Bundle shapes passed to stage 3 ─────────────────────────────────────────

interface AgreementInfo {
  agreementId: string;
  partyId: string;
  siteCode: string;
  siteAddress: string;
  status: string;
}

interface ResolveBundle {
  items: { index: number; raw: string; quantity: number; candidates: SlimItemCandidate[] }[];
  damagedItems: { index: number; raw: string; quantity: number; candidates: SlimItemCandidate[] }[];
  party: {
    raw: string | null;
    gstin: string | null;
    candidates: { partyId: string; name: string; gst?: string; exact: boolean }[];
  };
  siteAddress: string | null;
  agreements: AgreementInfo[];
}

interface SlimItemCandidate {
  itemId: string;
  code: string;
  name: string;
  description?: string;
}

/**
 * Expand raw item rows into flat {itemName, quantity} items. Splits multi-size
 * rows (one item per size) and runs the quantity checksum (sub-quantities must
 * sum to the row's lineTotal), emitting warnings instead of guessing.
 */
function expandRows(rows: RawItemRow[], label: string): { items: FlatItem[]; warnings: string[] } {
  const items: FlatItem[] = [];
  const warnings: string[] = [];

  for (const row of rows) {
    const base = (row.baseName || '').trim();
    if (!base) continue;

    // Only a genuine multi-size row (2+ sizes) is split. A single size token is
    // part of the item name — fold it back in and treat as a normal row.
    if (row.sizes && row.sizes.length >= 2) {
      const qtys = row.quantities || [];
      if (qtys.length !== row.sizes.length) {
        warnings.push(
          `${label} "${base}": ${row.sizes.length} sizes but ${qtys.length} quantities — could not align, please verify.`
        );
      }
      let sum = 0;
      row.sizes.forEach((size, i) => {
        const q = qtys[i];
        if (q == null || q < 1) {
          warnings.push(`${label} "${base} ${size}": missing/illegible quantity — skipped.`);
          return;
        }
        sum += q;
        items.push({ itemName: `${base} ${String(size).trim()}`.trim(), quantity: q });
      });
      if (row.lineTotal != null && sum !== row.lineTotal) {
        warnings.push(
          `${label} "${base}": sub-quantities sum to ${sum} but the row total is ${row.lineTotal} — please verify.`
        );
      }
    } else {
      // Normal row (or a stray single-size token folded back into the name).
      const singleSize = row.sizes && row.sizes.length === 1 ? String(row.sizes[0]).trim() : '';
      const itemName = singleSize ? `${base} ${singleSize}`.trim() : base;
      const q = row.quantity ?? row.quantities?.[0] ?? row.lineTotal ?? null;
      if (q == null || q < 1) {
        warnings.push(`${label} "${itemName}": missing/illegible quantity — skipped.`);
        continue;
      }
      items.push({ itemName, quantity: q });
    }
  }

  return { items, warnings };
}

function slimItemCandidates(candidates: ItemCandidate[] | undefined): SlimItemCandidate[] {
  return (candidates || []).map((c) => ({
    itemId: c.itemId,
    code: c.code,
    name: c.name,
    ...(c.description ? { description: c.description } : {}),
  }));
}

export const challanExtractionService = new ChallanExtractionService();
