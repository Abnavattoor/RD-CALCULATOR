import * as XLSX from 'xlsx';
import { RDAccountData, LedgerTransactionRow, RDType } from '../types';

/**
 * Custom error class carrying standard title and message as specified in business rules.
 */
export class RDValidationError extends Error {
  title: string;
  constructor(title: string, message: string) {
    super(message);
    this.name = 'RDValidationError';
    this.title = title;
  }
}

/**
 * Clean and extract numeric value from any cell content (e.g. ₹9,200.00, 5000, " 1,500 ")
 */
export function parseNumericAmount(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return isNaN(val) ? null : val;
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;

    // Remove currency symbols, commas, whitespace, trailing Dr/Cr
    const cleaned = trimmed
      .replace(/[₹$€£]/g, '')
      .replace(/rs\.?/gi, '')
      .replace(/,/g, '')
      .replace(/\s*(cr|dr)\.?$/i, '')
      .trim();

    const num = parseFloat(cleaned);
    if (!isNaN(num) && isFinite(num)) {
      return num;
    }
  }

  return null;
}

/**
 * Format numbers in Indian numbering format (e.g. ₹50,000.00)
 */
export function formatCurrency(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '₹0.00';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Parses any cell date value into a normalized JavaScript Date (at 00:00:00 local time).
 * Handles DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, Excel serial numbers, and Date objects.
 */
export function parseDate(cellValue: any): Date | null {
  if (cellValue === null || cellValue === undefined || cellValue === '') return null;

  if (cellValue instanceof Date) {
    if (isNaN(cellValue.getTime())) return null;
    return new Date(cellValue.getFullYear(), cellValue.getMonth(), cellValue.getDate());
  }

  if (typeof cellValue === 'number') {
    if (cellValue > 20000 && cellValue < 60000) {
      try {
        const parsed = XLSX.SSF.parse_date_code(cellValue);
        if (parsed) {
          return new Date(parsed.y, parsed.m - 1, parsed.d);
        }
      } catch {
        // fallback
      }
    }
    return null;
  }

  if (typeof cellValue === 'string') {
    const trimmed = cellValue.trim();
    if (!trimmed || trimmed === '-') return null;

    // Match DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      let year = parseInt(dmyMatch[3], 10);
      if (year < 100) year += 2000;
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }

    // Match YYYY-MM-DD or YYYY/MM/DD
    const ymdMatch = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }

    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
  }

  return null;
}

/**
 * Format date for display in DD/MM/YYYY format
 */
export function formatDateDisplay(date: Date | null | undefined): string {
  if (!date || isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format Excel date value safely in DD/MM/YYYY format
 */
export function formatExcelDate(cellValue: any): string {
  if (cellValue === null || cellValue === undefined || cellValue === '') return '-';
  const d = parseDate(cellValue);
  if (d) {
    return formatDateDisplay(d);
  }
  const str = String(cellValue).trim();
  return str || '-';
}

/**
 * Check if a row represents a summary, total, or closing balance row based on text content
 */
function isRowSummary(particularsText: string, dateText: string, rowValues: any[]): boolean {
  const summaryKeywords = [
    'total',
    'grand total',
    'closing balance',
    'closing bal',
    'closing',
    'balance c/f',
    'balance b/f',
    'carried forward',
    'brought forward',
    'c/f',
    'b/f',
    'total received',
    'total deposit',
    'total deposited',
    'total paid',
    'total cr',
    'total credit',
    'sub total',
    'subtotal',
    'summary',
    'net total',
    'accumulated',
    'cumulative',
    'cum.',
    'final total',
    'balance total',
    'maturity total',
    'aggregate',
    'net balance',
  ];

  const partLower = (particularsText || '').toLowerCase().trim();
  const dateLower = (dateText || '').toLowerCase().trim();

  // If particulars or date explicitly has summary keywords
  if (summaryKeywords.some((kw) => partLower === kw || partLower.startsWith(kw) || partLower.includes(kw))) {
    return true;
  }
  if (summaryKeywords.some((kw) => dateLower === kw || dateLower.startsWith(kw))) {
    return true;
  }

  // Check any cell in row for explicit summary keywords
  for (const cell of rowValues) {
    if (typeof cell === 'string') {
      const cLower = cell.toLowerCase().trim();
      if (
        summaryKeywords.some(
          (kw) => cLower === kw || cLower.startsWith(kw + ':') || cLower.startsWith(kw + ' ')
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Dynamically recalculates the exact used range and data boundaries of the worksheet.
 * Ensures the parser does not depend on any hard-coded range or pre-set range limit
 * (such as A32:F100 or A32:F1000), and reads ALL transaction rows present in the file.
 */
function ensureAccurateWorksheetRange(sheet: XLSX.WorkSheet): void {
  let minR = Infinity;
  let maxR = -1;
  let minC = Infinity;
  let maxC = -1;

  for (const key of Object.keys(sheet)) {
    if (key.charCodeAt(0) === 33) continue; // Skip metadata keys starting with '!'
    try {
      const cell = XLSX.utils.decode_cell(key);
      if (cell.r < minR) minR = cell.r;
      if (cell.r > maxR) maxR = cell.r;
      if (cell.c < minC) minC = cell.c;
      if (cell.c > maxC) maxC = cell.c;
    } catch {
      // ignore non-cell properties
    }
  }

  if (maxR >= 0 && maxC >= 0) {
    sheet['!ref'] = XLSX.utils.encode_range({
      s: { r: minR < Infinity ? minR : 0, c: minC < Infinity ? minC : 0 },
      e: { r: maxR, c: maxC },
    });
  }
}

/**
 * Validates and parses an uploaded RD Personal Ledger Excel file.
 * Automatically identifies the transaction table, extracts customer details,
 * sums actual deposits from Receipt/Credit, avoids duplicate summary totals,
 * and calculates 12% return and maturity amount.
 *
 * SUPPORTS UNLIMITED / VARIABLE NUMBER OF TRANSACTION ROWS (10, 100, 1,000, 10,000+).
 * NO HARD-CODED ROW LIMITS OR FIXED RANGES (No A32:F100 or A32:F1000).
 */
export function parseRDLedgerWorkbook(
  data: ArrayBuffer,
  fileName: string,
  fileSize: number
): RDAccountData {
  let workbook: XLSX.WorkBook;

  try {
    workbook = XLSX.read(data, { type: 'array', cellDates: true });
  } catch {
    throw new RDValidationError(
      'Unable to Read Ledger',
      'Please upload a valid RD Personal Ledger Excel file.'
    );
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new RDValidationError(
      'Invalid Ledger Format',
      'Please upload a valid RD Personal Ledger Excel file.'
    );
  }

  // Step 1: Select the best worksheet containing the RD ledger
  let selectedSheetName: string = workbook.SheetNames[0];
  let selectedSheetRows: any[][] = [];
  let bestSheetScore = -1;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Dynamically calculate the accurate sheet used range across all cells
    ensureAccurateWorksheetRange(sheet);

    // Read all rows dynamically without skipping blank rows so indices correspond to Excel rows
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      blankrows: true,
    });

    if (rows.length === 0) continue;

    let score = 0;
    const cleanName = sheetName.toLowerCase().replace(/[\s\-_()]/g, '');
    if (cleanName === 'depositpersonalledgerrd') {
      score += 10000;
    } else if (cleanName.includes('depositpersonalledgerrd')) {
      score += 5000;
    } else if (cleanName.includes('ledger') || cleanName.includes('rd') || cleanName.includes('deposit')) {
      score += 30;
    }

    // Check cells for header markers (inspect first 100 rows for sheet scoring)
    const scanLimit = Math.min(rows.length, 100);
    for (let r = 0; r < scanLimit; r++) {
      const row = rows[r] || [];
      const rowStr = row.map((c) => String(c).toLowerCase()).join(' ');
      if (rowStr.includes('receipt') || rowStr.includes('credit')) {
        score += 50;
      }
      if (rowStr.includes('personal ledger') || rowStr.includes('recurring deposit')) {
        score += 40;
      }
      if (rowStr.includes('customer') || rowStr.includes('account no') || rowStr.includes('a/c no')) {
        score += 20;
      }
    }

    if (score > bestSheetScore) {
      bestSheetScore = score;
      selectedSheetName = sheetName;
      selectedSheetRows = rows;
    }
  }

  if (selectedSheetRows.length === 0) {
    throw new RDValidationError(
      'Invalid Ledger Format',
      'Please upload a valid RD Personal Ledger Excel file.'
    );
  }

  // Step 2: Automatically identify the transaction table row (anywhere in the sheet)
  let transactionHeaderRowIdx = -1;
  let dateColIdx = -1;
  let particularsColIdx = -1;
  let paymentDebitColIdx = -1;
  let receiptCreditColIdx = -1;
  let balanceColIdx = -1;
  let intPaidColIdx = -1;
  let bestHeaderScore = -1;

  for (let r = 0; r < selectedSheetRows.length; r++) {
    const row = selectedSheetRows[r] || [];
    let curDate = -1;
    let curParticulars = -1;
    let curDebit = -1;
    let curReceipt = -1;
    let curBalance = -1;
    let curIntPaid = -1;

    for (let c = 0; c < row.length; c++) {
      const rawText = String(row[c] || '').trim();
      const text = rawText.toLowerCase();
      const clean = text.replace(/[\s\-_/.]/g, '');

      if (!text) continue;

      // Date column
      if (
        text === 'date' ||
        clean === 'txndate' ||
        clean === 'transactiondate' ||
        clean === 'transdate' ||
        text === 'dt'
      ) {
        curDate = c;
      }
      // Particulars column
      else if (
        clean.includes('particular') ||
        clean.includes('description') ||
        clean.includes('narration') ||
        clean === 'transactiondetails' ||
        clean === 'details'
      ) {
        curParticulars = c;
      }
      // Payment / Debit column
      else if (
        clean === 'paymentdebit' ||
        clean === 'payment/debit' ||
        text === 'payment' ||
        text === 'debit' ||
        clean === 'dr' ||
        clean === 'dr.' ||
        clean.includes('withdrawal')
      ) {
        curDebit = c;
      }
      // Receipt / Credit column (PRIMARY DEPOSIT COLUMN)
      else if (
        clean === 'receiptcredit' ||
        clean === 'receipt/credit' ||
        clean === 'receiptscredit' ||
        text === 'receipt' ||
        text === 'credit' ||
        clean === 'cr' ||
        clean === 'cr.' ||
        clean.includes('deposit') ||
        clean.includes('amountpaid') ||
        clean.includes('paidamount') ||
        clean === 'installment'
      ) {
        if (!clean.includes('debit') && !clean.includes('payment') && !clean.includes('dr')) {
          curReceipt = c;
        }
      }
      // Balance column
      else if (
        clean === 'balance' ||
        clean === 'closingbalance' ||
        clean === 'bal' ||
        clean === 'runningbalance'
      ) {
        curBalance = c;
      }
      // Interest Paid column
      else if (
        clean === 'intpaid' ||
        clean === 'interestpaid' ||
        clean === 'int.paid' ||
        clean === 'interest'
      ) {
        curIntPaid = c;
      }
    }

    // A valid transaction header requires at least Receipt/Credit AND (Date OR Particulars)
    if (curReceipt !== -1 && (curDate !== -1 || curParticulars !== -1)) {
      let score = 50;
      if (curDate !== -1) score += 20;
      if (curParticulars !== -1) score += 20;
      if (curBalance !== -1) score += 20;
      if (curDebit !== -1) score += 10;
      if (curIntPaid !== -1) score += 10;

      if (score > bestHeaderScore) {
        bestHeaderScore = score;
        transactionHeaderRowIdx = r;
        dateColIdx = curDate;
        particularsColIdx = curParticulars;
        paymentDebitColIdx = curDebit;
        receiptCreditColIdx = curReceipt;
        balanceColIdx = curBalance;
        intPaidColIdx = curIntPaid;
      }
    }
  }

  // If table header could not be identified, reject file
  if (transactionHeaderRowIdx === -1 || receiptCreditColIdx === -1) {
    throw new RDValidationError(
      'Invalid Ledger Format',
      'Please upload a valid RD Personal Ledger Excel file.'
    );
  }

  // Step 3: Extract Customer / Account Metadata (from anywhere before or around the table)
  let customerName = '';
  let accountNumber = '';
  let openingDate = '';
  let maturityDate = '';
  let interestRate = '';
  let status = '';
  let period = '';
  let explicitRDTypeText = '';

  const metadataRowsLimit = transactionHeaderRowIdx > 0
    ? transactionHeaderRowIdx
    : Math.min(selectedSheetRows.length, 25);

  // Helper to find the next non-empty cell in the row after current column
  const getNextCellVal = (row: any[], startCol: number) => {
    for (let i = startCol + 1; i < row.length; i++) {
      const val = row[i];
      if (val !== null && val !== undefined) {
        const s = String(val).trim();
        if (s && s !== ':' && s !== '-') {
          return val;
        }
      }
    }
    return '';
  };

  for (let r = 0; r < metadataRowsLimit; r++) {
    const row = selectedSheetRows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cellVal = String(row[c] || '').trim();
      const cellValLower = cellVal.toLowerCase();
      const label = cellValLower.replace(/[:\-]/g, '').trim();

      // Look for explicit RD Type
      if (
        cellValLower.includes('daily rd') ||
        cellValLower.includes('daily recurring deposit') ||
        cellValLower.includes('drd')
      ) {
        explicitRDTypeText = 'Daily RD';
      } else if (
        cellValLower.includes('monthly rd') ||
        cellValLower.includes('monthly recurring deposit') ||
        cellValLower.includes('mrd')
      ) {
        explicitRDTypeText = 'Monthly RD';
      }

      // Customer Name
      if (!customerName) {
        const nameRegex = /(?:customer\s*name|client\s*name|account\s*holder|member\s*name|name)\s*[:\-]\s*(.+)/i;
        const match = cellVal.match(nameRegex);
        if (match && match[1]?.trim() && !cellValLower.includes('bank') && !cellValLower.includes('branch')) {
          customerName = match[1].trim();
        } else if (
          label === 'name' ||
          label === 'customer name' ||
          label === 'client name' ||
          label === 'account holder' ||
          label === 'member name'
        ) {
          const nextVal = String(getNextCellVal(row, c)).trim();
          if (nextVal) customerName = nextVal;
        }
      }

      // Account Number / A/c No
      if (!accountNumber) {
        const accRegex = /(?:a\/c\s*no\.?|ac\s*no\.?|account\s*no\.?|account\s*number|rd\s*a\/c|rd\s*no\.?)\s*[:\-]\s*(.+)/i;
        const match = cellVal.match(accRegex);
        if (match && match[1]?.trim()) {
          accountNumber = match[1].trim();
        } else if (
          label === 'a/c no' ||
          label === 'a/c no.' ||
          label === 'ac no' ||
          label === 'ac no.' ||
          label === 'account no' ||
          label === 'account no.' ||
          label === 'account number' ||
          label === 'a/c' ||
          label === 'rd a/c' ||
          label === 'rd no' ||
          label === 'account'
        ) {
          const nextVal = String(getNextCellVal(row, c)).trim();
          if (nextVal) accountNumber = nextVal;
        }
      }

      // Opening Date
      if (!openingDate) {
        const openDateRegex = /(?:a\/c\s*opening\s*date|opening\s*date|open\s*date|date\s*of\s*opening)\s*[:\-]\s*(.+)/i;
        const match = cellVal.match(openDateRegex);
        if (match && match[1]?.trim()) {
          openingDate = match[1].trim();
        } else if (
          label === 'a/c opening date' ||
          label === 'opening date' ||
          label === 'open date' ||
          label === 'date of opening' ||
          label === 'start date'
        ) {
          const nextRaw = getNextCellVal(row, c);
          const nextVal = formatExcelDate(nextRaw);
          if (nextVal && nextVal !== '-') openingDate = nextVal;
        }
      }

      // Maturity Date / Due Date
      if (!maturityDate) {
        const matDateRegex = /(?:maturity\s*date|mat\s*date|due\s*date|expiry\s*date|exp\s*date|completion\s*date)\s*[:\-]\s*(.+)/i;
        const match = cellVal.match(matDateRegex);
        if (match && match[1]?.trim()) {
          maturityDate = match[1].trim();
        } else if (
          label === 'maturity date' ||
          label === 'mat date' ||
          label === 'due date' ||
          label === 'expiry date' ||
          label === 'exp date' ||
          label === 'completion date'
        ) {
          const nextRaw = getNextCellVal(row, c);
          const nextVal = formatExcelDate(nextRaw);
          if (nextVal && nextVal !== '-') maturityDate = nextVal;
        }
      }

      // Interest Rate
      if (!interestRate) {
        const rateRegex = /(?:interest\s*rate|int\s*rate|roi|rate\s*of\s*interest|rate)\s*[:\-]\s*(.+)/i;
        const match = cellVal.match(rateRegex);
        if (match && match[1]?.trim()) {
          interestRate = match[1].trim();
        } else if (
          label === 'interest rate' ||
          label === 'int rate' ||
          label === 'roi' ||
          label === 'rate of interest' ||
          label === 'rate'
        ) {
          const nextVal = String(getNextCellVal(row, c)).trim();
          if (nextVal) interestRate = nextVal;
        }
      }

      // Status
      if (!status) {
        const statusRegex = /(?:a\/c\s*status|status)\s*[:\-]\s*(.+)/i;
        const match = cellVal.match(statusRegex);
        if (match && match[1]?.trim()) {
          status = match[1].trim();
        } else if (label === 'status' || label === 'a/c status' || label === 'account status') {
          const nextVal = String(getNextCellVal(row, c)).trim();
          if (nextVal) status = nextVal;
        }
      }

      // Period / Tenure
      if (!period) {
        const periodRegex = /(?:period|tenure|duration|term|frequency)\s*[:\-]\s*(.+)/i;
        const match = cellVal.match(periodRegex);
        if (match && match[1]?.trim()) {
          period = match[1].trim();
        } else if (
          label === 'period' ||
          label === 'tenure' ||
          label === 'duration' ||
          label === 'term' ||
          label === 'frequency' ||
          label === 'months'
        ) {
          const nextVal = String(getNextCellVal(row, c)).trim();
          if (nextVal) period = nextVal;
        }
      }
    }
  }

  // Format interest rate with % symbol if missing
  if (interestRate && !interestRate.includes('%')) {
    const num = parseFloat(interestRate);
    if (!isNaN(num)) {
      if (num <= 1 && num > 0) {
        interestRate = `${(num * 100).toFixed(2).replace(/\.00$/, '')}%`;
      } else {
        interestRate = `${num}%`;
      }
    }
  }

  // Step 4: Extract actual Receipt/Credit transactions & identify summary/total rows
  const rawTransactions: LedgerTransactionRow[] = [];
  const transactionDates: Date[] = [];
  const particularsList: string[] = [];

  for (let r = transactionHeaderRowIdx + 1; r < selectedSheetRows.length; r++) {
    const row = selectedSheetRows[r];
    if (!row || !Array.isArray(row)) continue;

    // Skip blank rows
    const hasAnyContent = row.some(
      (c) => c !== null && c !== undefined && String(c).trim() !== ''
    );
    if (!hasAnyContent) continue;

    const rawDate = dateColIdx !== -1 ? row[dateColIdx] : '';
    const dateFormatted = formatExcelDate(rawDate);
    const depositDateObj = parseDate(rawDate);

    const rawParticulars = particularsColIdx !== -1 ? row[particularsColIdx] : '';
    const particularsStr = String(rawParticulars || '').trim();

    const rawDebit = paymentDebitColIdx !== -1 ? row[paymentDebitColIdx] : null;
    const rawReceipt = row[receiptCreditColIdx];
    const rawBalance = balanceColIdx !== -1 ? row[balanceColIdx] : null;
    const rawIntPaid = intPaidColIdx !== -1 ? row[intPaidColIdx] : null;

    // Check if this row is a summary row by keywords
    const isSummaryText = isRowSummary(particularsStr, dateFormatted, row);

    // Parse numeric Receipt/Credit
    const numericReceipt = parseNumericAmount(rawReceipt);
    const hasPositiveReceipt = numericReceipt !== null && !isNaN(numericReceipt) && numericReceipt > 0;

    rawTransactions.push({
      rowNum: r + 1,
      date: dateFormatted !== '-' ? dateFormatted : '',
      depositDateObj,
      particulars: particularsStr || (hasPositiveReceipt ? 'Deposit' : '-'),
      paymentDebit: rawDebit,
      receiptCredit: numericReceipt,
      rawReceiptCredit: rawReceipt,
      balance: rawBalance,
      intPaid: rawIntPaid,
      isSummaryRow: isSummaryText,
      isValidPayment: hasPositiveReceipt && !isSummaryText,
    });

    if (hasPositiveReceipt && !isSummaryText) {
      if (depositDateObj) {
        transactionDates.push(depositDateObj);
      }
      if (particularsStr) {
        particularsList.push(particularsStr);
      }
    }
  }

  // Step 5: Duplicate Totals Detection & Elimination
  // Avoid adding duplicate summary rows where the final row represents accumulated Receipt/Credit
  let totalDeposited = 0;
  let validTransactionCount = 0;
  let hasSummaryRow = false;

  // First, calculate sum of all marked valid payments
  for (const t of rawTransactions) {
    if (t.isValidPayment && t.receiptCredit !== null) {
      totalDeposited += t.receiptCredit;
      validTransactionCount++;
    }
    if (t.isSummaryRow) {
      hasSummaryRow = true;
    }
  }

  // Second pass: Check if trailing valid row(s) represent accumulated summary rows
  // Example: individual transactions sum to 9,200, and the final row also shows 9,200.
  let hasEliminatedTrailingSummary = true;
  while (hasEliminatedTrailingSummary) {
    hasEliminatedTrailingSummary = false;
    const currentValidIndices: number[] = [];
    let currentValidSum = 0;
    for (let i = 0; i < rawTransactions.length; i++) {
      if (rawTransactions[i].isValidPayment) {
        currentValidIndices.push(i);
        currentValidSum += rawTransactions[i].receiptCredit ?? 0;
      }
    }

    if (currentValidIndices.length > 1) {
      const lastValidIdx = currentValidIndices[currentValidIndices.length - 1];
      const lastRow = rawTransactions[lastValidIdx];
      const lastReceipt = lastRow.receiptCredit ?? 0;
      const sumPreceding = currentValidSum - lastReceipt;

      // If the last transaction's receipt equals the exact sum of all preceding transactions,
      // or if it has no date/particulars and receipt equals the last running balance,
      // it is an accumulated total/summary row!
      const isPrecedingSumMatch = Math.abs(lastReceipt - sumPreceding) < 0.01;
      const isBalanceSummaryWithoutDate =
        !lastRow.date &&
        (lastRow.particulars === '-' || !lastRow.particulars) &&
        lastRow.balance !== null &&
        Math.abs(lastReceipt - (parseNumericAmount(lastRow.balance) ?? -1)) < 0.01;

      if (isPrecedingSumMatch || isBalanceSummaryWithoutDate) {
        lastRow.isSummaryRow = true;
        lastRow.isValidPayment = false;
        hasSummaryRow = true;
        hasEliminatedTrailingSummary = true;
      }
    }
  }

  // Re-sum from confirmed valid payment entries
  totalDeposited = 0;
  validTransactionCount = 0;
  for (const t of rawTransactions) {
    if (t.isValidPayment && t.receiptCredit !== null) {
      totalDeposited += t.receiptCredit;
      validTransactionCount++;
    }
  }

  if (validTransactionCount === 0 || totalDeposited <= 0) {
    throw new RDValidationError(
      'No Valid Payment Transactions Found',
      'Please upload a valid Daily RD or Monthly RD Personal Ledger.'
    );
  }

  // Step 6: Identify RD Type
  let detectedRDType: RDType | null = null;

  if (explicitRDTypeText) {
    detectedRDType = explicitRDTypeText;
  }

  if (!detectedRDType && period) {
    const pLower = period.toLowerCase();
    if (pLower.includes('day') || pLower.includes('daily') || pLower.includes('drd')) {
      detectedRDType = 'Daily RD';
    } else if (pLower.includes('month') || pLower.includes('monthly') || pLower.includes('mrd')) {
      detectedRDType = 'Monthly RD';
    }
  }

  if (!detectedRDType && selectedSheetName) {
    const sLower = selectedSheetName.toLowerCase();
    if (sLower.includes('daily') || sLower.includes('drd')) {
      detectedRDType = 'Daily RD';
    } else if (sLower.includes('monthly') || sLower.includes('mrd')) {
      detectedRDType = 'Monthly RD';
    }
  }

  if (!detectedRDType && particularsList.length > 0) {
    let dailyCount = 0;
    let monthlyCount = 0;
    for (const p of particularsList) {
      const pLower = p.toLowerCase();
      if (pLower.includes('daily') || pLower.includes('drd')) {
        dailyCount++;
      } else if (pLower.includes('monthly') || pLower.includes('mrd') || pLower.includes('installment')) {
        monthlyCount++;
      }
    }
    if (dailyCount > monthlyCount && dailyCount > 0) {
      detectedRDType = 'Daily RD';
    } else if (monthlyCount > dailyCount && monthlyCount > 0) {
      detectedRDType = 'Monthly RD';
    }
  }

  // Transaction dates frequency
  if (!detectedRDType && transactionDates.length >= 2) {
    transactionDates.sort((a, b) => a.getTime() - b.getTime());
    let totalDaysDiff = 0;
    let intervals = 0;
    for (let i = 1; i < transactionDates.length; i++) {
      const diffDays = Math.round(
        (transactionDates[i].getTime() - transactionDates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDays >= 0) {
        totalDaysDiff += diffDays;
        intervals++;
      }
    }
    if (intervals > 0) {
      const avgDays = totalDaysDiff / intervals;
      if (avgDays < 15) {
        detectedRDType = 'Daily RD';
      } else {
        detectedRDType = 'Monthly RD';
      }
    }
  }

  if (!detectedRDType) {
    detectedRDType = 'Daily RD'; // Default to Daily RD as requested
  }

  // Step 7: Date & Period Normalization
  let openingDateObj: Date | null = parseDate(openingDate);
  if (!openingDateObj) {
    if (transactionDates.length > 0) {
      const minTime = Math.min(...transactionDates.map((d) => d.getTime()));
      openingDateObj = new Date(minTime);
    } else {
      openingDateObj = new Date();
    }
    openingDate = formatDateDisplay(openingDateObj);
  } else {
    openingDate = formatDateDisplay(openingDateObj);
  }

  // Parse Period / Tenure (e.g. 365 Days, 12 Months, 1 Year)
  let tenureDays = 365;
  const pLower = (period || '').toLowerCase().trim();
  const dayMatch = pLower.match(/(\d+)\s*(?:day|days|d\b)/);
  const monthMatch = pLower.match(/(\d+)\s*(?:month|months|m\b)/);
  const yearMatch = pLower.match(/(\d+)\s*(?:year|years|y\b)/);
  const pureNumMatch = pLower.match(/^(\d+)$/);

  if (dayMatch) {
    tenureDays = parseInt(dayMatch[1], 10);
  } else if (monthMatch) {
    const m = parseInt(monthMatch[1], 10);
    tenureDays = m === 12 ? 365 : Math.round(m * (365 / 12));
  } else if (yearMatch) {
    tenureDays = parseInt(yearMatch[1], 10) * 365;
  } else if (pureNumMatch) {
    tenureDays = parseInt(pureNumMatch[1], 10);
  }

  if (!period) {
    period = `${tenureDays} Days`;
  }

  // Determine Maturity Date from metadata or Opening Date + Tenure Days
  let maturityDateObj: Date | null = parseDate(maturityDate);
  if (!maturityDateObj) {
    maturityDateObj = new Date(openingDateObj.getTime() + tenureDays * 24 * 60 * 60 * 1000);
    maturityDate = formatDateDisplay(maturityDateObj);
  } else {
    maturityDate = formatDateDisplay(maturityDateObj);
  }

  // Determine Annual Interest Rate (default 12%)
  let annualRate = 0.12;
  if (interestRate) {
    const rateMatch = interestRate.match(/(\d+(?:\.\d+)?)/);
    if (rateMatch) {
      const num = parseFloat(rateMatch[1]);
      if (num > 0) {
        annualRate = num > 1 ? num / 100 : num;
      }
    }
  }
  if (!interestRate) {
    interestRate = `${(annualRate * 100).toFixed(0)}%`;
  }

  // =========================================================================
  // RD CALCULATION
  // Supports both Daily RD and Monthly RD
  // =========================================================================

  // totalDeposited and validTransactionCount were already calculated above
  // after duplicate-summary detection. Recalculate from the final confirmed
  // transaction list to guarantee that only valid payments are included.
  totalDeposited = 0;
  validTransactionCount = 0;

  for (const t of rawTransactions) {
    if (t.isValidPayment && t.receiptCredit !== null && t.receiptCredit > 0) {
      totalDeposited += t.receiptCredit;
      validTransactionCount++;
    }
  }

  const roundedTotalDeposited =
    Math.round((totalDeposited + Number.EPSILON) * 100) / 100;

  // =========================================================================
  // DAILY RD CALCULATION
  // =========================================================================

  if (detectedRDType === 'Daily RD') {
    // Existing Daily RD methodology:
    // Normalized Daily Amount = Total Deposited / 365
    const normalizedDailyAmount = totalDeposited / 365;

    let accumulatedInterest = 0;

    for (let day = 1; day <= 365; day++) {
      accumulatedInterest +=
        normalizedDailyAmount * annualRate * (day / 365);
    }

    const roundedTotalInterest =
      Math.round((accumulatedInterest + Number.EPSILON) * 100) / 100;

    const maturityAmount =
      Math.round(
        (roundedTotalDeposited + roundedTotalInterest + Number.EPSILON) * 100
      ) / 100;

    return {
      fileName,
      fileSize,
      sheetName: selectedSheetName,
      customerName: customerName || 'Not Specified',
      accountNumber: accountNumber || 'Not Specified',
      rdType: detectedRDType,
      openingDate,
      maturityDate,
      interestRate,
      annualRate,
      status,
      period,
      tenureDays,
      transactions: rawTransactions,
      totalDeposited: roundedTotalDeposited,
      normalizedDailyAmount,
      totalInterest: roundedTotalInterest,
      maturityAmount,
      validTransactionCount,
      hasSummaryRow,
      returnRate: Math.round(annualRate * 100),
      returnAmount: roundedTotalInterest,
    };
  }

  // =========================================================================
  // MONTHLY RD CALCULATION
  // =========================================================================

  if (detectedRDType === 'Monthly RD') {
    // Monthly Rate = Annual Rate / 12
    const monthlyRate = annualRate / 12;

    // Determine the number of months from the original period text.
    let tenureMonths = 0;
    const periodLower = (period || '').toLowerCase().trim();

    const monthMatch = periodLower.match(
      /(\d+)\s*(?:month|months|m\b)/
    );

    const yearMatch = periodLower.match(
      /(\d+)\s*(?:year|years|y\b)/
    );

    if (monthMatch) {
      tenureMonths = parseInt(monthMatch[1], 10);
    } else if (yearMatch) {
      tenureMonths = parseInt(yearMatch[1], 10) * 12;
    } else if (tenureDays > 0) {
      tenureMonths = Math.max(
        1,
        Math.round(tenureDays / (365 / 12))
      );
    }

    // If no tenure could be determined, use the number of valid installments.
    if (tenureMonths <= 0) {
      tenureMonths = Math.max(1, validTransactionCount);
    }

    // Get confirmed monthly deposits in chronological order.
    const monthlyDeposits = rawTransactions
      .filter(
        (t) =>
          t.isValidPayment &&
          t.receiptCredit !== null &&
          t.receiptCredit > 0
      )
      .map((t) => ({
        amount: Number(t.receiptCredit),
        date: t.depositDateObj || null,
      }))
      .sort((a, b) => {
        if (!a.date || !b.date) return 0;
        return a.date.getTime() - b.date.getTime();
      });

    /*
     * Progressive Monthly RD interest:
     *
     * Interest for each installment =
     * installment amount × monthly rate × months remaining
     *
     * For a 12-month RD:
     *   installment 1  -> 12 months
     *   installment 2  -> 11 months
     *   installment 3  -> 10 months
     *   ...
     *   installment 12 -> 1 month
     */
    let accumulatedInterest = 0;

    monthlyDeposits.forEach((deposit, index) => {
      const monthsRemaining = Math.max(
        1,
        tenureMonths - index
      );

      accumulatedInterest +=
        deposit.amount * monthlyRate * monthsRemaining;
    });

    const roundedTotalInterest =
      Math.round((accumulatedInterest + Number.EPSILON) * 100) / 100;

    const maturityAmount =
      Math.round(
        (roundedTotalDeposited + roundedTotalInterest + Number.EPSILON) * 100
      ) / 100;

    // The existing RDAccountData interface uses this field for Daily RD.
    // It is not applicable to Monthly RD, so keep it at zero.
    const normalizedDailyAmount = 0;

    return {
      fileName,
      fileSize,
      sheetName: selectedSheetName,
      customerName: customerName || 'Not Specified',
      accountNumber: accountNumber || 'Not Specified',
      rdType: detectedRDType,
      openingDate,
      maturityDate,
      interestRate,
      annualRate,
      status,
      period,
      tenureDays,
      transactions: rawTransactions,
      totalDeposited: roundedTotalDeposited,
      normalizedDailyAmount,
      totalInterest: roundedTotalInterest,
      maturityAmount,
      validTransactionCount,
      hasSummaryRow,
      returnRate: Math.round(annualRate * 100),
      returnAmount: roundedTotalInterest,
    };
  }

  // =========================================================================
  // FALLBACK
  // =========================================================================

  // RD type detection normally always resolves to Daily RD or Monthly RD.
  // Keep the original Daily RD calculation as a safe fallback.
  const normalizedDailyAmount = totalDeposited / 365;
  let accumulatedInterest = 0;

  for (let day = 1; day <= 365; day++) {
    accumulatedInterest +=
      normalizedDailyAmount * annualRate * (day / 365);
  }

  const roundedTotalInterest =
    Math.round((accumulatedInterest + Number.EPSILON) * 100) / 100;

  const maturityAmount =
    Math.round(
      (roundedTotalDeposited + roundedTotalInterest + Number.EPSILON) * 100
    ) / 100;

  return {
    fileName,
    fileSize,
    sheetName: selectedSheetName,
    customerName: customerName || 'Not Specified',
    accountNumber: accountNumber || 'Not Specified',
    rdType: detectedRDType,
    openingDate,
    maturityDate,
    interestRate,
    annualRate,
    status,
    period,
    tenureDays,
    transactions: rawTransactions,
    totalDeposited: roundedTotalDeposited,
    normalizedDailyAmount,
    totalInterest: roundedTotalInterest,
    maturityAmount,
    validTransactionCount,
    hasSummaryRow,
    returnRate: Math.round(annualRate * 100),
    returnAmount: roundedTotalInterest,
  };

}
