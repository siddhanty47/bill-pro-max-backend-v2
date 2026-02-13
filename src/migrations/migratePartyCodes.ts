/**
 * @file Migration: Party Codes
 * @description Generates party codes for existing parties that don't have codes
 * 
 * Run this migration with: npx ts-node src/migrations/migratePartyCodes.ts
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';
import { Party, IParty } from '../models';
import { generatePartyCode } from '../utils/helpers';

// Load environment variables
config();

/**
 * Migrate party codes for all existing parties
 */
async function migratePartyCodes(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/billpromax';
  
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  try {
    // Get all parties grouped by businessId
    const businesses = await Party.distinct('businessId');
    console.log(`Found ${businesses.length} businesses with parties`);

    let totalUpdated = 0;
    let totalSkipped = 0;

    for (const businessId of businesses) {
      console.log(`\nProcessing business: ${businessId}`);
      
      // Get all parties for this business
      const parties = await Party.find({ businessId }).sort({ createdAt: 1 });
      console.log(`  Found ${parties.length} parties`);

      // Collect existing codes
      const existingCodes: string[] = parties
        .filter((p: IParty) => p.code)
        .map((p: IParty) => p.code);

      for (const party of parties) {
        if (party.code) {
          console.log(`  Skipping ${party.name} - already has code: ${party.code}`);
          totalSkipped++;
          continue;
        }

        // Generate code from name
        const code = generatePartyCode(party.name, existingCodes);
        existingCodes.push(code);

        // Update the party
        await Party.updateOne(
          { _id: party._id },
          { $set: { code } }
        );

        console.log(`  Updated ${party.name} -> ${code}`);
        totalUpdated++;
      }
    }

    console.log(`\n=== Migration Complete ===`);
    console.log(`Total parties updated: ${totalUpdated}`);
    console.log(`Total parties skipped: ${totalSkipped}`);

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
migratePartyCodes()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
