/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RDAccountData, LedgerTransactionRow } from '../../types';
import { parseRDLedgerImage } from '../imageParser';
import { DocumentAdapter, DocumentAdapterOptions, DocumentCategory } from './types';

export class ImageDocumentAdapter implements DocumentAdapter {
  id = 'image-adapter';
  name = 'Document Image & Photo OCR Adapter';
  supportedFormats = ['Image' as const];

  canHandle(file: File): boolean {
    const name = file.name.toLowerCase();
    return (
      name.endsWith('.jpg') ||
      name.endsWith('.jpeg') ||
      name.endsWith('.png') ||
      file.type.startsWith('image/')
    );
  }

  async parse(file: File, options?: DocumentAdapterOptions): Promise<RDAccountData> {
    options?.onStatusUpdate?.('Analyzing document image resolution & orientation...');

    const ocrData = await parseRDLedgerImage(file, options?.onStatusUpdate);

    // Identify category
    const lowerName = file.name.toLowerCase();
    const sheetName = (ocrData.sheetName || '').toLowerCase();
    let category: DocumentCategory = 'Scanned Personal Ledger';

    if (
      lowerName.includes('day sheet') ||
      lowerName.includes('daysheet') ||
      sheetName.includes('day sheet')
    ) {
      category = 'Scanned Day Sheet';
    } else if (
      lowerName.includes('statement') ||
      lowerName.includes('stmt') ||
      sheetName.includes('statement')
    ) {
      category = 'Customer Transaction Statement';
    }

    // Standardize transaction rows
    const warnings: string[] = [...(ocrData.extractionWarnings || [])];
    let uncertainCount = 0;

    const standardizedTransactions: LedgerTransactionRow[] = (ocrData.transactions || []).map((t, idx) => {
      const rowNum = t.rowNum || idx + 1;
      const isAmountUncertain = !t.receiptCredit || isNaN(Number(t.receiptCredit)) || Number(t.receiptCredit) <= 0;
      const isDateUncertain = !t.date || t.date === '-' || !t.depositDateObj;
      const rowWarnings: string[] = [];

      if (isAmountUncertain) {
        rowWarnings.push('Amount may require review');
        uncertainCount++;
      }
      if (isDateUncertain) {
        rowWarnings.push('Date could not be strictly parsed');
        uncertainCount++;
      }

      return {
        ...t,
        rowNum,
        rowPageRef: `Scan Row #${rowNum}`,
        validationStatus: t.isValidPayment
          ? isAmountUncertain || isDateUncertain
            ? ('Uncertain' as const)
            : ('Valid' as const)
          : ('Excluded' as const),
        uncertainFieldWarnings: rowWarnings.length > 0 ? rowWarnings : undefined,
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

    if (uncertainCount > 0) {
      warnings.push(
        `${uncertainCount} field(s) marked for verification. You can review and edit values on the verification screen.`
      );
    }

    return {
      ...ocrData,
      openingDate: options?.openingDate || ocrData.openingDate,
      tenureDays: options?.tenureDays || ocrData.tenureDays,
      configuredDailyInstallment: options?.contractualDailyInstallment ?? ocrData.configuredDailyInstallment,
      configuredMonthlyInstallment: options?.contractualMonthlyInstallment ?? ocrData.configuredMonthlyInstallment,
      configuredOpeningDate: options?.openingDate,
      configuredTenureDays: options?.tenureDays,
      configuredTenureMonths: options?.tenureMonths,
      configuredAnnualRate: options?.annualInterestRate,
      expectedMaturityAmount: options?.expectedMaturityAmount,
      expectedMaturityDate: options?.expectedMaturityDate,
      fileName: file.name,
      fileSize: file.size,
      documentFormat: 'Image',
      documentCategory: category,
      extractionWarnings: warnings,
      transactions: standardizedTransactions,
    };
  }
}

export const imageAdapter = new ImageDocumentAdapter();
