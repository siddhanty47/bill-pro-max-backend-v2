/**
 * @file Challan assistant tools
 * @description Tools that turn an attached challan photo into a real challan:
 *
 *   1. extract_challan_from_photo (read)  — runs the existing two-stage vision +
 *      semantic-match pipeline on the image the user attached THIS turn, returning
 *      a catalog-resolved draft (party/agreement/item ids + quantities).
 *   2. create_challan (write, confirm-gated) — creates the challan from a resolved
 *      payload, reusing createChallanSchema for validation and ChallanService for
 *      the actual write (so inventory checks + audit logging fire as in REST).
 *
 * This is the resolution the original v1 note said create_challan needed before it
 * could be exposed — the extraction stage supplies the ids, so the model never
 * invents them.
 */

import { ChallanService } from '../../ChallanService';
import { challanExtractionService } from '../../ChallanExtractionService';
import { createChallanSchema, AuditPerformer } from '../../../types/api';
import { AssistantTool, ToolContext } from './types';

const challanService = new ChallanService();

const performerOf = (ctx: ToolContext): AuditPerformer => ({ userId: ctx.user.id, name: ctx.user.name });

/** First image the user attached this turn, or undefined. */
function firstImage(ctx: ToolContext) {
  return (ctx.attachments || []).find((a) => a.kind === 'image');
}

export const challanTools: AssistantTool[] = [
  {
    name: 'extract_challan_from_photo',
    description:
      'Read the challan photo the user attached to this message and return a draft with the ' +
      'challan type, resolved party/agreement ids, matched line items (itemId + quantity), ' +
      'damaged items, transport details, dates, a confidence level and warnings. ' +
      'Call this when the user attaches a photo of a delivery/return challan and wants to add it. ' +
      'After reviewing the draft with the user, call create_challan to actually save it. ' +
      'Only works when an image is attached to the current message.',
    perm: { action: 'read', resource: 'challan' },
    isWrite: false,
    parameters: { type: 'object', properties: {} },
    async handler(_input, ctx: ToolContext) {
      const img = firstImage(ctx);
      if (!img) {
        throw new Error('No photo is attached to this message. Ask the user to attach a challan photo.');
      }
      const draft = await challanExtractionService.extractAndMatch(img.buffer, img.mimeType, ctx.businessId);
      return draft;
    },
  },

  {
    name: 'create_challan',
    description:
      'Create a delivery or return challan from a RESOLVED payload (real party/agreement/item ids). ' +
      'Typically called after extract_challan_from_photo returns a draft that the user has reviewed. ' +
      'Do NOT invent ids — every itemId, partyId and agreementId must come from a tool result or the user. ' +
      'For return challans, damagedItems each need a damageRate. The user will be asked to confirm before it saves.',
    perm: { action: 'create', resource: 'challan' },
    isWrite: true,
    parameters: {
      type: 'object',
      required: ['type', 'partyId', 'agreementId', 'date', 'items'],
      properties: {
        type: { type: 'string', enum: ['delivery', 'return'], description: 'delivery = goods out, return = goods back.' },
        partyId: { type: 'string', description: 'Party id (from extract_challan_from_photo or search_parties).' },
        agreementId: { type: 'string', description: 'Agreement id for the party/site.' },
        date: { type: 'string', description: 'Challan date, ISO (YYYY-MM-DD).' },
        items: {
          type: 'array',
          description: 'Line items on the challan.',
          items: {
            type: 'object',
            required: ['itemId', 'itemName', 'quantity'],
            properties: {
              itemId: { type: 'string', description: 'Inventory item id.' },
              itemName: { type: 'string', description: 'Item name (for the record).' },
              quantity: { type: 'number', description: 'Positive integer quantity.' },
            },
          },
        },
        damagedItems: {
          type: 'array',
          description: 'Damaged/short items (return challans only). Each needs a damageRate.',
          items: {
            type: 'object',
            required: ['itemId', 'itemName', 'quantity', 'damageRate'],
            properties: {
              itemId: { type: 'string' },
              itemName: { type: 'string' },
              quantity: { type: 'number' },
              damageRate: { type: 'number', description: 'Charge per damaged unit in INR.' },
              note: { type: 'string' },
              lossType: { type: 'string', enum: ['damage', 'short', 'need_repair'] },
            },
          },
        },
        transporterName: { type: 'string', description: 'Transporter name (optional).' },
        vehicleNumber: { type: 'string', description: 'Vehicle number (optional).' },
        cartageCharge: { type: 'number', description: 'Cartage amount in INR (optional).' },
        loadingCharge: { type: 'number', description: 'Loading charge in INR (optional).' },
        unloadingCharge: { type: 'number', description: 'Unloading charge in INR (optional).' },
        notes: { type: 'string', description: 'Freeform notes (optional).' },
      },
    },
    async handler(input, ctx: ToolContext) {
      // Reuse the REST validation schema — coerces the date and enforces shape.
      const parsed = createChallanSchema.safeParse(input);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
        throw new Error(`Invalid challan payload — ${msg}`);
      }
      const challan = await challanService.createChallan(ctx.businessId, parsed.data, performerOf(ctx));
      return {
        created: true,
        challanId: challan._id.toString(),
        challanNumber: challan.challanNumber,
        type: challan.type,
        itemCount: challan.items?.length ?? 0,
      };
    },
  },
];
