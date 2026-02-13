/**
 * @file Migration: Inventory Codes
 * @description Generates inventory codes for existing inventory items that don't have codes
 * 
 * Run this migration with: npx ts-node src/migrations/migrateInventoryCodes.ts
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';
import { Inventory, IInventory } from '../models';

// Load environment variables
config();

/**
 * Generate an inventory code from item name
 * Uses first 4 uppercase letters, padded with 'X' if needed
 */
function generateInventoryCodeFromName(name: string, existingCodes: string[]): string {
  // Extract only letters from the name
  const letters = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
  
  // Take first 4 letters, pad with 'X' if less than 4
  let baseCode = letters.substring(0, 4);
  if (baseCode.length < 4) {
    baseCode = baseCode.padEnd(4, 'X');
  }
  
  // If base code is empty, use 'ITEM'
  if (!baseCode || baseCode === 'XXXX') {
    baseCode = 'ITEM';
  }
  
  const existingCodesUpper = existingCodes.map(c => c.toUpperCase());
  
  if (!existingCodesUpper.includes(baseCode)) {
    return baseCode;
  }
  
  // Find next available number suffix
  let counter = 1;
  while (existingCodesUpper.includes(`${baseCode}${counter}`)) {
    counter++;
  }
  
  return `${baseCode}${counter}`;
}

/**
 * Migrate inventory codes for all existing inventory items
 */
async function migrateInventoryCodes(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/billpromax';
  
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  try {
    // Get all businesses with inventory
    const businesses = await Inventory.distinct('businessId');
    console.log(`Found ${businesses.length} businesses with inventory`);

    let totalUpdated = 0;
    let totalSkipped = 0;

    for (const businessId of businesses) {
      console.log(`\nProcessing business: ${businessId}`);
      
      // Get all inventory items for this business
      const items = await Inventory.find({ businessId }).sort({ createdAt: 1 });
      console.log(`  Found ${items.length} inventory items`);

      // Collect existing codes
      const existingCodes: string[] = items
        .filter((i: IInventory) => i.code)
        .map((i: IInventory) => i.code);

      for (const item of items) {
        if (item.code) {
          console.log(`  Skipping ${item.name} - already has code: ${item.code}`);
          totalSkipped++;
          continue;
        }

        // Generate code from name
        const code = generateInventoryCodeFromName(item.name, existingCodes);
        existingCodes.push(code);

        // Update the item
        await Inventory.updateOne(
          { _id: item._id },
          { $set: { code } }
        );

        console.log(`  Updated ${item.name} -> ${code}`);
        totalUpdated++;
      }
    }

    console.log(`\n=== Migration Complete ===`);
    console.log(`Total inventory items updated: ${totalUpdated}`);
    console.log(`Total inventory items skipped: ${totalSkipped}`);

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
migrateInventoryCodes()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
