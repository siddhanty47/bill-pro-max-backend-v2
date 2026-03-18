/**
 * @file Statement Controller
 * @description Handles party statement PDF generation requests
 */

import { Request, Response, NextFunction } from 'express';
import { StatementService } from '../services/StatementService';
import { InvoiceGenerator } from '../billing/InvoiceGenerator';
import { logger } from '../utils/logger';

export class StatementController {
  private statementService: StatementService;
  private invoiceGenerator: InvoiceGenerator;

  constructor() {
    this.statementService = new StatementService();
    this.invoiceGenerator = new InvoiceGenerator();
  }

  getStatementPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId, id: partyId } = req.params;
      const { type, from, to, agreementId } = req.query as {
        type: string;
        from: string;
        to: string;
        agreementId?: string;
      };

      const fromDate = new Date(from);
      const toDate = new Date(to);

      let pdfBuffer: Buffer;
      let filename: string;

      switch (type) {
        case 'ledger': {
          const data = await this.statementService.generateLedgerStatement(
            businessId, partyId, fromDate, toDate, agreementId,
          );
          pdfBuffer = await this.invoiceGenerator.generateLedgerStatementPDF(data);
          filename = `ledger-${data.party.code}-${from}-${to}.pdf`;
          break;
        }
        case 'bills': {
          const data = await this.statementService.generateBillStatement(
            businessId, partyId, fromDate, toDate, agreementId,
          );
          pdfBuffer = await this.invoiceGenerator.generateBillStatementPDF(data);
          filename = `bills-${data.party.code}-${from}-${to}.pdf`;
          break;
        }
        case 'items': {
          const data = await this.statementService.generateItemStatement(
            businessId, partyId, fromDate, toDate, agreementId,
          );
          pdfBuffer = await this.invoiceGenerator.generateItemStatementPDF(data);
          filename = `items-${data.party.code}-${from}-${to}.pdf`;
          break;
        }
        case 'aging': {
          const data = await this.statementService.generateAgingStatement(
            businessId, partyId, fromDate, toDate, agreementId,
          );
          pdfBuffer = await this.invoiceGenerator.generateAgingStatementPDF(data);
          filename = `aging-${data.party.code}-${from}-${to}.pdf`;
          break;
        }
        default:
          res.status(400).json({ success: false, message: `Unknown statement type: ${type}` });
          return;
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  };
}
