/**
 * Manual end-to-end test for the AI assistant agent loop.
 * Drives AssistantService directly (bypassing HTTP auth) against the configured
 * DB, using a synthetic owner user. Exercises the real Anthropic call + read
 * tools. READ-ONLY prompts only — does not trigger any write tool.
 *
 * Run: PORT unused. `DB_ENV=prod npx ts-node -r tsconfig-paths/register src/scripts/testAssistant.ts`
 */
import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../config';
import { Business } from '../models/Business';
import { Party } from '../models/Party';
import { AssistantService, AssistantRunContext } from '../services/AssistantService';
import { BusinessScopedUser } from '../middleware/businessScope';

async function main() {
  await connectDatabase();

  const business = await Business.findOne({}).lean();
  if (!business) throw new Error('No business found in DB');
  const party = await Party.findOne({ businessId: business._id, isActive: true }).lean();

  const user = {
    id: 'test-user',
    name: 'Test Owner',
    username: 'test',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'Owner',
    roles: ['owner'],
    businessIds: [business._id.toString()],
    businessRole: 'owner',
  } as unknown as BusinessScopedUser;

  const ctx: AssistantRunContext = {
    businessId: business._id.toString(),
    businessName: business.name,
    user,
  };

  const svc = new AssistantService();
  const prompts = [
    'List my overdue bills.',
    party ? `What is the outstanding balance for ${party.name}?` : 'How many parties do I have?',
  ];

  let conversationId: string | undefined;
  for (const prompt of prompts) {
    console.log(`\n\n================ USER: ${prompt}`);
    const result = await svc.sendMessage(ctx, conversationId, prompt);
    conversationId = result.conversationId;
    if (result.status === 'completed') {
      console.log(`---------------- ASSISTANT:\n${result.message}`);
    } else {
      console.log(`---------------- STATUS: ${result.status}`, JSON.stringify(result, null, 2));
    }
  }

  await disconnectDatabase();
  process.exit(0);
}

main().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
