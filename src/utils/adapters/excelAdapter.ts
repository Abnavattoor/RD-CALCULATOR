/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RDAccountData, LedgerTransactionRow } from '../../types';
import { parseRDLedgerWorkbook, RDValidationError } from '../excelParser';
import { DocumentAdapter, DocumentAdapterOptions, DocumentCategory } from './types';

export class ExcelDocumentAdapter implements DocumentAdapter {
  id = 'excel-adapter';
  name = 'Excel Spreadsheet Adapter';
  supportedFormats = ['Excel' as const];

  canHandle(file: File): boolean {
    const name = file.name.toLowerCase();
    return (
      name.endsWith('.xlsx') ||
      name.endsWith('.xls') ||
      file.type === 'application/vnd.ms-excel' ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  }

  async parse(file: File, options?: DocumentAdapterOptions): Promise<RDAccountData> {
    options?.onStatusUpdate?.('Reading Excel spreadsheet...');

    const buffer = await file.arrayBuffer();
    if (!buffer || buffer.byteLength === 0) {
      throw new RDValidationError(
        'Empty File',
        'The selected Excel workbook is empty or could not be read.'
      );
    }

    options?.onStatusUpdate?.('Parsing ledger workbook & transactions...');
    const rawData = parseRDLedgerWorkbook(buffer, file.name, file.size);

    // Identify document category
    const lowerName = file.name.toLowerCase();
    const lowerSheet = (rawData.sheetName || '').toLowerCase();
    let category: DocumentCategory = 'Personal RD Ledger';

    if (rawData.isDaySheet || lowerName.includes('day sheet') || lowerSheet.includes('day sheet')) {
      category = 'Branch Day Sheet';
    } else if (
      lowerName.includes('statement') ||
      lowerName.includes('stmt') ||
      lowerSheet.includes('statement')
    ) {
      category = 'Customer Transaction Statement';
    }

    // Standardize transaction rows
    const warnings: string[] = [];
    let excludedCount = 0;

    const standardizedTransactions: LedgerTransactionRow[] = (rawData.transactions || []).map((t, idx) => {
      const rowNum = t.rowNum || idx + 1;
      const isExcluded = Boolean(t.isSummaryRow || t.isClosureRow || !t.isValidPayment);
      if (isExcluded) excludedCount++;

      return {
        ...t,
        rowNum,
        rowPageRef: `Row #${rowNum}`,
        validationStatus: t.isValidPayment
          ? ('Valid' as const)
          : isExcluded
          ? ('Excluded' as const)
          : ('Uncertain' as const),
        originalValues: {
          receiptCredit: t.rawReceiptCredit !== undefined ? t.rawReceiptCredit : t.receiptCredit,
          paymentDebit: t.paymentDebit,
          balance: t.balance,
          date: t.date,
          particulars: t.particulars,
          type: t.transactionType || t.type,
        },
      };
    });

    if (excludedCount > 0) {
      warnings.push(
        `${excludedCount} non-deposit or summary row${excludedCount > 1 ? 's were' : ' was'} excluded from profit calculation.`
      );
    }

    if (rawData.hasSummaryRow) {
      warnings.push('Summary row detected and excluded from deposit aggregation.');
    }

    return {
      ...rawData,
      openingDate: options?.openingDate || rawData.openingDate,
      tenureDays: options?.tenureDays || rawData.tenureDays,
      configuredDailyInstallment: options?.contractualDailyInstallment ?? rawData.configuredDailyInstallment,
      configuredMonthlyInstallment: options?.contractualMonthlyInstallment ?? rawData.configuredMonthlyInstallment,
      configuredOpeningDate: options?.openingDate,
      configuredTenureDays: options?.tenureDays,
      configuredTenureMonths: options?.tenureMonths,
      configuredAnnualRate: options?.annualInterestRate,
      expectedMaturityAmount: options?.expectedMaturityAmount,
      expectedMaturityDate: options?.expectedMaturityDate,
      documentFormat: 'Excel',
      documentCategory: category,
      extractionWarnings: warnings,
      transactions: standardizedTransactions,
    };
  }
}

export const excelAdapter = new ExcelDocumentAdapter();
