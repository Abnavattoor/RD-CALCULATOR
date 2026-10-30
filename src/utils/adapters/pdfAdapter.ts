/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import '../domPolyfill';
import * as pdfjsLib from 'pdfjs-dist';
import { RDAccountData, LedgerTransactionRow } from '../../types';
import { parseRDLedgerPDF } from '../pdfParser';
import { parseRDLedgerImage } from '../imageParser';
import { DocumentAdapter, DocumentAdapterOptions, DocumentCategory } from './types';

// Ensure PDF.js worker is initialized
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

export class PDFDocumentAdapter implements DocumentAdapter {
  id = 'pdf-adapter';
  name = 'PDF Document Adapter';
  supportedFormats = ['PDF' as const];

  canHandle(file: File): boolean {
    const name = file.name.toLowerCase();
    return name.endsWith('.pdf') || file.type === 'application/pdf';
  }

  /**
   * Helper to render a PDF page to a PNG/JPEG Blob/File for OCR when text is not selectable.
   */
  private async renderPdfPageToImageFile(
    pdf: pdfjsLib.PDFDocumentProxy,
    pageNumber: number,
    baseFileName: string
  ): Promise<File> {
    const page = await pdf.getPage(pageNumber);
    // Render at 2.0 scale for crisp OCR fidelity
    const scale = 2.0;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas 2D context unavailable for PDF rendering.');
    }

    await page.render({
      canvas,
      canvasContext: context,
      viewport,
    } as any).promise;

    return new Promise<File>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to convert PDF page canvas to image blob.'));
            return;
          }
          const imageFile = new File([blob], `${baseFileName}-page${pageNumber}.png`, {
            type: 'image/png',
          });
          resolve(imageFile);
        },
        'image/png',
        0.95
      );
    });
  }

  async parse(file: File, options?: DocumentAdapterOptions): Promise<RDAccountData> {
    options?.onStatusUpdate?.('Inspecting PDF structure...');

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

    // Inspect first page text length to determine if selectable or scanned
    let totalTextChars = 0;
    let sampleText = '';
    const inspectPages = Math.min(pdf.numPages, 3);

    for (let p = 1; p <= inspectPages; p++) {
      const page = await pdf.getPage(p);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((it: any) => it.str || '')
        .join(' ')
        .trim();
      totalTextChars += pageText.replace(/\s+/g, '').length;
      sampleText += ' ' + pageText;
    }

    const isScannedPdf = totalTextChars < 60;

    // -------------------------------------------------------------------------
    // SCANNED PDF -> OCR ADAPTER PIPELINE
    // -------------------------------------------------------------------------
    if (isScannedPdf) {
      options?.onStatusUpdate?.('Scanned PDF detected. Rendering pages for OCR...');
      const imageFile = await this.renderPdfPageToImageFile(pdf, 1, file.name);

      options?.onStatusUpdate?.('Running OCR on scanned PDF document...');
      const ocrData = await parseRDLedgerImage(imageFile, options?.onStatusUpdate);

      // Determine category
      const lowerName = file.name.toLowerCase();
      let category: DocumentCategory = 'Scanned Personal Ledger';
      if (lowerName.includes('day sheet') || lowerName.includes('daysheet')) {
        category = 'Scanned Day Sheet';
      }

      const warnings = [
        'Document was scanned/rasterized; extracted using high-accuracy OCR.',
        ...(ocrData.extractionWarnings || []),
      ];

      return {
        ...ocrData,
        fileName: file.name,
        fileSize: file.size,
        documentFormat: 'PDF',
        documentCategory: category,
        extractionWarnings: warnings,
      };
    }

    // -------------------------------------------------------------------------
    // DIGITAL SELECTABLE PDF -> TEXT / TABLE PARSER
    // -------------------------------------------------------------------------
    options?.onStatusUpdate?.('Extracting text and tables from PDF...');
    const rawData = await parseRDLedgerPDF(file);

    // Identify category
    const lowerName = file.name.toLowerCase();
    const lowerSample = sampleText.toLowerCase();
    let category: DocumentCategory = 'Personal RD Ledger';

    if (
      lowerName.includes('day sheet') ||
      lowerName.includes('daysheet') ||
      (lowerSample.includes('day sheet') && lowerSample.includes('nature of receipt'))
    ) {
      category = 'Branch Day Sheet';
    } else if (
      lowerName.includes('statement') ||
      lowerName.includes('stmt') ||
      lowerSample.includes('statement of account') ||
      lowerSample.includes('transaction statement')
    ) {
      category = 'Customer Transaction Statement';
    }

    // Standardize transaction rows
    const warnings: string[] = [];
    const standardizedTransactions: LedgerTransactionRow[] = (rawData.transactions || []).map((t, idx) => {
      const rowNum = t.rowNum || idx + 1;
      return {
        ...t,
        rowNum,
        rowPageRef: `Row #${rowNum}`,
        validationStatus: t.isValidPayment
          ? ('Valid' as const)
          : ('Excluded' as const),
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
      fileName: file.name,
      fileSize: file.size,
      documentFormat: 'PDF',
      documentCategory: category,
      extractionWarnings: warnings,
      transactions: standardizedTransactions,
    };
  }
}

export const pdfAdapter = new PDFDocumentAdapter();
