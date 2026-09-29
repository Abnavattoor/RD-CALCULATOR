/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RDAccountData, LedgerTransactionRow, RDType } from '../types';

export class RDDocumentProcessingError extends Error {
  errorType: string;

  constructor(message: string, errorType: string = 'GENERAL_ERROR') {
    super(message);
    this.name = 'RDDocumentProcessingError';
    this.errorType = errorType;
  }
}

/**
 * Validates and decodes image, resizing overly large images to preserve crisp OCR resolution
 * (max 2400px on the longest side) while preventing timeouts and huge payloads.
 */
export async function validateAndPreprocessImage(
  file: File
): Promise<{ base64: string; mimeType: string }> {
  const fileName = file.name.toLowerCase();
  const isJpg = fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || file.type === 'image/jpeg' || file.type === 'image/jpg';
  const isPng = fileName.endsWith('.png') || file.type === 'image/png';

  if (!isJpg && !isPng) {
    throw new RDDocumentProcessingError(
      'Unable to read this image. Please upload a clearer JPG, JPEG or PNG.',
      'INVALID_IMAGE'
    );
  }

  // Max raw file size check: 25MB
  if (file.size > 25 * 1024 * 1024) {
    throw new RDDocumentProcessingError(
      'File size is too large (maximum 25MB). Please upload a compressed image or document scan.',
      'INVALID_IMAGE'
    );
  }

  // Load into browser Image object to verify decodability
  return new Promise<{ base64: string; mimeType: string }>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(
        new RDDocumentProcessingError(
          'Unable to read this image. Please upload a clearer JPG, JPEG or PNG.',
          'INVALID_IMAGE'
        )
      );
    };

    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();

      img.onerror = () => {
        reject(
          new RDDocumentProcessingError(
            'Unable to read this image. The image file appears corrupt or unreadable.',
            'INVALID_IMAGE'
          )
        );
      };

      img.onload = () => {
        try {
          const maxDimension = 2400;
          let { width, height } = img;

          // If image is reasonably sized, return original base64 directly
          if (width <= maxDimension && height <= maxDimension && file.size <= 8 * 1024 * 1024) {
            resolve({
              base64: dataUrl,
              mimeType: isPng ? 'image/png' : 'image/jpeg',
            });
            return;
          }

          // Scale down proportionally if oversized to preserve maximum OCR clarity
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            // Fallback to original if canvas context unavailable
            resolve({
              base64: dataUrl,
              mimeType: isPng ? 'image/png' : 'image/jpeg',
            });
            return;
          }

          // High quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Export at high quality JPEG to preserve text fidelity
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
          resolve({
            base64: optimizedDataUrl,
            mimeType: 'image/jpeg',
          });
        } catch {
          // Fallback to original base64
          resolve({
            base64: dataUrl,
            mimeType: isPng ? 'image/png' : 'image/jpeg',
          });
        }
      };

      img.src = dataUrl;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Format Date object to DD/MM/YYYY string.
 */
function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Parse date strings like 19-09-2025, 19/09/2025, 2025-09-19 into a Date.
 */
export function parseDateFlexible(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const cleaned = String(dateStr).trim();

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = cleaned.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]) - 1;
    const year = Number(dmyMatch[3]);
    const d = new Date(year, month, day);
    if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
      return d;
    }
  }

  // YYYY-MM-DD
  const ymdMatch = cleaned.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]) - 1;
    const day = Number(ymdMatch[3]);
    const d = new Date(year, month, day);
    if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
      return d;
    }
  }

  const fallback = new Date(cleaned);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Converts structured OCR result from server into the application's internal RDAccountData.
 */
export function convertNitcDataToRDAccountData(
  ocrResult: any,
  file: { name: string; size: number }
): RDAccountData {
  if (!ocrResult || typeof ocrResult !== 'object') {
    throw new RDDocumentProcessingError(
      'This does not appear to be a supported NITC RD document.',
      'UNRECOGNIZED_DOCUMENT'
    );
  }

  // Scheme identification:
  // RCD = Daily RD
  // RCM = Monthly RD
  const rawScheme = String(ocrResult.scheme || ocrResult.schemeCode || '').toUpperCase().trim();
  const rawRdType = String(ocrResult.rdType || '').trim();

  let rdType: RDType = 'Monthly RD';
  let schemeCode = rawScheme;

  if (rawScheme.includes('RCD') || rawRdType === 'Daily RD' || (ocrResult.period && /day/i.test(ocrResult.period))) {
    rdType = 'Daily RD';
    schemeCode = 'RCD';
  } else if (rawScheme.includes('RCM') || rawRdType === 'Monthly RD' || (ocrResult.period && /month/i.test(ocrResult.period))) {
    rdType = 'Monthly RD';
    schemeCode = 'RCM';
  } else {
    // If neither RCD nor RCM detected, check whether it's an RD document at all
    if (!ocrResult.isRdDocument && !ocrResult.isNitcTemplate) {
      throw new RDDocumentProcessingError(
        'This does not appear to be a supported NITC RD document.',
        'UNRECOGNIZED_DOCUMENT'
      );
    }
  }

  // Scheme Amount:
  // The value directly associated with the Scheme header MUST be used as the base amount.
  // DO NOT infer it from transaction minimums!
  let schemeAmount = Number(ocrResult.schemeAmount);
  let warning = ocrResult.missingFieldsWarning || '';

  if (!Number.isFinite(schemeAmount) || schemeAmount <= 0) {
    // Reasonable default based on scheme if header detection was ambiguous
    schemeAmount = rdType === 'Daily RD' ? 100 : 3000;
    warning = warning
      ? `${warning}. Scheme amount could not be detected with confidence.`
      : 'Scheme amount could not be detected with confidence.';
  }

  // Dates
  const bondDateStr = ocrResult.bondDate || ocrResult.commencementDate || '';
  const maturityDateStr = ocrResult.maturityDate || ocrResult.dateOfMaturity || '';

  const bondDateObj = parseDateFlexible(bondDateStr);
  const maturityDateObj = parseDateFlexible(maturityDateStr);

  const formattedOpeningDate = bondDateObj ? formatDate(bondDateObj) : bondDateStr;
  const formattedMaturityDate = maturityDateObj ? formatDate(maturityDateObj) : maturityDateStr;

  // Calculate tenure days
  let tenureDays = 365;
  if (bondDateObj && maturityDateObj) {
    const diffTime = Math.abs(maturityDateObj.getTime() - bondDateObj.getTime());
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      tenureDays = diffDays;
    }
  } else if (ocrResult.period) {
    const dayMatch = ocrResult.period.match(/(\d+)\s*days?/i);
    const monthMatch = ocrResult.period.match(/(\d+)\s*months?/i);
    if (dayMatch) {
      tenureDays = Number(dayMatch[1]);
    } else if (monthMatch) {
      tenureDays = Math.round(Number(monthMatch[1]) * (365 / 12));
    }
  }

  // Payment transactions
  const rawRows = Array.isArray(ocrResult.payments)
    ? ocrResult.payments
    : Array.isArray(ocrResult.paymentRows)
      ? ocrResult.paymentRows
      : [];

  if (rawRows.length === 0) {
    throw new RDDocumentProcessingError(
      'Unable to extract payment transactions from this document. Please ensure the payment table is clear.',
      'INVALID_IMAGE'
    );
  }

  let runningBalance = 0;
  const transactions: LedgerTransactionRow[] = rawRows.map((row: any, index: number) => {
    const paymentDateStr = row.date || row.dateOfPayment || '';
    const txDate = parseDateFlexible(paymentDateStr);
    const formattedTxDate = txDate ? formatDate(txDate) : paymentDateStr;
    const amount = Number(row.amount) || 0;
    runningBalance += amount;

    return {
      rowNum: row.slNo || index + 1,
      date: formattedTxDate,
      depositDateObj: txDate,
      particulars: row.receiptNo
        ? `Installment #${row.slNo || index + 1} (Receipt: ${row.receiptNo})`
        : `Installment #${row.slNo || index + 1}`,
      paymentDebit: null,
      receiptCredit: amount,
      rawReceiptCredit: amount,
      balance: row.totalAmountPaid ? Number(row.totalAmountPaid) : runningBalance,
      intPaid: row.interest || row.interestOnlyFd ? Number(row.interest || row.interestOnlyFd) : null,
      isSummaryRow: false,
      isValidPayment: amount > 0,
    };
  });

  // Calculate total deposited
  const txSum = transactions
    .filter((tx) => tx.isValidPayment && tx.receiptCredit !== null)
    .reduce((sum, tx) => sum + (tx.receiptCredit || 0), 0);

  const totalDeposited =
    ocrResult.totalAmount && Number(ocrResult.totalAmount) > 0
      ? Number(ocrResult.totalAmount)
      : txSum;

  const dailySchemeAmount = rdType === 'Daily RD' ? schemeAmount : 0;
  const profitEligibleAmount = totalDeposited;
  const nonProfitAmount = 0;
  const normalizedDailyAmount = rdType === 'Daily RD' ? profitEligibleAmount / tenureDays : 0;

  return {
    fileName: file.name,
    fileSize: file.size,
    sheetName: ocrResult.isNitcTemplate ? 'NITC Pre-Closure Template' : 'NITC RD Document',
    customerName: ocrResult.memberName || ocrResult.memberOrCustomerName || 'Member',
    accountNumber: ocrResult.bondNumber || ocrResult.bondOrAccountNumber || 'NITC-BOND',
    rdType,
    openingDate: formattedOpeningDate,
    maturityDate: formattedMaturityDate,
    interestRate: '12%',
    annualRate: 0.12,
    selectedInterestRate: 12,
    status: 'Active',
    period: ocrResult.period || (rdType === 'Daily RD' ? '365 DAYS' : '12 MONTHS'),
    tenureDays,
    transactions,
    totalDeposited,
    dailySchemeAmount,
    profitEligibleAmount,
    nonProfitAmount,
    normalizedDailyAmount,
    totalInterest: 0,
    maturityAmount: totalDeposited,
    validTransactionCount: transactions.filter((t) => t.isValidPayment).length,
    hasSummaryRow: true,
    returnRate: 12,
    returnAmount: 0,
    // NITC details
    isNitcTemplate: Boolean(ocrResult.isNitcTemplate ?? true),
    schemeCode,
    schemeAmount,
    branch: ocrResult.branch,
    branchCode: ocrResult.branchCode,
    preClosureCharges: ocrResult.preClosureCharges ? Number(ocrResult.preClosureCharges) : undefined,
    netPayment: ocrResult.netPayment ? Number(ocrResult.netPayment) : undefined,
    missingFieldsWarning: warning || undefined,
  };
}

/**
 * Send image file to server OCR endpoint and return converted RDAccountData.
 * Includes user-friendly status updates and specific error handling.
 */
export async function parseRDLedgerImage(
  file: File,
  onStatusUpdate?: (status: string) => void
): Promise<RDAccountData> {
  // Step 1: Client-side validation & preprocessing
  onStatusUpdate?.('Reading RD document...');
  const { base64, mimeType } = await validateAndPreprocessImage(file);

  // Step 2: Request parsing from server
  onStatusUpdate?.('Extracting payment details...');

  let response: globalThis.Response;
  try {
    response = await fetch('/api/parse-rd-document', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64: base64,
        mimeType,
        fileName: file.name,
        fileSize: file.size,
      }),
    });
  } catch (netErr: any) {
    throw new RDDocumentProcessingError(
      'Unable to connect to the document processing service. Please check your network connection.',
      'NETWORK_ERROR'
    );
  }

  // Step 3: Handle error responses from server
  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    const errorType = errorJson.errorType || (response.status === 503 ? 'UNAVAILABLE' : response.status === 429 ? 'RATE_LIMIT' : 'SERVER_ERROR');

    if (errorType === 'UNAVAILABLE' || response.status === 503) {
      throw new RDDocumentProcessingError(
        'AI service is temporarily unavailable. Please try again in a moment.',
        'UNAVAILABLE'
      );
    }

    if (errorType === 'RATE_LIMIT' || response.status === 429) {
      throw new RDDocumentProcessingError(
        'AI request rate limit reached. Please wait a moment and try again.',
        'RATE_LIMIT'
      );
    }

    if (errorType === 'AUTH_ERROR' || response.status === 401) {
      throw new RDDocumentProcessingError(
        'AI service configuration is invalid.',
        'AUTH_ERROR'
      );
    }

    if (errorType === 'INVALID_IMAGE' || response.status === 400) {
      throw new RDDocumentProcessingError(
        'Unable to read this image. Please upload a clearer JPG, JPEG or PNG.',
        'INVALID_IMAGE'
      );
    }

    if (errorType === 'UNRECOGNIZED_DOCUMENT') {
      throw new RDDocumentProcessingError(
        'This does not appear to be a supported NITC RD document.',
        'UNRECOGNIZED_DOCUMENT'
      );
    }

    throw new RDDocumentProcessingError(
      errorJson.error || 'Unable to identify the RD document. Please upload a clearer image.',
      errorType
    );
  }

  // Step 4: Parse result & calculate data
  onStatusUpdate?.('Calculating RD data...');
  const result = await response.json();

  if (!result.success || !result.data) {
    throw new RDDocumentProcessingError(
      result.error || 'This does not appear to be a supported NITC RD document.',
      'PARSE_ERROR'
    );
  }

  return convertNitcDataToRDAccountData(result.data, {
    name: file.name,
    size: file.size,
  });
}
