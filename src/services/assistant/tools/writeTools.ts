/**
 * @file Write assistant tools
 * @description Mutating tools. The agent loop ONLY runs these after the user
 * confirms (ToolContext.confirmed === true) and after the per-tool RBAC check.
 * Each wraps an existing service method and passes a `performer` so the mutation
 * is audit-logged exactly like a REST call.
 *
 * `create_challan` lives in `challanTools.ts`, not here: it depends on the
 * photo-scan extraction pipeline (`extract_challan_from_photo`) to resolve
 * party/item/agreement ids first, so the model never invents them.
 */

import { PartyService } from '../../PartyService';
import { PaymentService } from '../../PaymentService';
import { InventoryService } from '../../InventoryService';
import { AuditPerformer } from '../../../types/api';
import { AssistantTool, ToolContext } from './types';

const partyService = new PartyService();
const paymentService = new PaymentService();
const inventoryService = new InventoryService();

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && !Number.isNaN(v) ? v : undefined);
const toDate = (v: unknown): Date | undefined => {
  const s = str(v);
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
};
const performerOf = (ctx: ToolContext): AuditPerformer => ({ userId: ctx.user.id, name: ctx.user.name });

export const writeTools: AssistantTool[] = [
  {
    name: 'create_party',
    description:
      'Create a new party (client or supplier). Requires name, role, contact person, phone, and an initial site address.',
    perm: { action: 'create', resource: 'party' },
    isWrite: true,
    parameters: {
      type: 'object',
      required: ['name', 'role', 'contactPerson', 'phone', 'siteAddress'],
      properties: {
        name: { type: 'string', description: 'Party/business name.' },
        role: { type: 'string', enum: ['client', 'supplier'], description: 'Whether this is a client or supplier.' },
        contactPerson: { type: 'string', description: 'Primary contact person name.' },
        phone: { type: 'string', description: 'Contact phone number.' },
        email: { type: 'string', description: 'Contact email (optional).' },
        gstin: { type: 'string', description: 'GST number (optional).' },
        siteAddress: { type: 'string', description: 'Address of the initial site.' },
        stateCode: { type: 'string', description: '2-digit GST state code (optional).' },
        notes: { type: 'string', description: 'Freeform notes (optional).' },
      },
    },
    async handler(input, ctx: ToolContext) {
      const name = str(input.name);
      const role = str(input.role) as 'client' | 'supplier' | undefined;
      const contactPerson = str(input.contactPerson);
      const phone = str(input.phone);
      const siteAddress = str(input.siteAddress);
      if (!name || !role || !contactPerson || !phone || !siteAddress) {
        throw new Error('name, role, contactPerson, phone and siteAddress are all required.');
      }
      const party = await partyService.createParty(
        ctx.businessId,
        {
          name,
          roles: [role],
          contact: {
            person: contactPerson,
            phone,
            email: str(input.email),
            gst: str(input.gstin),
            stateCode: str(input.stateCode),
          },
          notes: str(input.notes),
          initialSite: { address: siteAddress, stateCode: str(input.stateCode) },
        },
        performerOf(ctx)
      );
      return { created: true, partyId: party._id.toString(), code: party.code, name: party.name };
    },
  },

  {
    name: 'record_payment',
    description:
      'Record a payment. type "receivable" = money received from a client; "payable" = money paid to a supplier. ' +
      'Optionally link to a bill. Date defaults to today.',
    perm: { action: 'create', resource: 'payment' },
    isWrite: true,
    parameters: {
      type: 'object',
      required: ['partyId', 'amount', 'method', 'type'],
      properties: {
        partyId: { type: 'string', description: 'Party id (from search_parties).' },
        amount: { type: 'number', description: 'Payment amount in INR (positive).' },
        method: { type: 'string', enum: ['cash', 'bank_transfer', 'upi', 'cheque', 'other'], description: 'Payment method.' },
        type: { type: 'string', enum: ['receivable', 'payable'], description: 'receivable = from client, payable = to supplier.' },
        billId: { type: 'string', description: 'Bill id to apply the payment to (optional).' },
        date: { type: 'string', description: 'ISO date (optional, defaults to today).' },
        reference: { type: 'string', description: 'Transaction reference / cheque no (optional).' },
        notes: { type: 'string', description: 'Freeform notes (optional).' },
      },
    },
    async handler(input, ctx: ToolContext) {
      const partyId = str(input.partyId);
      const amount = num(input.amount);
      const method = str(input.method) as 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other' | undefined;
      const type = str(input.type) as 'receivable' | 'payable' | undefined;
      if (!partyId || !amount || amount <= 0 || !method || !type) {
        throw new Error('partyId, a positive amount, method and type are required.');
      }
      const payment = await paymentService.createPayment(
        ctx.businessId,
        {
          type,
          partyId,
          billId: str(input.billId),
          amount,
          method,
          reference: str(input.reference),
          date: toDate(input.date) ?? new Date(),
          notes: str(input.notes),
        },
        performerOf(ctx)
      );
      return {
        created: true,
        paymentId: payment._id.toString(),
        amount: payment.amount,
        type: payment.type,
        method: payment.method,
      };
    },
  },

  {
    name: 'adjust_stock',
    description:
      'Adjust an inventory item\'s stock. type "purchase" adds units; "scraped" or "sold" removes units. ' +
      'Use for corrections and new purchases, NOT for rental out/in (challans handle that). Date defaults to today.',
    perm: { action: 'update', resource: 'inventory' },
    isWrite: true,
    parameters: {
      type: 'object',
      required: ['itemId', 'type', 'quantity'],
      properties: {
        itemId: { type: 'string', description: 'Inventory item id (from search_inventory).' },
        type: { type: 'string', enum: ['purchase', 'scraped', 'sold'], description: 'Adjustment type.' },
        quantity: { type: 'number', description: 'Positive integer quantity to adjust by.' },
        date: { type: 'string', description: 'ISO date (optional, defaults to today).' },
        note: { type: 'string', description: 'Reason/description (optional).' },
      },
    },
    async handler(input, ctx: ToolContext) {
      const itemId = str(input.itemId);
      const type = str(input.type) as 'purchase' | 'scraped' | 'sold' | undefined;
      const quantity = num(input.quantity);
      if (!itemId || !type || !quantity || quantity <= 0) {
        throw new Error('itemId, type and a positive quantity are required.');
      }
      const item = await inventoryService.adjustQuantity(
        ctx.businessId,
        itemId,
        { type, quantity, date: toDate(input.date) ?? new Date(), note: str(input.note) },
        performerOf(ctx)
      );
      return {
        updated: true,
        itemId: item._id.toString(),
        code: item.code,
        name: item.name,
        totalQuantity: item.totalQuantity,
      };
    },
  },
];
