/**
 * @file Catalog Embedding Service
 * @description Keeps the semantic-search vectors for the matchable catalog
 * (inventory items, parties, and the flattened `sites` read-model) in sync with
 * their source documents. Called fire-and-forget from Inventory/Party write
 * paths — embedding must never block or fail a mutation.
 *
 * GSTIN is intentionally NOT embedded: it's an exact lexical key used to
 * short-circuit party matching, not a fuzzy signal.
 */

import { Types } from 'mongoose';
import { Inventory, IInventory } from '../models/Inventory';
import { Party, IParty } from '../models/Party';
import { Site } from '../models/Site';
import { EmbeddingService, embeddingService } from './EmbeddingService';
import { logger } from '../utils/logger';

/** Collapse whitespace and trim — stable input for hashing + embedding. */
function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export class CatalogEmbeddingService {
  constructor(private readonly embeddings: EmbeddingService = embeddingService) {}

  // ─── Source text builders ─────────────────────────────────────────────────

  static inventoryText(item: Pick<IInventory, 'code' | 'name' | 'description'>): string {
    return normalize([item.code, item.name, item.description || ''].join(' '));
  }

  static partyText(party: IParty): string {
    return normalize([party.name, party.contact?.address || ''].join(' '));
  }

  static siteText(address: string): string {
    return normalize(address);
  }

  // ─── Embed-on-write entry points (non-blocking) ───────────────────────────

  /** Embed a single inventory item if its source text changed. */
  async embedInventory(itemId: Types.ObjectId | string): Promise<void> {
    try {
      if (!this.embeddings.isEnabled()) return;
      const item = await Inventory.findById(itemId).select('+embeddingHash code name description');
      if (!item) return;
      const text = CatalogEmbeddingService.inventoryText(item);
      const hash = EmbeddingService.hashText(text);
      if (hash === item.embeddingHash) return;
      const vector = await this.embeddings.embed(text);
      await Inventory.updateOne({ _id: item._id }, { embedding: vector, embeddingHash: hash });
    } catch (error) {
      logger.error('embedInventory failed (non-blocking):', error);
    }
  }

  /** Embed a party and sync its flattened site docs. */
  async embedParty(partyId: Types.ObjectId | string): Promise<void> {
    try {
      if (!this.embeddings.isEnabled()) return;
      const party = await Party.findById(partyId).select('+embeddingHash');
      if (!party) return;

      // Party vector
      const text = CatalogEmbeddingService.partyText(party);
      const hash = EmbeddingService.hashText(text);
      if (hash !== party.embeddingHash) {
        const vector = await this.embeddings.embed(text);
        await Party.updateOne({ _id: party._id }, { embedding: vector, embeddingHash: hash });
      }

      await this.syncPartySites(party);
    } catch (error) {
      logger.error('embedParty failed (non-blocking):', error);
    }
  }

  /**
   * Reconcile the `sites` read-model with party.sites[]: upsert current sites
   * (embedding when the address changed), delete sites that no longer exist.
   */
  async syncPartySites(party: IParty): Promise<void> {
    const currentCodes = (party.sites || []).map((s) => s.code);

    // Remove stale site docs
    await Site.deleteMany({
      partyId: party._id,
      siteCode: { $nin: currentCodes },
    });

    for (const site of party.sites || []) {
      const text = CatalogEmbeddingService.siteText(site.address);
      const hash = EmbeddingService.hashText(text);
      const existing = await Site.findOne({ partyId: party._id, siteCode: site.code }).select(
        '+embeddingHash'
      );

      const base = {
        businessId: party.businessId,
        partyId: party._id,
        partyName: party.name,
        siteCode: site.code,
        address: site.address,
        stateCode: site.stateCode,
      };

      if (existing && existing.embeddingHash === hash) {
        // Address unchanged — refresh denormalized fields only.
        await Site.updateOne({ _id: existing._id }, base);
        continue;
      }

      const vector = await this.embeddings.embed(text);
      await Site.updateOne(
        { partyId: party._id, siteCode: site.code },
        { ...base, embedding: vector, embeddingHash: hash },
        { upsert: true }
      );
    }
  }

  /** Delete all site docs for a party (party deletion). */
  async removePartySites(partyId: Types.ObjectId | string): Promise<void> {
    try {
      await Site.deleteMany({ partyId });
    } catch (error) {
      logger.error('removePartySites failed (non-blocking):', error);
    }
  }
}

export const catalogEmbeddingService = new CatalogEmbeddingService();
