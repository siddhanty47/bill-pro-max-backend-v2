/**
 * @file Migration: Business Split Tax Rates
 * @description Backfills SGST/CGST/IGST defaults for legacy businesses that only
 * have a single defaultTaxRate.
 *
 * Run this migration with: npx ts-node src/migrations/migrateBusinessSplitTaxRates.ts
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';
import { Business } from '../models';

// Load environment variables
config();

function round2(value: number): number {
  return Number(value.toFixed(2));
}

async function migrateBusinessSplitTaxRates(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/billpromax';

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  try {
    const businesses = await Business.find({}).select('_id name settings').lean();
    console.log(`Found ${businesses.length} businesses`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const business of businesses) {
      const settings = business.settings || {};
      const legacyRate =
        typeof settings.defaultTaxRate === 'number' ? settings.defaultTaxRate : 0;

      const nextSgst = round2(legacyRate / 2);
      const nextCgst = round2(legacyRate / 2);
      const nextIgst = round2(legacyRate);

      const update: Record<string, number> = {};

      if (typeof settings.defaultSgstRate !== 'number') {
        update['settings.defaultSgstRate'] = nextSgst;
      }
      if (typeof settings.defaultCgstRate !== 'number') {
        update['settings.defaultCgstRate'] = nextCgst;
      }
      if (typeof settings.defaultIgstRate !== 'number') {
        update['settings.defaultIgstRate'] = nextIgst;
      }

      if (Object.keys(update).length === 0) {
        skippedCount++;
        continue;
      }

      await Business.updateOne({ _id: business._id }, { $set: update });
      updatedCount++;
      console.log(`Updated ${business.name} (${business._id})`, update);
    }

    console.log('\n=== Migration Complete ===');
    console.log(`Businesses updated: ${updatedCount}`);
    console.log(`Businesses skipped: ${skippedCount}`);
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

migrateBusinessSplitTaxRates()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

