/**
 * @file End-to-end extraction smoke test
 * @description Runs the full extractAndMatch pipeline on a local image file.
 * Dev harness only.
 *
 * Usage:
 *   DB_ENV=prod ts-node -r tsconfig-paths/register src/scripts/testExtraction.ts <businessId> <imagePath>
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { connectDatabase, disconnectDatabase } from '../config';
import { challanExtractionService } from '../services/ChallanExtractionService';

function mimeFor(path: string): string {
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function main(): Promise<void> {
  const [businessId, imagePath] = process.argv.slice(2);
  if (!businessId || !imagePath) throw new Error('Usage: <businessId> <imagePath>');

  await connectDatabase();
  const buffer = readFileSync(imagePath);
  const result = await challanExtractionService.extractAndMatch(buffer, mimeFor(imagePath), businessId);

  console.log('\n===== EXTRACTED =====');
  console.log(JSON.stringify(result, null, 2));

  await disconnectDatabase();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
