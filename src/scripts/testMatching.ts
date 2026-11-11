/**
 * @file Matching smoke test
 * @description Dev harness to eyeball EntityMatchingService output against real
 * (prod) catalog vectors. Not part of the app runtime.
 *
 * Usage:
 *   DB_ENV=prod ts-node -r tsconfig-paths/register src/scripts/testMatching.ts <businessId>
 */

import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../config';
import { entityMatchingService } from '../services/EntityMatchingService';
import { Party } from '../models/Party';
import { Types } from 'mongoose';

async function main(): Promise<void> {
  const businessId = process.argv[2];
  if (!businessId) throw new Error('Pass a businessId as the first arg');
  await connectDatabase();

  const itemTokens = ['S PROP 2x2', 'LADDER 1.5mtr', 'Steel Plate 3x2', 'JOINT PIN'];
  const itemResults = await entityMatchingService.matchItems(businessId, itemTokens);
  itemTokens.forEach((t, i) => {
    console.log(`\nITEM "${t}":`);
    itemResults[i].slice(0, 3).forEach((c) =>
      console.log(`  ${c.score.toFixed(4)}  ${c.code}  ${c.name}`)
    );
  });

  // Pick a real party for name + GSTIN tests
  const party = await Party.findOne({
    businessId: new Types.ObjectId(businessId),
    isActive: true,
    'contact.gst': { $exists: true, $ne: '' },
  })
    .select('name contact.gst')
    .lean();

  if (party) {
    console.log(`\nPARTY by name "${party.name}":`);
    (await entityMatchingService.matchParty(businessId, { name: party.name }))
      .slice(0, 3)
      .forEach((c) => console.log(`  ${c.score.toFixed(4)}  ${c.name}  gst=${c.gst || '-'}`));

    console.log(`\nPARTY by GSTIN "${party.contact?.gst}" (expect exact):`);
    (await entityMatchingService.matchParty(businessId, { gstin: party.contact?.gst })).forEach((c) =>
      console.log(`  exact=${c.exact}  ${c.name}  gst=${c.gst}`)
    );
  } else {
    console.log('\n(no party with GSTIN found for this business)');
  }

  await disconnectDatabase();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
