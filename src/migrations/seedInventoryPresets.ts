/**
 * @file Seed inventory presets migration
 * @description Seeds the "Scaffolding Common" system preset
 *
 * Run: npx ts-node src/migrations/seedInventoryPresets.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { InventoryPreset } from '../models';

dotenv.config();

const SCAFFOLDING_COMMON_PRESET = {
  name: 'Scaffolding Common',
  description: 'Common scaffolding inventory items used across businesses. Includes props, standards, ledgers, plates, and accessories.',
  tags: ['scaffolding', 'construction', 'common'],
  isSystem: true,
  isPublic: true,
  isActive: true,
  items: [
    // Prop (7 items)
    { code: 'PROP2X2', name: 'Prop 2x2 mtr', category: 'Prop', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'PROP2X3', name: 'Prop 2x3 mtr', category: 'Prop', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'PROP3X3', name: 'Prop 3x3 mtr', category: 'Prop', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'INNER1', name: 'Inner 1 mtr', category: 'Prop', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'INNER2', name: 'Inner 2 mtr', category: 'Prop', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'INNER3', name: 'Inner 3 mtr', category: 'Prop', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'OUTER2', name: 'Outer 2 mtr', category: 'Prop', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },

    // Standard (5 items)
    { code: 'STAND1', name: 'Standard 1 mtr', category: 'Standard', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'STAND1.5', name: 'Standard 1.5 mtr', category: 'Standard', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'STAND2', name: 'Standard 2 mtr', category: 'Standard', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'STAND2.5', name: 'Standard 2.5 mtr', category: 'Standard', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'STAND3', name: 'Standard 3 mtr', category: 'Standard', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },

    // Ledger (5 items)
    { code: 'LEDGER0.5', name: 'Ledger 0.5 mtr', category: 'Ledger', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'LEDGER0.85', name: 'Ledger 0.85 mtr', category: 'Ledger', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'LEDGER1', name: 'Ledger 1 mtr', category: 'Ledger', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'LEDGER1.5', name: 'Ledger 1.5 mtr', category: 'Ledger', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'LEDGER2', name: 'Ledger 2 mtr', category: 'Ledger', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },

    // Plate (4 items)
    { code: 'PLATE2X2', name: 'Plate 2x2', category: 'Plate', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'PLATE3X1', name: 'Plate 3x1', category: 'Plate', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'PLATE3X1.5', name: 'Plate 3x1.5', category: 'Plate', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'PLATE3X2', name: 'Plate 3x2', category: 'Plate', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },

    // Accessories (15 items)
    { code: 'JPIN', name: 'Joint Pin', category: 'Accessories', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'BASEJ', name: 'Base Jack', category: 'Accessories', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'BASEP', name: 'Base Plate', category: 'Accessories', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'UJACK', name: 'U Jack', category: 'Accessories', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'CHANNEL', name: 'Channel', category: 'Accessories', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'CLAMP', name: 'Clamp', category: 'Accessories', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'CHALI', name: 'Chali', category: 'Accessories', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'CHUDI', name: 'Chudi', category: 'Accessories', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'KATORI', name: 'Katori', category: 'Accessories', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'BOTTOMC', name: 'Bottom Cup', category: 'Accessories', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'NUT', name: 'Nut', category: 'Accessories', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'BLADE', name: 'Blade', category: 'Accessories', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'ANGLE', name: 'Angle', category: 'Accessories', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'USHORT', name: 'U Short', category: 'Accessories', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
    { code: 'SLEEVE', name: 'Sleeve with Nut', category: 'Accessories', unit: 'pcs', defaultRatePerDay: 0, damageRate: 0 },
  ],
};

async function seed() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/billpromax';

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected.');

  // Idempotent: check if preset already exists
  const existing = await InventoryPreset.findOne({ name: 'Scaffolding Common' });
  if (existing) {
    console.log('Scaffolding Common preset already exists. Skipping seed.');
    await mongoose.disconnect();
    return;
  }

  const preset = await InventoryPreset.create(SCAFFOLDING_COMMON_PRESET);
  console.log(`Seeded "Scaffolding Common" preset with ${preset.items.length} items. ID: ${preset._id}`);

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
