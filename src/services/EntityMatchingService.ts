/**
 * @file Entity Matching Service
 * @description Hybrid candidate retrieval for challan extraction. For each piece
 * of raw text pulled off a photographed challan (item name/size token, party
 * name, site address) it returns the top-K catalog candidates the LLM then
 * picks from — instead of dumping the whole catalog into the prompt.
 *
 * Hybrid = Atlas Vector Search (semantic) fused with a lexical query (exact-ish
 * codes / text) via Reciprocal Rank Fusion. Party GSTIN is an exact short-
 * circuit: a GSTIN hit returns that party alone with max confidence.
 *
 * Every query is scoped to a single `businessId` (multi-tenant isolation) via
 * the vector index `filter` field and an explicit match on the lexical side.
 */

import { Types } from 'mongoose';
import { Inventory } from '../models/Inventory';
import { Party } from '../models/Party';
import { Site } from '../models/Site';
import { EmbeddingService, embeddingService } from './EmbeddingService';
import { logger } from '../utils/logger';

// ─── Candidate shapes ────────────────────────────────────────────────────────

export interface ItemCandidate {
  itemId: string;
  code: string;
  name: string;
  description?: string;
  score: number;
}

export interface PartyCandidate {
  partyId: string;
  code: string;
  name: string;
  gst?: string;
  score: number;
  /** True when matched by exact GSTIN (overrides semantic ranking). */
  exact?: boolean;
}

export interface SiteCandidate {
  siteId: string;
  partyId: string;
  partyName: string;
  siteCode: string;
  address: string;
  score: number;
}

const DEFAULT_K = 8;
const NUM_CANDIDATES = 150;
const RRF_K = 60; // standard Reciprocal Rank Fusion dampening constant

/** Normalize a GSTIN/PAN for exact comparison (uppercase, strip non-alnum). */
function normalizeGst(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Build a safe case-insensitive regex from arbitrary user text. */
function safeRegex(text: string): RegExp {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim();
  return new RegExp(escaped, 'i');
}

/**
 * Reciprocal Rank Fusion: merge several ranked lists into one. Items appearing
 * high in multiple lists rise to the top. `idOf` extracts the dedup key.
 */
function rrfFuse<T>(lists: T[][], idOf: (x: T) => string, k = DEFAULT_K): T[] {
  const scores = new Map<string, number>();
  const pick = new Map<string, T>();
  for (const list of lists) {
    list.forEach((item, rank) => {
      const id = idOf(item);
      scores.set(id, (scores.get(id) || 0) + 1 / (RRF_K + rank + 1));
      if (!pick.has(id)) pick.set(id, item);
    });
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([id, score]) => ({ ...(pick.get(id) as T), score }));
}

export class EntityMatchingService {
  constructor(private readonly embeddings: EmbeddingService = embeddingService) {}

  // ─── Inventory items ───────────────────────────────────────────────────────

  /**
   * Match many raw item tokens at once. Returns a candidate list per input
   * token, in input order. Embeds all tokens in a single batch call.
   */
  async matchItems(businessId: string, tokens: string[]): Promise<ItemCandidate[][]> {
    if (tokens.length === 0) return [];
    const oid = new Types.ObjectId(businessId);
    const vectors = this.embeddings.isEnabled()
      ? await this.embeddings.embedBatch(tokens)
      : tokens.map(() => null);

    return Promise.all(
      tokens.map((token, i) => this.matchOneItem(oid, token, vectors[i] as number[] | null))
    );
  }

  private async matchOneItem(
    oid: Types.ObjectId,
    token: string,
    vector: number[] | null
  ): Promise<ItemCandidate[]> {
    const [semantic, lexical] = await Promise.all([
      vector ? this.vectorSearchItems(oid, vector) : Promise.resolve([]),
      this.lexicalItems(oid, token),
    ]);
    return rrfFuse([semantic, lexical], (c) => c.itemId);
  }

  private async vectorSearchItems(oid: Types.ObjectId, vector: number[]): Promise<ItemCandidate[]> {
    try {
      const rows = await Inventory.aggregate([
        {
          $vectorSearch: {
            index: 'inventory_vector_index',
            path: 'embedding',
            queryVector: vector,
            numCandidates: NUM_CANDIDATES,
            limit: DEFAULT_K,
            filter: { businessId: oid },
          },
        },
        { $match: { isActive: true } },
        {
          $project: {
            code: 1,
            name: 1,
            description: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ]);
      return rows.map((r) => ({
        itemId: r._id.toString(),
        code: r.code,
        name: r.name,
        description: r.description,
        score: r.score,
      }));
    } catch (error) {
      logger.error('vectorSearchItems failed — falling back to lexical only:', error);
      return [];
    }
  }

  private async lexicalItems(oid: Types.ObjectId, token: string): Promise<ItemCandidate[]> {
    const rx = safeRegex(token);
    const rows = await Inventory.find({
      businessId: oid,
      isActive: true,
      $or: [{ code: rx }, { name: rx }],
    })
      .select('code name description')
      .limit(DEFAULT_K)
      .lean();
    return rows.map((r) => ({
      itemId: r._id.toString(),
      code: r.code,
      name: r.name,
      description: r.description,
      score: 0,
    }));
  }

  // ─── Parties ───────────────────────────────────────────────────────────────

  /**
   * Match a party by name (+address) with an exact-GSTIN short-circuit.
   */
  async matchParty(
    businessId: string,
    opts: { name?: string | null; gstin?: string | null; address?: string | null }
  ): Promise<PartyCandidate[]> {
    const oid = new Types.ObjectId(businessId);

    // 1) Exact GSTIN wins outright.
    if (opts.gstin) {
      const gst = normalizeGst(opts.gstin);
      if (gst.length >= 10) {
        const match = await Party.findOne({
          businessId: oid,
          isActive: true,
          $expr: {
            $eq: [{ $toUpper: { $ifNull: ['$contact.gst', ''] } }, gst],
          },
        })
          .select('code name contact.gst')
          .lean();
        if (match) {
          return [
            {
              partyId: match._id.toString(),
              code: match.code,
              name: match.name,
              gst: match.contact?.gst,
              score: 1,
              exact: true,
            },
          ];
        }
      }
    }

    // 2) Semantic + lexical on name/address.
    const queryText = [opts.name || '', opts.address || ''].join(' ').trim();
    const vector =
      queryText && this.embeddings.isEnabled() ? await this.embeddings.embed(queryText) : null;

    const [semantic, lexical] = await Promise.all([
      vector ? this.vectorSearchParties(oid, vector) : Promise.resolve([]),
      opts.name ? this.lexicalParties(oid, opts.name) : Promise.resolve([]),
    ]);
    return rrfFuse([semantic, lexical], (c) => c.partyId);
  }

  private async vectorSearchParties(oid: Types.ObjectId, vector: number[]): Promise<PartyCandidate[]> {
    try {
      const rows = await Party.aggregate([
        {
          $vectorSearch: {
            index: 'party_vector_index',
            path: 'embedding',
            queryVector: vector,
            numCandidates: NUM_CANDIDATES,
            limit: DEFAULT_K,
            filter: { businessId: oid },
          },
        },
        { $match: { isActive: true } },
        { $project: { code: 1, name: 1, 'contact.gst': 1, score: { $meta: 'vectorSearchScore' } } },
      ]);
      return rows.map((r) => ({
        partyId: r._id.toString(),
        code: r.code,
        name: r.name,
        gst: r.contact?.gst,
        score: r.score,
      }));
    } catch (error) {
      logger.error('vectorSearchParties failed — falling back to lexical only:', error);
      return [];
    }
  }

  private async lexicalParties(oid: Types.ObjectId, name: string): Promise<PartyCandidate[]> {
    const rx = safeRegex(name);
    const rows = await Party.find({ businessId: oid, isActive: true, name: rx })
      .select('code name contact.gst')
      .limit(DEFAULT_K)
      .lean();
    return rows.map((r) => ({
      partyId: r._id.toString(),
      code: r.code,
      name: r.name,
      gst: r.contact?.gst,
      score: 0,
    }));
  }

  // ─── Sites ───────────────────────────────────────────────────────────────

  /**
   * Match a site by address. If the party is already known (from GSTIN/name),
   * restrict to that party's sites for a cleaner result.
   */
  async matchSite(
    businessId: string,
    address: string,
    partyId?: string | null
  ): Promise<SiteCandidate[]> {
    if (!address) return [];
    const oid = new Types.ObjectId(businessId);
    const vector = this.embeddings.isEnabled() ? await this.embeddings.embed(address) : null;

    const [semantic, lexical] = await Promise.all([
      vector ? this.vectorSearchSites(oid, vector, partyId) : Promise.resolve([]),
      this.lexicalSites(oid, address, partyId),
    ]);
    return rrfFuse([semantic, lexical], (c) => c.siteId);
  }

  private async vectorSearchSites(
    oid: Types.ObjectId,
    vector: number[],
    partyId?: string | null
  ): Promise<SiteCandidate[]> {
    try {
      const filter: Record<string, unknown> = { businessId: oid };
      if (partyId) filter.partyId = new Types.ObjectId(partyId);
      const rows = await Site.aggregate([
        {
          $vectorSearch: {
            index: 'site_vector_index',
            path: 'embedding',
            queryVector: vector,
            numCandidates: NUM_CANDIDATES,
            limit: DEFAULT_K,
            filter,
          },
        },
        {
          $project: {
            partyId: 1,
            partyName: 1,
            siteCode: 1,
            address: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ]);
      return rows.map((r) => ({
        siteId: r._id.toString(),
        partyId: r.partyId.toString(),
        partyName: r.partyName,
        siteCode: r.siteCode,
        address: r.address,
        score: r.score,
      }));
    } catch (error) {
      logger.error('vectorSearchSites failed — falling back to lexical only:', error);
      return [];
    }
  }

  private async lexicalSites(
    oid: Types.ObjectId,
    address: string,
    partyId?: string | null
  ): Promise<SiteCandidate[]> {
    const rx = safeRegex(address.split(/[,\s]+/).slice(0, 3).join(' '));
    const query: Record<string, unknown> = { businessId: oid, address: rx };
    if (partyId) query.partyId = new Types.ObjectId(partyId);
    const rows = await Site.find(query).select('partyId partyName siteCode address').limit(DEFAULT_K).lean();
    return rows.map((r) => ({
      siteId: r._id.toString(),
      partyId: r.partyId.toString(),
      partyName: r.partyName,
      siteCode: r.siteCode,
      address: r.address,
      score: 0,
    }));
  }
}

export const entityMatchingService = new EntityMatchingService();
