/**
 * @file Statement Service
 * @description Business logic for generating party statement data (ledger, bills, items, aging)
 */

import { Types } from 'mongoose';
import {
  BillRepository,
  PaymentRepository,
  ChallanRepository,
  PartyRepository,
  BusinessRepository,
} from '../repositories';
import { IBill, IPayment, IChallan, IParty, IBusiness } from '../models';
import { NotFoundError } from '../middleware';
import { logger } from '../utils/logger';

// ============ Data Structures ============

export interface StatementBusiness {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  gst?: string;
}

export interface StatementParty {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  gst?: string;
}

export interface StatementPeriod {
  from: Date;
  to: Date;
}

export interface LedgerEntry {
  date: Date;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface LedgerStatementData {
  business: StatementBusiness;
  party: StatementParty;
  period: StatementPeriod;
  openingBalance: number;
  entries: LedgerEntry[];
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
  currency: string;
}

export interface BillStatementRow {
  billNumber: string;
  billDate: Date;
  periodStart?: Date;
  periodEnd?: Date;
  siteCode: string;
  rentCharges: number;
  transportationCharges: number;
  damageCharges: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
}

export interface BillStatementTotals {
  rentCharges: number;
  transportationCharges: number;
  damageCharges: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  billCount: number;
}

export interface BillStatementData {
  business: StatementBusiness;
  party: StatementParty;
  period: StatementPeriod;
  siteCode?: string;
  bills: BillStatementRow[];
  totals: BillStatementTotals;
  currency: string;
}

export interface ItemEvent {
  date: Date;
  challanNumber: string;
  type: 'delivery' | 'return';
  quantity: number;
  runningQty: number;
}

export interface ItemDamages {
  damaged: number;
  short: number;
  needRepair: number;
}

export interface ItemStatementItem {
  itemName: string;
  itemId: string;
  openingQty: number;
  events: ItemEvent[];
  totalDelivered: number;
  totalReturned: number;
  closingQty: number;
  damages: ItemDamages;
}

export interface ItemStatementData {
  business: StatementBusiness;
  party: StatementParty;
  period: StatementPeriod;
  items: ItemStatementItem[];
  grandTotals: {
    totalDelivered: number;
    totalReturned: number;
    netHeld: number;
    totalDamaged: number;
    totalShort: number;
  };
}

export interface AgingBill {
  billNumber: string;
  billDate: Date;
  dueDate: Date;
  daysOverdue: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  bucket: string;
}

export interface AgingBuckets {
  current: number;
  days31_60: number;
  days61_90: number;
  days90Plus: number;
}

export interface AgingStatementData {
  business: StatementBusiness;
  party: StatementParty;
  asOfDate: Date;
  bills: AgingBill[];
  buckets: AgingBuckets;
  grandTotal: number;
  currency: string;
}

// ============ Service ============

export class StatementService {
  private billRepository: BillRepository;
  private paymentRepository: PaymentRepository;
  private challanRepository: ChallanRepository;
  private partyRepository: PartyRepository;
  private businessRepository: BusinessRepository;

  constructor() {
    this.billRepository = new BillRepository();
    this.paymentRepository = new PaymentRepository();
    this.challanRepository = new ChallanRepository();
    this.partyRepository = new PartyRepository();
    this.businessRepository = new BusinessRepository();
  }

  private async getPartyAndBusiness(businessId: string, partyId: string) {
    const [business, party] = await Promise.all([
      this.businessRepository.findById(businessId),
      this.partyRepository.findById(partyId),
    ]);
    if (!business) throw new NotFoundError('Business not found');
    if (!party) throw new NotFoundError('Party not found');
    return { business, party };
  }

  private toStatementBusiness(b: IBusiness): StatementBusiness {
    return {
      name: b.name,
      address: b.address,
      phone: b.phone,
      email: b.email,
      gst: b.gst,
    };
  }

  private toStatementParty(p: IParty): StatementParty {
    return {
      name: p.name,
      code: p.code,
      address: p.contact?.address,
      phone: p.contact?.phone,
      gst: p.contact?.gst,
    };
  }

  private getBillDate(bill: IBill): Date {
    return bill.billDate ?? bill.billingPeriod?.end ?? bill.createdAt;
  }

  private getSiteCodeForBill(bill: IBill, party: IParty): string {
    const agreement = party.agreements?.find(a => a.agreementId === bill.agreementId);
    return agreement?.siteCode ?? '';
  }

  // ============ Ledger Statement ============

  async generateLedgerStatement(
    businessId: string,
    partyId: string,
    from: Date,
    to: Date,
    agreementId?: string,
  ): Promise<LedgerStatementData> {
    const { business, party } = await this.getPartyAndBusiness(businessId, partyId);

    let bills = await this.billRepository.findByParty(businessId, partyId);
    bills = bills.filter(b => b.status !== 'cancelled');

    let payments = await this.paymentRepository.findByParty(businessId, partyId);
    payments = payments.filter(p => p.type === 'receivable' && p.status === 'completed');

    if (agreementId) {
      bills = bills.filter(b => b.agreementId === agreementId);
      const matchingBillIds = new Set(bills.map(b => b._id.toString()));
      payments = payments.filter(
        p => !p.billId || matchingBillIds.has(p.billId.toString()),
      );
    }

    // Opening balance: sum(bills) - sum(payments) where date < from
    let openingBalance = 0;
    for (const bill of bills) {
      if (this.getBillDate(bill) < from) {
        openingBalance += bill.totalAmount;
      }
    }
    for (const payment of payments) {
      if (new Date(payment.date) < from) {
        openingBalance -= payment.amount;
      }
    }

    // Period entries: merge bills (debit) + payments (credit) within [from, to]
    const entries: Array<{ date: Date; description: string; reference: string; debit: number; credit: number }> = [];

    for (const bill of bills) {
      const billDate = this.getBillDate(bill);
      if (billDate >= from && billDate <= to) {
        entries.push({
          date: billDate,
          description: `Bill - ${bill.billNumber}`,
          reference: bill.billNumber,
          debit: bill.totalAmount,
          credit: 0,
        });
      }
    }

    for (const payment of payments) {
      const paymentDate = new Date(payment.date);
      if (paymentDate >= from && paymentDate <= to) {
        entries.push({
          date: paymentDate,
          description: `Payment - ${payment.method.replace('_', ' ')}`,
          reference: payment.reference || '-',
          debit: 0,
          credit: payment.amount,
        });
      }
    }

    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Running balance
    let runningBalance = openingBalance;
    const ledgerEntries: LedgerEntry[] = entries.map(e => {
      runningBalance += e.debit - e.credit;
      return { ...e, balance: runningBalance };
    });

    const totalDebits = ledgerEntries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredits = ledgerEntries.reduce((sum, e) => sum + e.credit, 0);

    return {
      business: this.toStatementBusiness(business),
      party: this.toStatementParty(party),
      period: { from, to },
      openingBalance,
      entries: ledgerEntries,
      totalDebits,
      totalCredits,
      closingBalance: runningBalance,
      currency: 'INR',
    };
  }

  // ============ Bill Statement ============

  async generateBillStatement(
    businessId: string,
    partyId: string,
    from: Date,
    to: Date,
    agreementId?: string,
  ): Promise<BillStatementData> {
    const { business, party } = await this.getPartyAndBusiness(businessId, partyId);

    let bills = await this.billRepository.findByParty(businessId, partyId);
    bills = bills.filter(b => {
      if (b.status === 'cancelled') return false;
      const billDate = this.getBillDate(b);
      return billDate >= from && billDate <= to;
    });

    if (agreementId) {
      bills = bills.filter(b => b.agreementId === agreementId);
    }

    bills.sort((a, b) => this.getBillDate(a).getTime() - this.getBillDate(b).getTime());

    // Determine site codes
    const siteCodes = new Set<string>();
    for (const bill of bills) {
      siteCodes.add(this.getSiteCodeForBill(bill, party));
    }
    const singleSite = siteCodes.size === 1 ? [...siteCodes][0] : undefined;

    const rows: BillStatementRow[] = bills.map(bill => {
      const rentCharges = bill.subtotal - (bill.transportationCharges ?? 0) - (bill.damageCharges ?? 0);
      return {
        billNumber: bill.billNumber,
        billDate: this.getBillDate(bill),
        periodStart: bill.billingPeriod?.start,
        periodEnd: bill.billingPeriod?.end,
        siteCode: this.getSiteCodeForBill(bill, party),
        rentCharges,
        transportationCharges: bill.transportationCharges ?? 0,
        damageCharges: bill.damageCharges ?? 0,
        subtotal: bill.subtotal,
        taxAmount: bill.taxAmount,
        discountAmount: bill.discountAmount,
        totalAmount: bill.totalAmount,
      };
    });

    const totals: BillStatementTotals = {
      rentCharges: rows.reduce((s, r) => s + r.rentCharges, 0),
      transportationCharges: rows.reduce((s, r) => s + r.transportationCharges, 0),
      damageCharges: rows.reduce((s, r) => s + r.damageCharges, 0),
      subtotal: rows.reduce((s, r) => s + r.subtotal, 0),
      taxAmount: rows.reduce((s, r) => s + r.taxAmount, 0),
      discountAmount: rows.reduce((s, r) => s + r.discountAmount, 0),
      totalAmount: rows.reduce((s, r) => s + r.totalAmount, 0),
      billCount: rows.length,
    };

    return {
      business: this.toStatementBusiness(business),
      party: this.toStatementParty(party),
      period: { from, to },
      siteCode: singleSite || undefined,
      bills: rows,
      totals,
      currency: 'INR',
    };
  }

  // ============ Item Statement ============

  async generateItemStatement(
    businessId: string,
    partyId: string,
    from: Date,
    to: Date,
    agreementId?: string,
  ): Promise<ItemStatementData> {
    const { business, party } = await this.getPartyAndBusiness(businessId, partyId);

    // Fetch all confirmed challans for the party
    const allChallans = await this.challanRepository.findByParty(businessId, partyId);
    const challans = agreementId
      ? allChallans.filter(c => c.agreementId === agreementId)
      : allChallans;

    // Group by item
    const itemMap = new Map<string, {
      itemName: string;
      openingDelivered: number;
      openingReturned: number;
      events: ItemEvent[];
      periodDelivered: number;
      periodReturned: number;
      damages: ItemDamages;
    }>();

    const getOrCreate = (itemId: string, itemName: string) => {
      if (!itemMap.has(itemId)) {
        itemMap.set(itemId, {
          itemName,
          openingDelivered: 0,
          openingReturned: 0,
          events: [],
          periodDelivered: 0,
          periodReturned: 0,
          damages: { damaged: 0, short: 0, needRepair: 0 },
        });
      }
      return itemMap.get(itemId)!;
    };

    for (const challan of challans) {
      const challanDate = new Date(challan.date);
      const isBeforePeriod = challanDate < from;
      const isInPeriod = challanDate >= from && challanDate <= to;

      for (const item of challan.items) {
        const itemId = item.itemId.toString();
        const entry = getOrCreate(itemId, item.itemName);

        if (isBeforePeriod) {
          if (challan.type === 'delivery') {
            entry.openingDelivered += item.quantity;
          } else {
            entry.openingReturned += item.quantity;
          }
        } else if (isInPeriod) {
          if (challan.type === 'delivery') {
            entry.periodDelivered += item.quantity;
          } else {
            entry.periodReturned += item.quantity;
          }
          entry.events.push({
            date: challanDate,
            challanNumber: challan.challanNumber,
            type: challan.type,
            quantity: item.quantity,
            runningQty: 0, // computed below
          });
        }
      }

      // Damage tracking from return challans in period
      if (challan.type === 'return' && challanDate >= from && challanDate <= to) {
        const damagedItems = (challan as any).damagedItems || [];
        for (const dmg of damagedItems) {
          const itemId = dmg.itemId.toString();
          const entry = getOrCreate(itemId, dmg.itemName);
          const lossType = dmg.lossType ?? 'damage';
          if (lossType === 'damage') entry.damages.damaged += dmg.quantity;
          else if (lossType === 'short') entry.damages.short += dmg.quantity;
          else if (lossType === 'need_repair') entry.damages.needRepair += dmg.quantity;
        }
      }
    }

    // Build items array with running quantities
    const items: ItemStatementItem[] = [];
    let grandTotalDelivered = 0;
    let grandTotalReturned = 0;
    let grandTotalDamaged = 0;
    let grandTotalShort = 0;

    for (const [itemId, data] of itemMap) {
      const openingQty = data.openingDelivered - data.openingReturned;

      // Sort events by date
      data.events.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Compute running qty
      let runningQty = openingQty;
      for (const event of data.events) {
        if (event.type === 'delivery') {
          runningQty += event.quantity;
        } else {
          runningQty -= event.quantity;
        }
        event.runningQty = runningQty;
      }

      const closingQty = runningQty;

      items.push({
        itemName: data.itemName,
        itemId,
        openingQty,
        events: data.events,
        totalDelivered: data.periodDelivered,
        totalReturned: data.periodReturned,
        closingQty,
        damages: data.damages,
      });

      grandTotalDelivered += data.periodDelivered;
      grandTotalReturned += data.periodReturned;
      grandTotalDamaged += data.damages.damaged;
      grandTotalShort += data.damages.short;
    }

    // Sort items by name
    items.sort((a, b) => a.itemName.localeCompare(b.itemName));

    return {
      business: this.toStatementBusiness(business),
      party: this.toStatementParty(party),
      period: { from, to },
      items,
      grandTotals: {
        totalDelivered: grandTotalDelivered,
        totalReturned: grandTotalReturned,
        netHeld: grandTotalDelivered - grandTotalReturned,
        totalDamaged: grandTotalDamaged,
        totalShort: grandTotalShort,
      },
    };
  }

  // ============ Aging Statement ============

  async generateAgingStatement(
    businessId: string,
    partyId: string,
    from: Date,
    to: Date,
    agreementId?: string,
  ): Promise<AgingStatementData> {
    const { business, party } = await this.getPartyAndBusiness(businessId, partyId);

    let bills = await this.billRepository.findByParty(businessId, partyId);
    // Filter to unpaid/partial bills as of `to` date
    bills = bills.filter(b => {
      if (['paid', 'cancelled'].includes(b.status)) return false;
      const billDate = this.getBillDate(b);
      return billDate <= to;
    });

    if (agreementId) {
      bills = bills.filter(b => b.agreementId === agreementId);
    }

    const asOfDate = to;
    const asOfMs = asOfDate.getTime();

    const agingBills: AgingBill[] = bills.map(bill => {
      const dueDate = new Date(bill.dueDate);
      const daysOverdue = Math.max(0, Math.floor((asOfMs - dueDate.getTime()) / (1000 * 3600 * 24)));
      const balanceDue = bill.totalAmount - bill.amountPaid;

      let bucket: string;
      if (daysOverdue <= 30) bucket = 'Current (0-30)';
      else if (daysOverdue <= 60) bucket = '31-60 Days';
      else if (daysOverdue <= 90) bucket = '61-90 Days';
      else bucket = '90+ Days';

      return {
        billNumber: bill.billNumber,
        billDate: this.getBillDate(bill),
        dueDate,
        daysOverdue,
        totalAmount: bill.totalAmount,
        amountPaid: bill.amountPaid,
        balanceDue,
        bucket,
      };
    });

    agingBills.sort((a, b) => b.daysOverdue - a.daysOverdue);

    const buckets: AgingBuckets = {
      current: 0,
      days31_60: 0,
      days61_90: 0,
      days90Plus: 0,
    };

    for (const bill of agingBills) {
      if (bill.daysOverdue <= 30) buckets.current += bill.balanceDue;
      else if (bill.daysOverdue <= 60) buckets.days31_60 += bill.balanceDue;
      else if (bill.daysOverdue <= 90) buckets.days61_90 += bill.balanceDue;
      else buckets.days90Plus += bill.balanceDue;
    }

    const grandTotal = buckets.current + buckets.days31_60 + buckets.days61_90 + buckets.days90Plus;

    return {
      business: this.toStatementBusiness(business),
      party: this.toStatementParty(party),
      asOfDate,
      bills: agingBills,
      buckets,
      grandTotal,
      currency: 'INR',
    };
  }
}
