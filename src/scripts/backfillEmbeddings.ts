/**
 * @file Backfill embeddings
 * @description One-off script that embeds all existing active inventory items
 * and parties (and syncs the flattened `sites` read-model). Safe to re-run:
 * CatalogEmbeddingService skips documents whose source text hash is unchanged.
 *
 * Usage (respects DB_ENV — defaults to local):
 *   DB_ENV=prod npx ts-node -r tsconfig-paths/register src/scripts/backfillEmbeddings.ts
 *   npm run backfill:embeddings           # local
 *   npm run backfill:embeddings:prod      # remote Atlas
 */

import 'dotenv/config';
import { connectDatabase, disconnectDatabase, embeddingConfig } from '../config';
import { Inventory } from '../models/Inventory';
import { Party } from '../models/Party';
import { catalogEmbeddingService } from '../services/CatalogEmbeddingService';
import { logger } from '../utils/logger';

async function main(): Promise<void> {
  if (!embeddingConfig.apiKey) {
    logger.error('OPENAI_API_KEY is not set — cannot backfill embeddings.');
    process.exit(1);
  }

  await connectDatabase();
  logger.info('Backfill started', {
    model: embeddingConfig.model,
    dimensions: embeddingConfig.dimensions,
  });

  // Inventory
  const itemIds = await Inventory.find({ isActive: true }).distinct('_id');
  logger.info(`Embedding ${itemIds.length} inventory items...`);
  let itemDone = 0;
  for (const id of itemIds) {
    await catalogEmbeddingService.embedInventory(id);
    if (++itemDone % 25 === 0) logger.info(`  items: ${itemDone}/${itemIds.length}`);
  }

  // Parties (also syncs sites read-model)
  const partyIds = await Party.find({ isActive: true }).distinct('_id');
  logger.info(`Embedding ${partyIds.length} parties (+ sites)...`);
  let partyDone = 0;
  for (const id of partyIds) {
    await catalogEmbeddingService.embedParty(id);
    if (++partyDone % 25 === 0) logger.info(`  parties: ${partyDone}/${partyIds.length}`);
  }

  logger.info('Backfill complete', {
    items: itemIds.length,
    parties: partyIds.length,
  });

  await disconnectDatabase();
  process.exit(0);
}

main().catch(async (err) => {
  logger.error('Backfill failed:', err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
