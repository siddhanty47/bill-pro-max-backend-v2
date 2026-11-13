/**
 * @file Read-only assistant tools
 * @description Information-retrieval tools. Each wraps an existing service method,
 * stays within the caller's business scope, and returns a COMPACT projection
 * (ids + the few fields the model needs) to keep token usage low. No mutations.
 */

import { PartyService } from '../../PartyService';
import { InventoryService } from '../../InventoryService';
import { ChallanService } from '../../ChallanService';
import { BillingService } from '../../BillingService';
import { StatementService } from '../../StatementService';
import { AssistantTool, ToolContext } from './types';

// Service singletons (no-arg constructors, same as controllers).
const partyService = new PartyService();
const inventoryService = new InventoryService();
const challanService = new ChallanService();
const billingService = new BillingService();
const statementService = new StatementService();

// ---- small coercion helpers (tool input arrives as unknown JSON) -------------
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && !Number.isNaN(v) ? v : undefined);
const toDate = (v: unknown): Date | undefined => {
  const s = str(v);
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
};
const clampLimit = (v: unknown, def = 10, max = 25): number => Math.min(num(v) ?? def, max);

export const readTools: AssistantTool[] = [
  {
    name: 'search_parties',
    description:
      'Find parties (clients/suppliers) by name or contact. Returns id, code, name, roles, phone, GSTIN. ' +
      'Use the returned partyId with other tools. Omit query to list recent parties.',
    perm: { action: 'read', resource: 'party' },
    isWrite: false,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name or contact-person text to search for.' },
        role: { type: 'string', enum: ['client', 'supplier'], description: 'Restrict to clients or suppliers.' },
        limit: { type: 'number', description: 'Max results (default 10, max 25).' },
      },
    },
    async handler(input, ctx: ToolContext) {
      const result = await partyService.getParties(
        ctx.businessId,
        { search: str(input.query), role: str(input.role) as 'client' | 'supplier' | undefined, isActive: true },
        { page: 1, pageSize: clampLimit(input.limit) }
      );
      return {
        count: result.pagination.total,
        parties: result.data.map((p) => ({
          partyId: p._id.toString(),
          code: p.code,
          name: p.name,
          roles: p.roles,
          phone: p.contact?.phone,
          gstin: p.contact?.gst,
          siteCount: p.sites?.length ?? 0,
        })),
      };
    },
  },

  {
    name: 'get_party_ledger',
    description:
      'Get a party\'s financial ledger (bills as debits, payments as credits) for a date range. ' +
      'Returns opening/closing balance, totals, and entries. Defaults to the last 12 months.',
    perm: { action: 'read', resource: 'report' },
    isWrite: false,
    parameters: {
      type: 'object',
      required: ['partyId'],
      properties: {
        partyId: { type: 'string', description: 'Party id (from search_parties).' },
        from: { type: 'string', description: 'ISO start date (optional).' },
        to: { type: 'string', description: 'ISO end date (optional, defaults to today).' },
      },
    },
    async handler(input, ctx: ToolContext) {
      const partyId = str(input.partyId);
      if (!partyId) throw new Error('partyId is required');
      const to = toDate(input.to) ?? new Date();
      const from = toDate(input.from) ?? new Date(to.getTime() - 365 * 24 * 60 * 60 * 1000);
      const ledger = await statementService.generateLedgerStatement(ctx.businessId, partyId, from, to);
      return {
        party: ledger.party?.name,
        period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
        openingBalance: ledger.openingBalance,
        totalDebits: ledger.totalDebits,
        totalCredits: ledger.totalCredits,
        closingBalance: ledger.closingBalance,
        currency: ledger.currency,
        entryCount: ledger.entries.length,
        entries: ledger.entries.slice(-20).map((e) => ({
          date: new Date(e.date).toISOString().slice(0, 10),
          description: e.description,
          reference: e.reference,
          debit: e.debit,
          credit: e.credit,
          balance: e.balance,
        })),
      };
    },
  },

  {
    name: 'get_outstanding_balance',
    description:
      'Get the current total outstanding (receivable) balance for a party — all bills minus all completed payments to date.',
    perm: { action: 'read', resource: 'report' },
    isWrite: false,
    parameters: {
      type: 'object',
      required: ['partyId'],
      properties: { partyId: { type: 'string', description: 'Party id (from search_parties).' } },
    },
    async handler(input, ctx: ToolContext) {
      const partyId = str(input.partyId);
      if (!partyId) throw new Error('partyId is required');
      const to = new Date();
      const ledger = await statementService.generateLedgerStatement(ctx.businessId, partyId, new Date(0), to);
      return {
        party: ledger.party?.name,
        outstandingBalance: ledger.closingBalance,
        currency: ledger.currency,
        asOf: to.toISOString().slice(0, 10),
      };
    },
  },

  {
    name: 'list_overdue_bills',
    description: 'List bills whose due date has passed and are not fully paid. Returns bill number, party, amount, due date.',
    perm: { action: 'read', resource: 'bill' },
    isWrite: false,
    parameters: { type: 'object', properties: {} },
    async handler(_input, ctx: ToolContext) {
      const bills = await billingService.getOverdueBills(ctx.businessId);
      return {
        count: bills.length,
        bills: bills.map((b) => ({
          billId: b._id.toString(),
          billNumber: b.billNumber,
          partyId: b.partyId?.toString(),
          totalAmount: b.totalAmount,
          amountPaid: b.amountPaid,
          balance: b.totalAmount - (b.amountPaid ?? 0),
          dueDate: new Date(b.dueDate).toISOString().slice(0, 10),
          status: b.status,
        })),
      };
    },
  },

  {
    name: 'search_inventory',
    description:
      'Find inventory items by name/code. Returns id, code, name, category, total quantity, unit, default rate. ' +
      'Note: this is catalog data; live "available now" quantity is not included in v1.',
    perm: { action: 'read', resource: 'inventory' },
    isWrite: false,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name or code text to search for.' },
        category: { type: 'string', description: 'Restrict to a category.' },
        limit: { type: 'number', description: 'Max results (default 10, max 25).' },
      },
    },
    async handler(input, ctx: ToolContext) {
      const result = await inventoryService.getInventory(
        ctx.businessId,
        { search: str(input.query), category: str(input.category), isActive: true },
        { page: 1, pageSize: clampLimit(input.limit) }
      );
      return {
        count: result.pagination.total,
        items: result.data.map((i) => ({
          itemId: i._id.toString(),
          code: i.code,
          name: i.name,
          category: i.category,
          totalQuantity: i.totalQuantity,
          unit: i.unit,
          rate: i.defaultRatePerDay,
        })),
      };
    },
  },

  {
    name: 'get_inventory_item',
    description: 'Get full details for one inventory item by id: code, name, category, total quantity, unit, rate, description.',
    perm: { action: 'read', resource: 'inventory' },
    isWrite: false,
    parameters: {
      type: 'object',
      required: ['itemId'],
      properties: { itemId: { type: 'string', description: 'Inventory item id (from search_inventory).' } },
    },
    async handler(input, ctx: ToolContext) {
      const itemId = str(input.itemId);
      if (!itemId) throw new Error('itemId is required');
      const i = await inventoryService.getItemById(ctx.businessId, itemId);
      return {
        itemId: i._id.toString(),
        code: i.code,
        name: i.name,
        category: i.category,
        totalQuantity: i.totalQuantity,
        unit: i.unit,
        rate: i.defaultRatePerDay,
        description: i.description,
      };
    },
  },

  {
    name: 'list_challans',
    description:
      'List delivery/return challans, optionally filtered by party, type, status, or date range. ' +
      'Returns challan number, type, party, date, status, item count.',
    perm: { action: 'read', resource: 'challan' },
    isWrite: false,
    parameters: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'Restrict to one party.' },
        type: { type: 'string', enum: ['delivery', 'return'], description: 'Challan type.' },
        status: { type: 'string', description: 'Challan status (e.g. draft, confirmed, cancelled).' },
        from: { type: 'string', description: 'ISO start date.' },
        to: { type: 'string', description: 'ISO end date.' },
        limit: { type: 'number', description: 'Max results (default 10, max 25).' },
      },
    },
    async handler(input, ctx: ToolContext) {
      const result = await challanService.getChallans(
        ctx.businessId,
        {
          partyId: str(input.partyId),
          type: str(input.type) as 'delivery' | 'return' | undefined,
          status: str(input.status) as never,
          dateFrom: toDate(input.from),
          dateTo: toDate(input.to),
        },
        { page: 1, pageSize: clampLimit(input.limit) }
      );
      return {
        count: result.pagination.total,
        challans: result.data.map((c) => ({
          challanId: c._id.toString(),
          challanNumber: c.challanNumber,
          type: c.type,
          partyId: c.partyId?.toString(),
          date: new Date(c.date).toISOString().slice(0, 10),
          status: c.status,
          itemCount: c.items?.length ?? 0,
        })),
      };
    },
  },

  {
    name: 'get_bill',
    description: 'Get one bill by id: number, party, amounts, status, due date, and line-item count.',
    perm: { action: 'read', resource: 'bill' },
    isWrite: false,
    parameters: {
      type: 'object',
      required: ['billId'],
      properties: { billId: { type: 'string', description: 'Bill id.' } },
    },
    async handler(input, ctx: ToolContext) {
      const billId = str(input.billId);
      if (!billId) throw new Error('billId is required');
      const b = await billingService.getBillById(ctx.businessId, billId);
      return {
        billId: b._id.toString(),
        billNumber: b.billNumber,
        partyId: b.partyId?.toString(),
        totalAmount: b.totalAmount,
        amountPaid: b.amountPaid,
        balance: b.totalAmount - (b.amountPaid ?? 0),
        status: b.status,
        dueDate: new Date(b.dueDate).toISOString().slice(0, 10),
        lineItemCount: (b as unknown as { items?: unknown[] }).items?.length ?? 0,
      };
    },
  },
];
