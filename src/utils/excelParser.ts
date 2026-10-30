import * as XLSX from 'xlsx';
import {
  RDAccountData,
  LedgerTransactionRow,
  RDType,
  DaySheetCustomer,
  DailyRD90DayAdjustmentDetails,
} from '../types';
import {
  calculateDailyRDMaturity,
  getDefaultRateForDuration,
} from './rdInterestCalculator';

/**
 * Standard validation error used by the application.
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
 * Parse a monetary/numeric Excel value.
 *
 * Supports:
 *   9200
 *   "9200"
 *   "9,200"
 *   "₹9,200"
 *   "Rs. 9,200"
 *   "9,200 Dr"
 */
export function parseNumericAmount(val: any): number | null {
  if (val === null || val === undefined) {
    return null;
  }

  if (typeof val === 'number') {
    return isNaN(val) || !isFinite(val) ? null : val;
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();

    if (!trimmed) {
      return null;
    }

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
 * Format INR currency.
 */
export function formatCurrency(amount: number): string {
  if (
    amount === null ||
    amount === undefined ||
    isNaN(amount)
  ) {
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
 * Parse Excel/date strings into a local Date.
 *
 * Supports:
 *   DD/MM/YYYY
 *   DD-MM-YYYY
 *   DD.MM.YYYY
 *   YYYY-MM-DD
 *   Excel serial date
 *   Date objects
 */
export function parseDate(cellValue: any): Date | null {
  if (
    cellValue === null ||
    cellValue === undefined ||
    cellValue === ''
  ) {
    return null;
  }

  if (cellValue instanceof Date) {
    if (isNaN(cellValue.getTime())) {
      return null;
    }

    return new Date(
      cellValue.getFullYear(),
      cellValue.getMonth(),
      cellValue.getDate()
    );
  }

  if (typeof cellValue === 'number') {
    if (cellValue > 20000 && cellValue < 60000) {
      try {
        const parsed =
          XLSX.SSF.parse_date_code(cellValue);

        if (parsed) {
          return new Date(
            parsed.y,
            parsed.m - 1,
            parsed.d
          );
        }
      } catch {
        // Continue to fallback.
      }
    }

    return null;
  }

  if (typeof cellValue === 'string') {
    const trimmed = cellValue.trim();

    if (!trimmed || trimmed === '-') {
      return null;
    }

    const dmyMatch = trimmed.match(
      /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/
    );

    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month =
        parseInt(dmyMatch[2], 10) - 1;

      let year = parseInt(
        dmyMatch[3],
        10
      );

      if (year < 100) {
        year += 2000;
      }

      const date = new Date(
        year,
        month,
        day
      );

      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    const ymdMatch = trimmed.match(
      /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/
    );

    if (ymdMatch) {
      const year = parseInt(
        ymdMatch[1],
        10
      );

      const month =
        parseInt(ymdMatch[2], 10) - 1;

      const day = parseInt(
        ymdMatch[3],
        10
      );

      const date = new Date(
        year,
        month,
        day
      );

      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    const parsed = new Date(trimmed);

    if (!isNaN(parsed.getTime())) {
      return new Date(
        parsed.getFullYear(),
        parsed.getMonth(),
        parsed.getDate()
      );
    }
  }

  return null;
}

/**
 * Display date as DD/MM/YYYY.
 */
export function formatDateDisplay(
  date: Date | null | undefined
): string {
  if (
    !date ||
    isNaN(date.getTime())
  ) {
    return '-';
  }

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Safely format an Excel date.
 */
export function formatExcelDate(
  cellValue: any
): string {
  if (
    cellValue === null ||
    cellValue === undefined ||
    cellValue === ''
  ) {
    return '-';
  }

  const date = parseDate(cellValue);

  if (date) {
    return formatDateDisplay(date);
  }

  const value = String(cellValue).trim();

  return value || '-';
}

/**
 * Determine whether a row is a summary/cumulative row.
 *
 * Example:
 *
 * Individual deposits:
 * 200
 * 200
 * 400
 *
 * Final cumulative row:
 * Receipt/Credit = 800
 * Balance        = 800
 *
 * The final 800 must NOT be counted as another deposit.
 */
function isRowSummary(
  particularsText: string,
  dateText: string,
  rowValues: any[]
): boolean {
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

  const partLower =
    (particularsText || '')
      .toLowerCase()
      .trim();

  const dateLower =
    (dateText || '')
      .toLowerCase()
      .trim();

  if (
    summaryKeywords.some(
      (keyword) =>
        partLower === keyword ||
        partLower.startsWith(keyword) ||
        partLower.includes(keyword)
    )
  ) {
    return true;
  }

  if (
    summaryKeywords.some(
      (keyword) =>
        dateLower === keyword ||
        dateLower.startsWith(keyword)
    )
  ) {
    return true;
  }

  for (const cell of rowValues) {
    if (typeof cell !== 'string') {
      continue;
    }

    const text =
      cell.toLowerCase().trim();

    if (
      summaryKeywords.some(
        (keyword) =>
          text === keyword ||
          text.startsWith(keyword + ':') ||
          text.startsWith(keyword + ' ')
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Dynamically rebuild worksheet range.
 *
 * No fixed row limit.
 */
function ensureAccurateWorksheetRange(
  sheet: XLSX.WorkSheet
): void {
  let minR = Infinity;
  let maxR = -1;
  let minC = Infinity;
  let maxC = -1;

  for (const key of Object.keys(sheet)) {
    if (key.charCodeAt(0) === 33) {
      continue;
    }

    try {
      const cell =
        XLSX.utils.decode_cell(key);

      if (cell.r < minR) {
        minR = cell.r;
      }

      if (cell.r > maxR) {
        maxR = cell.r;
      }

      if (cell.c < minC) {
        minC = cell.c;
      }

      if (cell.c > maxC) {
        maxC = cell.c;
      }
    } catch {
      // Ignore invalid worksheet properties.
    }
  }

  if (
    maxR >= 0 &&
    maxC >= 0
  ) {
    sheet['!ref'] =
      XLSX.utils.encode_range({
        s: {
          r:
            minR < Infinity
              ? minR
              : 0,
          c:
            minC < Infinity
              ? minC
              : 0,
        },
        e: {
          r: maxR,
          c: maxC,
        },
      });
  }
}

/**
 * Round monetary values to two decimals.
 */
function roundMoney(
  value: number
): number {
  return Math.round(
    (value + Number.EPSILON) * 100
  ) / 100;
}

/**
 * Convert installment words into numbers.
 *
 * TWO INSTALLMENT -> 2
 * FIVE INSTALMENT -> 5
 * TEN INSTALLMENT -> 10
 */
function parseInstallmentCount(
  text: string
): number | null {
  const normalized =
    (text || '').toLowerCase();

  const digitMatch =
    normalized.match(
      /(?:^|\s)(\d{1,3})\s*(?:installments?|instalments?)(?:\s|$)/i
    );

  if (digitMatch) {
    const value = parseInt(
      digitMatch[1],
      10
    );

    return value > 0
      ? value
      : null;
  }

  const words: Record<
    string,
    number
  > = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
  };

  for (
    const [word, value]
    of Object.entries(words)
  ) {
    const pattern =
      new RegExp(
        `(?:^|\\s)${word}\\s*(?:installments?|instalments?)(?:\\s|$)`,
        'i'
      );

    if (
      pattern.test(normalized)
    ) {
      return value;
    }
  }

  return null;
}

/**
 * Greatest common divisor.
 */
function gcd(
  a: number,
  b: number
): number {
  let x =
    Math.abs(Math.round(a));

  let y =
    Math.abs(Math.round(b));

  while (y !== 0) {
    const temp = x % y;
    x = y;
    y = temp;
  }

  return x;
}

/**
 * Determine the Daily RD scheme amount.
 *
 * Example ledger:
 *
 * ₹200
 * ₹400 - TWO INSTALLMENT
 * ₹1,000 - FIVE INSTALLMENT
 * ₹2,000 - TEN INSTALLMENT
 *
 * The parser can therefore identify:
 *
 * ₹400 / 2 = ₹200
 * ₹1,000 / 5 = ₹200
 * ₹2,000 / 10 = ₹200
 *
 * Daily Scheme = ₹200
 *
 * If explicit installment descriptions do not exist,
 * GCD of the actual receipt amounts is used.
 */
function determineDailySchemeAmount(
  transactions: LedgerTransactionRow[],
  totalAmount: number,
  tenureDays: number = 365,
  configuredSchemeAmount?: number,
  schemeName?: string
): number {
  return determineDailyInstallment(
    transactions,
    totalAmount,
    tenureDays,
    configuredSchemeAmount,
    schemeName
  );
}

/**
 * Calculate Daily RD.
 *
 * IMPORTANT BUSINESS RULE:
 *
 * One actual payment date gets one
 * Daily RD installment as profit eligible.
 *
 * Any excess paid on that same date
 * becomes Non-Profit.
 *
 * Example:
 *
 * Daily Scheme = ₹300
 *
 * Day 1 -> ₹300
 * Day 2 -> ₹300
 * Day 7 -> ₹1,500
 *
 * Day 7 becomes:
 *
 * ₹300    Profit Eligible
 * ₹1,200  Non-Profit
 *
 * Missed days are NOT backfilled.
 */
/**
 * Normalize an Excel column header name for fuzzy/agnostic matching.
 */
export function normalizeHeaderName(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Regular expression to match duration and tenure declarations:
 * 1YR, 1 YR, 1YEAR, 2 YRS, 365 DAYS, 12 MONTHS, 52 WEEKS, etc.
 * Ensures tenure numbers like "1" in "1YR" are never mistaken for installment amounts.
 */
export const DURATION_REGEX = /\b\d+\s*(?:years?|yrs?|yr|months?|mths?|mth|mo|weeks?|wks?|wk|days?|d)\b/gi;

/**
 * Determine the Daily RD scheme installment amount.
 *
 * Prioritizes:
 * 1. Configured scheme installment amount (if explicitly provided or parsed from metadata).
 * 2. Explicit installment declarations in scheme name or particulars (e.g. "DRD 100", "Daily RD 100", "₹100/day").
 * 3. Standard company Daily RD scheme code (RCD / DRD defaults to contractual ₹100 unless explicitly specified otherwise).
 * 4. Explicit installment counts in particulars (e.g. "₹1,000 - 10 INSTALLMENTS" -> candidate 1000 / 10 = 100).
 * 5. Combined and irregular payment analysis (GCD and divisors for multiples of the daily deposit).
 * 6. Most frequent deposit amount (mode) when deposits are regular and consistent.
 * 7. Fallback: totalAmount / tenureDays.
 */
export function determineDailyInstallment(
  transactions: LedgerTransactionRow[],
  totalAmount: number,
  tenureDays: number = 365,
  configuredSchemeAmount?: number,
  schemeName?: string
): number {
  // 1. Prioritize explicitly configured scheme installment amount
  if (configuredSchemeAmount !== undefined && configuredSchemeAmount !== null && configuredSchemeAmount > 0) {
    return roundMoney(configuredSchemeAmount);
  }

  // 2. Check schemeName if provided
  if (schemeName) {
    const cleaned = schemeName
      .replace(DURATION_REGEX, ' ')
      .replace(/(?:rec(?:eipt)?|vch|voucher|sl\s*no|bill|no)\.?\s*[-#:]?\s*\d+/gi, ' ');
    const match =
      cleaned.match(/(?:drd|daily\s*rd|rcd)\s*[-#:]?\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)/i) ||
      cleaned.match(/(?:daily\s*installment|scheme\s*amount|daily\s*scheme|daily\s*amount|installment\s*amount)\s*[-#:]?\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)/i) ||
      cleaned.match(/(\d+(?:\.\d+)?)\s*(?:\/|\bper\b)\s*day/i);
    if (match) {
      const val = parseFloat(match[1]);
      if (val > 0 && val <= 100000) return roundMoney(val);
    }
    // Company standard Daily RD scheme code: RCD / DRD has contractual daily installment of ₹100
    if (/^(?:rcd|drd|daily\s*rd)\b/i.test(cleaned.trim())) {
      return 100;
    }
  }

  const validTransactions = transactions.filter(
    (t) => t.isValidPayment && !t.isSummaryRow && t.receiptCredit !== null && Number(t.receiptCredit) > 0
  );

  if (validTransactions.length === 0) {
    return roundMoney(totalAmount / Math.max(1, tenureDays));
  }

  // 3. Check particulars, ignoring tenure declarations and receipt/voucher numbers
  for (const t of validTransactions) {
    const text = (t.particulars || '').toLowerCase();
    const cleaned = text
      .replace(/(?:rec(?:eipt)?|vch|voucher|sl\s*no|bill|no)\.?\s*[-#:]?\s*\d+/gi, ' ')
      .replace(DURATION_REGEX, ' ');
    const match =
      cleaned.match(/(?:drd|daily\s*rd|rcd)\s*[-#:]?\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)/i) ||
      cleaned.match(/(?:daily\s*installment|scheme\s*amount|daily\s*scheme|daily\s*amount|installment\s*amount)\s*[-#:]?\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)/i) ||
      cleaned.match(/(\d+(?:\.\d+)?)\s*(?:\/|\bper\b)\s*day/i);
    if (match) {
      const val = parseFloat(match[1]);
      if (val > 0 && val <= 100000) return roundMoney(val);
    }
  }

  // 4. Check for explicit installment counts in particulars (e.g. "₹1,000 - 10 INSTALLMENT" -> candidate 1000 / 10 = 100)
  const explicitCandidates: number[] = [];
  for (const t of validTransactions) {
    const amt = Number(t.receiptCredit) || 0;
    const count = parseInstallmentCount(t.particulars);
    if (count && count > 0 && amt > 0) {
      const candidate = amt / count;
      if (candidate > 0) {
        explicitCandidates.push(roundMoney(candidate));
      }
    }
  }
  if (explicitCandidates.length > 0) {
    const freq = new Map<number, number>();
    for (const c of explicitCandidates) {
      freq.set(c, (freq.get(c) || 0) + 1);
    }
    let best = explicitCandidates[0];
    let maxC = 0;
    for (const [c, cnt] of freq.entries()) {
      if (cnt > maxC) {
        maxC = cnt;
        best = c;
      }
    }
    if (best > 0) return best;
  }

  // 5. Combined and irregular payment analysis:
  // Customers often pay for multiple days at once (e.g., ₹500, ₹1000, ₹2000).
  const amounts = validTransactions
    .map((t) => roundMoney(Number(t.receiptCredit)))
    .filter((a) => a > 0);

  if (amounts.length > 0) {
    const intAmounts = amounts.map((a) => Math.round(a * 100));
    let commonGcd = intAmounts[0];
    for (let i = 1; i < intAmounts.length; i++) {
      commonGcd = gcd(commonGcd, intAmounts[i]);
      if (commonGcd === 1) break;
    }
    const gcdVal = commonGcd / 100;
    const maxPayment = Math.max(...amounts);
    // Plausible daily installment is between ₹10 and ₹2,000
    if (gcdVal >= 10 && gcdVal <= 2000 && (gcdVal < maxPayment || (amounts.length === 1 && gcdVal <= 1000))) {
      return roundMoney(gcdVal);
    }

    // Check if the minimum positive deposit evenly divides all higher combined deposits
    const minDeposit = Math.min(...amounts);
    if (minDeposit >= 10 && minDeposit <= 2000 && minDeposit < maxPayment) {
      const allDivisible = amounts.every(
        (a) => Math.abs(a % minDeposit) < 0.01 || Math.abs((a % minDeposit) - minDeposit) < 0.01
      );
      if (allDivisible) {
        return roundMoney(minDeposit);
      }
    }
  }

  // 6. Deposit amount frequency (mode) among valid deposits when <= 2000
  const amountCounts = new Map<number, number>();
  for (const amt of amounts) {
    if (amt <= 2000) {
      amountCounts.set(amt, (amountCounts.get(amt) || 0) + 1);
    }
  }

  if (amountCounts.size > 0) {
    let bestAmt = 0;
    let maxCount = -1;
    for (const [amt, count] of amountCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        bestAmt = amt;
      }
    }
    if (bestAmt > 0) return bestAmt;
  }

  // 7. Check if any particulars indicate RCD / DRD
  for (const t of validTransactions) {
    const p = (t.particulars || '').toLowerCase();
    if (p.includes('rcd') || p.includes('drd')) {
      return 100;
    }
  }

  // 8. If total amount is close to multiple of 100 for 365/366 days (e.g. 36500 or 36600)
  const perDay = totalAmount / Math.max(1, tenureDays);
  if (Math.abs(perDay - 100) <= 2) {
    return 100;
  }

  // 9. Fallback
  return roundMoney(perDay);
}

/**
 * Final rounding rule for Daily RD maturity formula result Y:
 * - Decimal portion below 0.50: round down.
 * - Decimal portion equal to or above 0.50: round up.
 */
export function roundMaturityY(val: number): number {
  if (!Number.isFinite(val)) return 0;
  const intPart = Math.floor(val);
  const fracPart = val - intPart;
  return fracPart >= 0.5 ? intPart + 1 : intPart;
}

/**
 * Daily RD Non-Profit Calculation Engine.
 *
 * Implements the company non-profit 90-day calculation methodology:
 * 1. Maturity date = first installment date + 365 days (skipped installments do not change maturity date).
 * 2. Final 90-day period ends on maturity date (between maturityDate - 89 days and maturityDate, inclusive).
 * 3. Required final-90-day amount = dailyInstallment * 90.
 * 4. Non-profit amount A:
 *    A = Math.max(0, actualFinal90DayDeposits - required90DayAmount)
 *    Post-maturity deposits must not automatically be included in A.
 * 5. Profit-eligible adjusted principal:
 *    X = Total Actual Deposits During the Entire RD Period - A.
 * 6. Calculate maturity amount (Y):
 *    Calculated on X using the exact existing company Excel Daily RD formula (DALIY sheet).
 * 7. Final Rounding:
 *    Round only the final Y maturity amount (<0.50 down, >=0.50 up).
 * 8. Final Maturity Amount = Rounded Y + A.
 */
/**
 * Helper to determine if a transaction is a qualifying Daily RD collection transaction.
 */
export function isCollectionTransaction(txn: LedgerTransactionRow): boolean {
  if (!txn) return false;
  if (txn.isSummaryRow || txn.isClosureRow) return false;
  if (!txn.receiptCredit || Number(txn.receiptCredit) <= 0) return false;
  if (txn.paymentDebit && Number(txn.paymentDebit) > 0) return false;

  const type = (txn.transactionType || txn.type || '').trim().toUpperCase();
  if (type === 'COLLECTION' || type === 'DAILY RD COLLECTION' || type === 'RD COLLECTION' || type === 'RECEIPT') {
    return true;
  }
  if (
    type.includes('LOAN') ||
    type.includes('RECOVERY') ||
    type.includes('SHARE') ||
    type.includes('FEE') ||
    type.includes('CHARGE') ||
    type.includes('WITHDRAWAL')
  ) {
    return false;
  }

  const p = (txn.particulars || '').toLowerCase();
  if (
    p.includes('loan') ||
    p.includes('recovery') ||
    p.includes('share') ||
    p.includes('fee') ||
    p.includes('penalty') ||
    p.includes('charge') ||
    p.includes('withdrawal') ||
    p.includes('payout')
  ) {
    return false;
  }

  return txn.isValidPayment !== false;
}

/**
 * Safely resolve Date object from a transaction row.
 */
export function getTransactionDate(txn?: LedgerTransactionRow): Date | null {
  if (!txn) return null;
  if (txn.depositDateObj && !isNaN(txn.depositDateObj.getTime())) {
    return new Date(txn.depositDateObj.getFullYear(), txn.depositDateObj.getMonth(), txn.depositDateObj.getDate());
  }
  if (txn.date) {
    const d = parseDate(txn.date);
    if (d && !isNaN(d.getTime())) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
  }
  return null;
}

/**
 * Daily RD Non-Profit Calculation Engine.
 *
 * Implements the company non-profit 90-day calculation methodology:
 * 1. Maturity date = first installment date + 365 days (skipped installments do not change maturity date).
 * 2. Final 90-day period ends on maturity date (between maturityDate - 89 days and maturityDate, inclusive).
 * 3. Required final-90-day amount = dailyInstallment * 90.
 * 4. Actual final 90-day deposits:
 *    Sums EVERY qualifying collection transaction within the final 90 calendar days.
 *    Does NOT pick only the latest transaction, does NOT pick only one transaction per date,
 *    and aggregates multiple collections on the same date while preventing duplicates.
 * 5. Non-profit amount A:
 *    A = Math.max(0, actualFinal90DayDeposits - required90DayAmount)
 *    Post-maturity deposits must not automatically be included in A.
 * 6. Profit-eligible adjusted principal:
 *    X = Total Actual Deposits During the Entire RD Period - A.
 * 7. Calculate maturity amount (Y):
 *    Calculated on X using the exact existing company Excel Daily RD formula (DALIY sheet).
 * 8. Final Rounding:
 *    Round only the final Y maturity amount (<0.50 down, >=0.50 up).
 * 9. Final Maturity Amount = Rounded Y + A.
 */
export function calculateDailyRDNonProfitMaturity(
  transactions: LedgerTransactionRow[],
  totalAmount: number,
  dailyAmount: number,
  annualRate: number,
  tenureDays: number = 365,
  accountOpeningDate?: Date | null,
  accountMaturityDate?: Date | null,
  schemeName?: string
) {
  // Filter valid transactions with positive deposit amount
  const validTxns = transactions.filter(
    (t) => t.isValidPayment && !t.isSummaryRow && !t.isClosureRow && t.receiptCredit !== null && Number(t.receiptCredit) > 0
  );

  const cleanTenure = Math.max(1, tenureDays);

  // 1. Resolve firstInstallmentDate and maturityDateObj
  // Business rule: Maturity date = First installment date + RD duration (365 days).
  // Missed installments must not change the maturity date.
  let firstInstallmentDate: Date | null = null;
  let maturityDateObj: Date | null = null;

  if (accountMaturityDate && !isNaN(accountMaturityDate.getTime())) {
    maturityDateObj = new Date(
      accountMaturityDate.getFullYear(),
      accountMaturityDate.getMonth(),
      accountMaturityDate.getDate()
    );
    if (accountOpeningDate && !isNaN(accountOpeningDate.getTime())) {
      firstInstallmentDate = new Date(
        accountOpeningDate.getFullYear(),
        accountOpeningDate.getMonth(),
        accountOpeningDate.getDate()
      );
    } else {
      firstInstallmentDate = new Date(
        maturityDateObj.getFullYear(),
        maturityDateObj.getMonth(),
        maturityDateObj.getDate() - cleanTenure
      );
    }
  } else if (accountOpeningDate && !isNaN(accountOpeningDate.getTime())) {
    firstInstallmentDate = new Date(
      accountOpeningDate.getFullYear(),
      accountOpeningDate.getMonth(),
      accountOpeningDate.getDate()
    );
    maturityDateObj = new Date(
      firstInstallmentDate.getFullYear(),
      firstInstallmentDate.getMonth(),
      firstInstallmentDate.getDate() + cleanTenure
    );
  } else {
    // If not explicitly provided in metadata, determine from earliest transaction date
    for (const t of validTxns) {
      const d = getTransactionDate(t);
      if (d && (!firstInstallmentDate || d.getTime() < firstInstallmentDate.getTime())) {
        firstInstallmentDate = d;
      }
    }
    if (!firstInstallmentDate) firstInstallmentDate = new Date();
    maturityDateObj = new Date(
      firstInstallmentDate.getFullYear(),
      firstInstallmentDate.getMonth(),
      firstInstallmentDate.getDate() + cleanTenure
    );
  }

  // 2. Period start = maturityDate - 89 calendar days (90-day window including both start date and maturity date)
  const periodStartObj = new Date(
    maturityDateObj.getFullYear(),
    maturityDateObj.getMonth(),
    maturityDateObj.getDate() - 89
  );

  const startMidnight = new Date(
    periodStartObj.getFullYear(),
    periodStartObj.getMonth(),
    periodStartObj.getDate()
  ).getTime();

  const maturityMidnight = new Date(
    maturityDateObj.getFullYear(),
    maturityDateObj.getMonth(),
    maturityDateObj.getDate()
  ).getTime();

  // Deduplication & Aggregation
  const seenTxnKeys = new Set<string>();
  let actualFinal90DayDeposits = 0;
  let final90DayCollectionCount = 0;
  let postMaturityDeposits = 0;
  let totalActualDeposits = 0;

  // Sort valid transactions by date ascending
  const sortedTxns = [...validTxns].sort((a, b) => {
    const tA = getTransactionDate(a)?.getTime() || 0;
    const tB = getTransactionDate(b)?.getTime() || 0;
    return tA - tB;
  });

  for (const txn of sortedTxns) {
    const amt = Number(txn.receiptCredit) || 0;
    if (amt <= 0) continue;

    const txnDate = getTransactionDate(txn);
    // Duplicate transaction prevention (if row has receipt number or identical row signature)
    const txnKey = txn.receiptNumber
      ? `rcpt:${txn.receiptNumber}`
      : `${txn.rowNum}_${txnDate ? txnDate.getTime() : 0}_${amt}_${txn.particulars || ''}`;

    if (seenTxnKeys.has(txnKey)) {
      continue;
    }
    seenTxnKeys.add(txnKey);

    totalActualDeposits += amt;

    if (txnDate) {
      const txnMidnight = txnDate.getTime();
      if (txnMidnight >= startMidnight && txnMidnight <= maturityMidnight) {
        if (isCollectionTransaction(txn)) {
          actualFinal90DayDeposits += amt;
          final90DayCollectionCount++;
        }
      } else if (txnMidnight > maturityMidnight) {
        postMaturityDeposits += amt;
        txn.isOverTenure = true;
      }
    }
  }

  actualFinal90DayDeposits = roundMoney(actualFinal90DayDeposits);
  totalActualDeposits = roundMoney(totalActualDeposits || totalAmount);
  postMaturityDeposits = roundMoney(postMaturityDeposits);

  // 3. Normalized daily installment shown in the dashboard card
  const normalizedDailyAmount =
    dailyAmount > 0
      ? roundMoney(dailyAmount)
      : roundMoney(determineDailyInstallment(sortedTxns, totalActualDeposits, cleanTenure, dailyAmount, schemeName));

  // 4. Required 90-day amount = Daily Installment * 90
  const required90DayAmount = roundMoney(normalizedDailyAmount * 90);

  // 5. Non-profit amount A = Math.max(0, actualFinal90DayDeposits - required90DayAmount)
  // Post-maturity deposits must not automatically be included in A. Handle them separately.
  const nonProfitAmount = Math.max(0, actualFinal90DayDeposits - required90DayAmount);
  const A = roundMoney(nonProfitAmount);

  // Total actual deposits during the entire RD period (excluding post-maturity deposits)
  const depositsDuringRDPeriod = roundMoney(Math.max(0, totalActualDeposits - postMaturityDeposits));

  // 6. Adjusted Principal X = Total Actual Deposits During the Entire RD Period - A
  const profitEligibleAmount = roundMoney(Math.max(0, depositsDuringRDPeriod - A));
  const X = profitEligibleAmount;

  // 7. Calculate interest on X using exact existing company Excel Daily RD calculation formula
  const ratePercent = annualRate > 1 ? annualRate : annualRate * 100;
  const calc = calculateDailyRDMaturity(cleanTenure, X / cleanTenure, ratePercent);
  const rawY = calc.rawMaturityAmount || 0;
  const calculationResultY = roundMoney(rawY);

  // 8. Final Rounding: round only the final Y maturity amount (< 0.50 down, >= 0.50 up)
  const roundedY = roundMaturityY(rawY);

  // 9. Final Maturity Amount = Rounded Y + A
  const finalMaturityResult = roundMoney(roundedY + A);
  const totalInterest = roundMoney(finalMaturityResult - depositsDuringRDPeriod);

  const dailyRDAdjustment: DailyRD90DayAdjustmentDetails = {
    totalActualDeposits,
    depositsDuringRDPeriod,
    postMaturityDeposits,
    final90DayCollectionCount,
    actualFinal90DayDeposits,
    required90DayAmount,
    nonProfitAmountA: A,
    adjustedPrincipalX: X,
    calculationResultY,
    roundedY,
    finalMaturityAmount: finalMaturityResult,
    totalInterest,
    dailyInstallment: normalizedDailyAmount,
    firstInstallmentDate: formatDateDisplay(firstInstallmentDate),
    maturityDate: formatDateDisplay(maturityDateObj),
    periodStartDate: formatDateDisplay(periodStartObj),
  };

  return {
    dailySchemeAmount: normalizedDailyAmount,
    profitEligibleAmount: X,
    nonProfitAmount: A,
    nonProfitAmountA: A,
    adjustedPrincipalX: X,
    normalizedDailyAmount,
    totalInterest,
    maturityAmount: finalMaturityResult,
    finalMaturityAmount: finalMaturityResult,
    totalActualDeposits,
    totalActualDeposited: totalActualDeposits,
    firstInstallmentDate,
    maturityDateObj,
    periodStartObj,
    required90DayAmount,
    actualFinal90DayDeposits,
    final90DayCollectionCount,
    postMaturityDeposits,
    depositsDuringRDPeriod,
    calculationResultY,
    roundedY,
    rawY,
    dailyRDAdjustment,
  };
}

/**
 * Calculate Daily RD wrapping the non-profit engine.
 */
function calculateDailyRD(
  transactions: LedgerTransactionRow[],
  totalAmount: number,
  dailyAmount: number,
  annualRate: number,
  tenureDays: number,
  accountOpeningDate?: Date | null,
  accountMaturityDate?: Date | null,
  schemeName?: string
) {
  const result = calculateDailyRDNonProfitMaturity(
    transactions,
    totalAmount,
    dailyAmount,
    annualRate,
    tenureDays,
    accountOpeningDate,
    accountMaturityDate,
    schemeName
  );

  return {
    dailySchemeAmount: result.dailySchemeAmount,
    profitEligibleAmount: result.profitEligibleAmount,
    nonProfitAmount: result.nonProfitAmount,
    nonProfitAmountA: result.nonProfitAmountA,
    adjustedPrincipalX: result.adjustedPrincipalX,
    normalizedDailyAmount: result.normalizedDailyAmount,
    totalInterest: result.totalInterest,
    maturityAmount: result.maturityAmount,
    required90DayAmount: result.required90DayAmount,
    actualFinal90DayDeposits: result.actualFinal90DayDeposits,
    final90DayCollectionCount: result.final90DayCollectionCount,
    calculationResultY: result.calculationResultY,
    roundedY: result.roundedY,
    dailyRDAdjustment: result.dailyRDAdjustment,
    firstInstallmentDate: result.firstInstallmentDate,
    maturityDateObj: result.maturityDateObj,
    periodStartObj: result.periodStartObj,
  };
}

export interface DaySheetColumns {
  dateCol: number;
  amountCol: number;
  customerNameCol: number;
  membershipIdCol: number;
  bondNoCol: number;
  schemeCol: number;
  natureCol: number;
  bondDateCol?: number;
  maturityDateCol?: number;
}

/**
 * Detect whether a row serves as the header for a Branch Day Sheet.
 */
export function detectDaySheetHeader(row: any[]): DaySheetColumns | null {
  if (!row || !Array.isArray(row)) return null;

  let dateCol = -1;
  let amountCol = -1;
  let customerNameCol = -1;
  let membershipIdCol = -1;
  let bondNoCol = -1;
  let schemeCol = -1;
  let natureCol = -1;
  let bondDateCol = -1;
  let maturityDateCol = -1;

  for (let c = 0; c < row.length; c++) {
    const raw = row[c];
    if (raw === null || raw === undefined) continue;
    const h = normalizeHeaderName(raw);
    if (!h) continue;

    // DATE
    if (h === 'date' || h === 'txndate' || h === 'transactiondate' || h === 'dt') {
      dateCol = c;
    }
    // AMOUNT
    else if (
      h === 'amount' ||
      h === 'depositamount' ||
      h === 'rcptamount' ||
      h === 'receiptamount' ||
      h === 'netamount' ||
      h === 'paidamount' ||
      h === 'deposit'
    ) {
      amountCol = c;
    }
    // CUSTOMER NAME
    else if (
      h === 'customername' ||
      h === 'custname' ||
      h === 'clientname' ||
      h === 'name' ||
      h === 'customer' ||
      h === 'membername'
    ) {
      customerNameCol = c;
    }
    // MEMBERSHIP ID
    else if (
      h === 'membershipid' ||
      h === 'memberid' ||
      h === 'membershipno' ||
      h === 'memberno' ||
      h === 'memid' ||
      h === 'custid'
    ) {
      membershipIdCol = c;
    }
    // NEW/BOND NO
    else if (
      h === 'newbondno' ||
      h === 'bondno' ||
      h === 'bondnumber' ||
      h === 'accountno' ||
      h === 'acno' ||
      h === 'accountnumber' ||
      h === 'bond' ||
      h === 'newbond'
    ) {
      bondNoCol = c;
    }
    // SCHEME NAME & PLAN
    else if (
      h === 'schemenameplan' ||
      h === 'schemenameandplan' ||
      h === 'schemename' ||
      h === 'scheme' ||
      h === 'plan' ||
      h === 'product'
    ) {
      schemeCol = c;
    }
    // NATURE OF RECEIPT
    else if (
      h === 'natureofreceipt' ||
      h === 'receiptnature' ||
      h === 'nature' ||
      h === 'particulars' ||
      h === 'transactiontype' ||
      h === 'type' ||
      h === 'receipttype'
    ) {
      natureCol = c;
    }
    // BOND / OPENING DATE
    else if (
      h === 'bonddate' ||
      h === 'openingdate' ||
      h === 'startdate' ||
      h === 'acopeningdate' ||
      h === 'dateofopening'
    ) {
      bondDateCol = c;
    }
    // MATURITY DATE
    else if (
      h === 'maturitydate' ||
      h === 'matdate' ||
      h === 'duedate' ||
      h === 'completiondate'
    ) {
      maturityDateCol = c;
    }
  }

  // A Day sheet must have DATE and AMOUNT, and at least two identifying columns
  const otherMatches = [customerNameCol, membershipIdCol, bondNoCol, schemeCol, natureCol].filter(
    (idx) => idx !== -1
  ).length;

  if (dateCol !== -1 && amountCol !== -1 && otherMatches >= 2) {
    return {
      dateCol,
      amountCol,
      customerNameCol,
      membershipIdCol,
      bondNoCol,
      schemeCol,
      natureCol,
      bondDateCol: bondDateCol !== -1 ? bondDateCol : undefined,
      maturityDateCol: maturityDateCol !== -1 ? maturityDateCol : undefined,
    };
  }

  return null;
}

/**
 * Parse a Branch Day Sheet (e.g. SOJAN SUNNY(2).xlsx Sheet2).
 */
export function parseDaySheetRows(
  sheetRows: any[][],
  headerRowIndex: number,
  cols: DaySheetColumns,
  fileName: string,
  fileSize: number,
  sheetName: string,
  activeCustomerKey?: string
): RDAccountData {
  interface CustomerGroup {
    customerKey: string;
    customerName: string;
    membershipId: string;
    bondNumber: string;
    schemeName: string;
    bondDate?: Date | null;
    maturityDate?: Date | null;
    transactions: LedgerTransactionRow[];
    totalDeposited: number;
  }

  const customerGroups: CustomerGroup[] = [];

  for (let r = headerRowIndex + 1; r < sheetRows.length; r++) {
    const row = sheetRows[r];
    if (!row || !Array.isArray(row)) continue;

    const rowValues = row.map((c) => String(c || '').trim());
    const isBlank = rowValues.every((c) => c === '');
    if (isBlank) continue;

    // Check if summary row
    const firstCell = rowValues[0] || '';
    if (isRowSummary(firstCell, '', row)) continue;

    const rawDate = row[cols.dateCol];
    const rawAmount = row[cols.amountCol];
    const amount = parseNumericAmount(rawAmount);

    if (amount === null || amount <= 0) continue;

    const custName = cols.customerNameCol !== -1 ? String(row[cols.customerNameCol] || '').trim() : '';
    const memId = cols.membershipIdCol !== -1 ? String(row[cols.membershipIdCol] || '').trim() : '';
    const bondNo = cols.bondNoCol !== -1 ? String(row[cols.bondNoCol] || '').trim() : '';
    const scheme = cols.schemeCol !== -1 ? String(row[cols.schemeCol] || '').trim() : '';
    const nature = cols.natureCol !== -1 ? String(row[cols.natureCol] || '').trim() : '';
    const rawBondDate = cols.bondDateCol !== undefined && cols.bondDateCol !== -1 ? row[cols.bondDateCol] : null;
    const rawMatDate = cols.maturityDateCol !== undefined && cols.maturityDateCol !== -1 ? row[cols.maturityDateCol] : null;

    // Discard non-deposit entries or non-RD receipts
    const lowerNature = nature.toLowerCase();
    const lowerScheme = scheme.toLowerCase();
    if (
      lowerNature.includes('loan') ||
      lowerNature.includes('recovery') ||
      lowerNature.includes('share') ||
      lowerNature.includes('withdrawal') ||
      lowerNature.includes('fixed deposit') ||
      lowerNature.includes('charges') ||
      lowerNature.includes('penalty') ||
      lowerNature.includes('expense')
    ) {
      continue;
    }
    if (
      lowerScheme.includes('loan') ||
      lowerScheme.includes('fixed deposit') ||
      lowerScheme.includes('fd') ||
      lowerScheme.includes('share')
    ) {
      continue;
    }

    const dateObj = parseDate(rawDate);
    const dateStr = dateObj ? formatDateDisplay(dateObj) : String(rawDate || '');

    // Unify customer across bondNo, custName, and memId
    let group = customerGroups.find((g) => {
      if (bondNo && bondNo !== 'Not Specified' && g.bondNumber && g.bondNumber.toLowerCase() === bondNo.toLowerCase()) {
        return true;
      }
      if (custName && custName !== 'Not Specified' && g.customerName && g.customerName.toLowerCase() === custName.toLowerCase()) {
        return true;
      }
      if (memId && memId !== 'Not Specified' && g.membershipId && g.membershipId.toLowerCase() === memId.toLowerCase()) {
        return true;
      }
      return false;
    });

    const canonicalKey = (custName || bondNo || memId || `Customer-${customerGroups.length + 1}`).trim();

    if (!group) {
      group = {
        customerKey: canonicalKey,
        customerName: custName || 'Not Specified',
        membershipId: memId || 'Not Specified',
        bondNumber: bondNo || 'Not Specified',
        schemeName: scheme,
        bondDate: rawBondDate ? parseDate(rawBondDate) : null,
        maturityDate: rawMatDate ? parseDate(rawMatDate) : null,
        transactions: [],
        totalDeposited: 0,
      };
      customerGroups.push(group);
    }

    if (group.customerName === 'Not Specified' && custName) {
      group.customerName = custName;
    }
    if (group.bondNumber === 'Not Specified' && bondNo) {
      group.bondNumber = bondNo;
    }
    if (group.membershipId === 'Not Specified' && memId) {
      group.membershipId = memId;
    }
    if (!group.schemeName && scheme) {
      group.schemeName = scheme;
    }
    if (!group.bondDate && rawBondDate) {
      group.bondDate = parseDate(rawBondDate);
    }
    if (!group.maturityDate && rawMatDate) {
      group.maturityDate = parseDate(rawMatDate);
    }

    const isCollection =
      lowerNature.includes('collection') ||
      lowerNature.includes('receipt') ||
      lowerNature.includes('rcpt') ||
      lowerNature.includes('deposit') ||
      lowerNature.includes('drd') ||
      lowerNature.includes('daily') ||
      !lowerNature;
    const txnType = isCollection ? 'COLLECTION' : (nature || 'COLLECTION').toUpperCase();

    group.transactions.push({
      rowNum: r + 1,
      date: dateStr,
      depositDateObj: dateObj,
      particulars: [scheme, nature].filter(Boolean).join(' - ') || 'Daily RD Collection',
      receiptCredit: roundMoney(amount),
      rawReceiptCredit: rawAmount,
      amount: roundMoney(amount),
      type: txnType,
      transactionType: txnType,
      isSummaryRow: false,
      isValidPayment: true,
    });
    group.totalDeposited = roundMoney(group.totalDeposited + amount);
  }

  if (customerGroups.length === 0) {
    throw new RDValidationError(
      'No Valid RD Transactions Found',
      'The uploaded Day Sheet did not contain any valid RD deposit transactions.'
    );
  }

  const availableCustomers: DaySheetCustomer[] = [];
  for (const group of customerGroups) {
    availableCustomers.push({
      customerName: group.customerName,
      membershipId: group.membershipId,
      bondNumber: group.bondNumber,
      transactionCount: group.transactions.length,
      totalDeposited: group.totalDeposited,
    });
  }

  // Determine active customer
  let selectedGroup: CustomerGroup | undefined;
  if (activeCustomerKey) {
    selectedGroup = customerGroups.find(
      (g) =>
        g.customerKey === activeCustomerKey ||
        g.customerName.toLowerCase() === activeCustomerKey.toLowerCase() ||
        g.bondNumber.toLowerCase() === activeCustomerKey.toLowerCase()
    );
  }

  if (!selectedGroup) {
    // 1. Check if filename matches a customer name or bond number
    const upperFile = fileName.toUpperCase();
    selectedGroup = customerGroups.find(
      (g) =>
        (g.customerName && g.customerName !== 'Not Specified' && upperFile.includes(g.customerName.toUpperCase())) ||
        (g.bondNumber && g.bondNumber !== 'Not Specified' && upperFile.includes(g.bondNumber.toUpperCase()))
    );

    // 2. Otherwise default to the customer with the most transactions
    if (!selectedGroup) {
      selectedGroup = customerGroups.reduce((prev, curr) =>
        curr.transactions.length > prev.transactions.length ? curr : prev
      );
    }
  }

  const activeGroup = selectedGroup || customerGroups[0];
  const tenureDays = 365;
  const annualRate = 12.0;

  // Detect daily installment from scheme or particulars if available
  // Important: Strip tenure declarations like 1YR so they are never parsed as a 1 rupee installment
  let detectedSchemeDaily = 0;
  if (activeGroup.schemeName) {
    const cleanedScheme = activeGroup.schemeName
      .replace(DURATION_REGEX, '')
      .replace(/(?:rec(?:eipt)?|vch|voucher|sl\s*no|bill|no)\.?\s*[-#:]?\s*\d+/gi, '');
    const m =
      cleanedScheme.match(/(?:drd|daily\s*rd|rcd)\s*[-#:]?\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)/i) ||
      cleanedScheme.match(/(?:daily\s*installment|scheme\s*amount|daily\s*scheme|daily\s*amount|installment\s*amount)\s*[-#:]?\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)/i) ||
      cleanedScheme.match(/(\d+(?:\.\d+)?)\s*(?:\/|\bper\b)\s*day/i);
    if (m) {
      const val = parseFloat(m[1]);
      if (val > 0 && val <= 100000) detectedSchemeDaily = val;
    }
  }

  const dailyInstallment = determineDailyInstallment(
    activeGroup.transactions,
    activeGroup.totalDeposited,
    tenureDays,
    detectedSchemeDaily || undefined,
    activeGroup.schemeName
  );

  const result = calculateDailyRDNonProfitMaturity(
    activeGroup.transactions,
    activeGroup.totalDeposited,
    dailyInstallment,
    annualRate,
    tenureDays,
    activeGroup.bondDate || null,
    activeGroup.maturityDate || null,
    activeGroup.schemeName
  );

  return {
    fileName,
    fileSize,
    sheetName,
    customerName: activeGroup.customerName,
    accountNumber:
      activeGroup.bondNumber !== 'Not Specified'
        ? activeGroup.bondNumber
        : activeGroup.membershipId !== 'Not Specified'
        ? activeGroup.membershipId
        : 'Not Specified',
    rdType: 'Daily RD',
    openingDate: formatDateDisplay(result.firstInstallmentDate),
    maturityDate: formatDateDisplay(result.maturityDateObj),
    interestRate: `${annualRate.toFixed(2)}%`,
    annualRate: annualRate / 100,
    selectedInterestRate: annualRate,
    period: `${tenureDays} Days`,
    tenureDays,
    transactions: activeGroup.transactions,
    totalDeposited: roundMoney(activeGroup.totalDeposited),
    dailySchemeAmount: result.dailySchemeAmount,
    profitEligibleAmount: result.profitEligibleAmount,
    nonProfitAmount: result.nonProfitAmount,
    nonProfitAmountA: result.nonProfitAmountA,
    adjustedPrincipalX: result.adjustedPrincipalX,
    normalizedDailyAmount: result.normalizedDailyAmount,
    totalInterest: result.totalInterest,
    maturityAmount: result.maturityAmount,
    final90DayCollectionCount: result.final90DayCollectionCount,
    actualFinal90DayDeposits: result.actualFinal90DayDeposits,
    required90DayAmount: result.required90DayAmount,
    calculationResultY: result.calculationResultY,
    roundedY: result.roundedY,
    dailyRDAdjustment: result.dailyRDAdjustment,
    validTransactionCount: activeGroup.transactions.length,
    hasSummaryRow: false,
    returnRate: annualRate,
    returnAmount: result.totalInterest,
    isDaySheet: true,
    daySheetCustomers: availableCustomers,
    selectedCustomerKey: activeGroup.customerKey,
    rawDaySheetCustomersData: {
      sheetRows,
      headerRowIndex,
      cols,
      fileName,
      fileSize,
      sheetName,
    },
  };
}

export function selectDaySheetCustomer(
  accountData: RDAccountData,
  customerKey: string
): RDAccountData {
  if (!accountData.isDaySheet || !accountData.rawDaySheetCustomersData) {
    return accountData;
  }
  const raw = accountData.rawDaySheetCustomersData;
  return parseDaySheetRows(
    raw.sheetRows,
    raw.headerRowIndex,
    raw.cols,
    raw.fileName,
    raw.fileSize,
    raw.sheetName,
    customerKey
  );
}

/**
 * Main RD Excel parser.
 *
 * Supports:
 *   - Daily RD
 *   - Monthly RD
 *   - .xlsx
 *   - .xls
 *   - Dynamic transaction row count
 *   - Dynamic transaction header
 *   - Dynamic metadata
 *   - Cumulative/summary row detection
 */
export function parseRDLedgerWorkbook(
  data: ArrayBuffer,
  fileName: string,
  fileSize: number
): RDAccountData {
  let workbook: XLSX.WorkBook;

  try {
    workbook = XLSX.read(
      data,
      {
        type: 'array',
        cellDates: true,
      }
    );
  } catch {
    throw new RDValidationError(
      'Unable to Read Ledger',
      'Please upload a valid RD Personal Ledger Excel file.'
    );
  }

  if (
    !workbook.SheetNames ||
    workbook.SheetNames.length === 0
  ) {
    throw new RDValidationError(
      'Invalid Ledger Format',
      'Please upload a valid RD Personal Ledger Excel file.'
    );
  }

  /**
   * ================================================================
   * STEP 0: Day Sheet Detection (e.g. SOJAN SUNNY(2).xlsx Sheet2)
   * Check if any worksheet in the workbook is a Branch Day Sheet.
   * Ignore summary sheets with broken #REF! formulas (such as
   * TOTAL BUSINESS or AGENT REPORT).
   * ================================================================
   */
  for (const sheetName of workbook.SheetNames) {
    const cleanLower = sheetName.toLowerCase().replace(/[\s\-_()]/g, '');
    if (
      cleanLower.includes('totalbusiness') ||
      cleanLower.includes('agentreport') ||
      cleanLower.includes('agentwise') ||
      cleanLower === 'total' ||
      cleanLower === 'summary'
    ) {
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    ensureAccurateWorksheetRange(sheet);

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      blankrows: true,
    }) as any[][];

    if (!rows || rows.length === 0) continue;

    const scanLimit = Math.min(rows.length, 15);
    for (let r = 0; r < scanLimit; r++) {
      const daySheetCols = detectDaySheetHeader(rows[r]);
      if (daySheetCols) {
        return parseDaySheetRows(
          rows,
          r,
          daySheetCols,
          fileName,
          fileSize,
          sheetName
        );
      }
    }
  }

  /**
   * ================================================================
   * STEP 1
   * Find the best worksheet for conventional RD Personal Ledger.
   * ================================================================
   */

  let selectedSheetName =
    workbook.SheetNames[0];

  let selectedSheetRows: any[][] =
    [];

  let bestSheetScore = -1;

  for (
    const sheetName
    of workbook.SheetNames
  ) {
    const sheet =
      workbook.Sheets[
        sheetName
      ];

    if (!sheet) {
      continue;
    }

    ensureAccurateWorksheetRange(
      sheet
    );

    const rows =
      XLSX.utils.sheet_to_json(
        sheet,
        {
          header: 1,
          defval: '',
          blankrows: true,
        }
      ) as any[][];

    if (
      rows.length === 0
    ) {
      continue;
    }

    let score = 0;

    const cleanName =
      sheetName
        .toLowerCase()
        .replace(
          /[\s\-_()]/g,
          ''
        );

    // Skip summary sheets with broken formulas
    if (
      cleanName.includes('totalbusiness') ||
      cleanName.includes('agentreport') ||
      cleanName.includes('agentwise') ||
      cleanName === 'total' ||
      cleanName === 'summary'
    ) {
      continue;
    }

    if (
      cleanName ===
      'depositpersonalledgerrd'
    ) {
      score += 10000;
    } else if (
      cleanName.includes(
        'depositpersonalledgerrd'
      )
    ) {
      score += 5000;
    } else if (
      cleanName.includes(
        'ledger'
      ) ||
      cleanName.includes(
        'rd'
      ) ||
      cleanName.includes(
        'deposit'
      )
    ) {
      score += 30;
    }

    const scanLimit =
      Math.min(
        rows.length,
        100
      );

    for (
      let rowIndex = 0;
      rowIndex < scanLimit;
      rowIndex++
    ) {
      const row =
        rows[rowIndex] || [];

      const rowText =
        row
          .map((cell) =>
            String(cell)
              .toLowerCase()
          )
          .join(' ');

      if (
        rowText.includes(
          'receipt'
        ) ||
        rowText.includes(
          'credit'
        )
      ) {
        score += 50;
      }

      if (
        rowText.includes(
          'personal ledger'
        ) ||
        rowText.includes(
          'recurring deposit'
        )
      ) {
        score += 40;
      }

      if (
        rowText.includes(
          'customer'
        ) ||
        rowText.includes(
          'account no'
        ) ||
        rowText.includes(
          'a/c no'
        )
      ) {
        score += 20;
      }
    }

    if (
      score > bestSheetScore
    ) {
      bestSheetScore =
        score;

      selectedSheetName =
        sheetName;

      selectedSheetRows =
        rows;
    }
  }

  if (
    selectedSheetRows.length ===
    0
  ) {
    throw new RDValidationError(
      'Invalid Ledger Format',
      'Please upload a valid RD Personal Ledger Excel file.'
    );
  }

  /**
   * ================================================================
   * STEP 2
   * Find transaction header dynamically.
   * ================================================================
   */

  let transactionHeaderRowIdx =
    -1;

  let dateColIdx = -1;
  let particularsColIdx = -1;
  let paymentDebitColIdx = -1;
  let receiptCreditColIdx = -1;
  let balanceColIdx = -1;
  let intPaidColIdx = -1;

  let bestHeaderScore = -1;

  for (
    let rowIndex = 0;
    rowIndex <
    selectedSheetRows.length;
    rowIndex++
  ) {
    const row =
      selectedSheetRows[
        rowIndex
      ] || [];

    let currentDateCol = -1;
    let currentParticularsCol = -1;
    let currentDebitCol = -1;
    let currentReceiptCol = -1;
    let currentBalanceCol = -1;
    let currentIntPaidCol = -1;

    for (
      let columnIndex = 0;
      columnIndex < row.length;
      columnIndex++
    ) {
      const rawText =
        String(
          row[columnIndex] || ''
        ).trim();

      const text =
        rawText.toLowerCase();

      const clean =
        text.replace(
          /[\s\-_/.]/g,
          ''
        );

      if (!text) {
        continue;
      }

      /**
       * Date
       */
      if (
        text === 'date' ||
        clean === 'txndate' ||
        clean === 'transactiondate' ||
        clean === 'transdate' ||
        text === 'dt'
      ) {
        currentDateCol =
          columnIndex;
      }

      /**
       * Particulars
       */
      else if (
        clean.includes(
          'particular'
        ) ||
        clean.includes(
          'description'
        ) ||
        clean.includes(
          'narration'
        ) ||
        clean ===
          'transactiondetails' ||
        clean ===
          'details'
      ) {
        currentParticularsCol =
          columnIndex;
      }

      /**
       * Payment / Debit
       */
      else if (
        clean ===
          'paymentdebit' ||
        text === 'payment' ||
        text === 'debit' ||
        clean === 'dr' ||
        clean === 'dr.' ||
        clean.includes(
          'withdrawal'
        )
      ) {
        currentDebitCol =
          columnIndex;
      }

      /**
       * Receipt / Credit.
       *
       * This is the ONLY column used
       * for actual deposits.
       */
      else if (
        clean ===
          'receiptcredit' ||
        clean ===
          'receiptscredit' ||
        text === 'receipt' ||
        text === 'credit' ||
        clean === 'cr' ||
        clean === 'cr.' ||
        clean.includes(
          'deposit'
        ) ||
        clean.includes(
          'amountpaid'
        ) ||
        clean.includes(
          'paidamount'
        ) ||
        clean ===
          'installment'
      ) {
        if (
          !clean.includes(
            'debit'
          ) &&
          !clean.includes(
            'payment'
          ) &&
          !clean.includes(
            'dr'
          )
        ) {
          currentReceiptCol =
            columnIndex;
        }
      }

      /**
       * Balance
       */
      else if (
        clean ===
          'balance' ||
        clean ===
          'closingbalance' ||
        clean === 'bal' ||
        clean ===
          'runningbalance'
      ) {
        currentBalanceCol =
          columnIndex;
      }

      /**
       * Interest paid
       */
      else if (
        clean ===
          'intpaid' ||
        clean ===
          'interestpaid' ||
        text ===
          'interest'
      ) {
        currentIntPaidCol =
          columnIndex;
      }
    }

    /**
     * A valid transaction header needs
     * Receipt/Credit and Date or Particulars.
     */
    if (
      currentReceiptCol !== -1 &&
      (
        currentDateCol !== -1 ||
        currentParticularsCol !== -1
      )
    ) {
      let score = 50;

      if (
        currentDateCol !== -1
      ) {
        score += 20;
      }

      if (
        currentParticularsCol !== -1
      ) {
        score += 20;
      }

      if (
        currentBalanceCol !== -1
      ) {
        score += 20;
      }

      if (
        currentDebitCol !== -1
      ) {
        score += 10;
      }

      if (
        currentIntPaidCol !== -1
      ) {
        score += 10;
      }

      if (
        score > bestHeaderScore
      ) {
        bestHeaderScore =
          score;

        transactionHeaderRowIdx =
          rowIndex;

        dateColIdx =
          currentDateCol;

        particularsColIdx =
          currentParticularsCol;

        paymentDebitColIdx =
          currentDebitCol;

        receiptCreditColIdx =
          currentReceiptCol;

        balanceColIdx =
          currentBalanceCol;

        intPaidColIdx =
          currentIntPaidCol;
      }
    }
  }

  if (
    transactionHeaderRowIdx === -1 ||
    receiptCreditColIdx === -1
  ) {
    throw new RDValidationError(
      'Invalid Ledger Format',
      'Please upload a valid RD Personal Ledger or Day Sheet Excel file. Expected transaction headers (e.g. DATE, AMOUNT, CUSTOMER NAME, NEW/BOND NO, or Receipt / Credit) were not found.'
    );
  }

  /**
   * ================================================================
   * STEP 3
   * Extract metadata.
   * ================================================================
   */

  let customerName = '';
  let accountNumber = '';
  let openingDate = '';
  let maturityDate = '';
  let interestRate = '';
  let status = '';
  let period = '';
  let explicitRDTypeText = '';
  let schemeName = '';
  let schemeAmount: number | undefined;

  const metadataRowsLimit =
    transactionHeaderRowIdx > 0
      ? transactionHeaderRowIdx
      : Math.min(
          selectedSheetRows.length,
          25
        );

  const getNextCellVal = (
    row: any[],
    startColumn: number
  ) => {
    for (
      let index =
        startColumn + 1;
      index < row.length;
      index++
    ) {
      const value =
        row[index];

      if (
        value !== null &&
        value !== undefined
      ) {
        const text =
          String(value).trim();

        if (
          text &&
          text !== ':' &&
          text !== '-'
        ) {
          return value;
        }
      }
    }

    return '';
  };

  for (
    let rowIndex = 0;
    rowIndex <
    metadataRowsLimit;
    rowIndex++
  ) {
    const row =
      selectedSheetRows[
        rowIndex
      ] || [];

    for (
      let columnIndex = 0;
      columnIndex < row.length;
      columnIndex++
    ) {
      const cellValue =
        String(
          row[columnIndex] || ''
        ).trim();

      const lower =
        cellValue.toLowerCase();

      const label =
        lower
          .replace(
            /[:\-]/g,
            ''
          )
          .trim();

      /**
       * RD TYPE
       */
      if (
        lower.includes(
          'daily rd'
        ) ||
        lower.includes(
          'daily recurring deposit'
        ) ||
        lower === 'drd' ||
        lower.includes(
          'drd '
        )
      ) {
        explicitRDTypeText =
          'Daily RD';
      } else if (
        lower.includes(
          'monthly rd'
        ) ||
        lower.includes(
          'monthly recurring deposit'
        ) ||
        lower === 'mrd' ||
        lower.includes(
          'mrd '
        )
      ) {
        explicitRDTypeText =
          'Monthly RD';
      }

      /**
       * CUSTOMER NAME
       */
      if (!customerName) {
        const nameRegex =
          /(?:customer\s*name|client\s*name|account\s*holder|member\s*name|name)\s*[:\-]\s*(.+)/i;

        const match =
          cellValue.match(
            nameRegex
          );

        if (
          match &&
          match[1]?.trim() &&
          !lower.includes(
            'bank'
          ) &&
          !lower.includes(
            'branch'
          )
        ) {
          customerName =
            match[1].trim();
        } else if (
          label === 'name' ||
          label ===
            'customer name' ||
          label ===
            'client name' ||
          label ===
            'account holder' ||
          label ===
            'member name'
        ) {
          const next =
            String(
              getNextCellVal(
                row,
                columnIndex
              )
            ).trim();

          if (next) {
            customerName =
              next;
          }
        }
      }

      /**
       * ACCOUNT NUMBER
       */
      if (!accountNumber) {
        const accountRegex =
          /(?:a\/c\s*no\.?|ac\s*no\.?|account\s*no\.?|account\s*number|rd\s*a\/c|rd\s*no\.?)\s*[:\-]\s*(.+)/i;

        const match =
          cellValue.match(
            accountRegex
          );

        if (
          match &&
          match[1]?.trim()
        ) {
          accountNumber =
            match[1].trim();
        } else if (
          label === 'a/c no' ||
          label === 'a/c no.' ||
          label === 'ac no' ||
          label === 'ac no.' ||
          label ===
            'account no' ||
          label ===
            'account no.' ||
          label ===
            'account number' ||
          label === 'a/c' ||
          label ===
            'rd a/c' ||
          label === 'rd no' ||
          label === 'account'
        ) {
          const next =
            String(
              getNextCellVal(
                row,
                columnIndex
              )
            ).trim();

          if (next) {
            accountNumber =
              next;
          }
        }
      }

      /**
       * OPENING DATE
       */
      if (!openingDate) {
        const regex =
          /(?:a\/c\s*opening\s*date|opening\s*date|open\s*date|date\s*of\s*opening)\s*[:\-]\s*(.+)/i;

        const match =
          cellValue.match(
            regex
          );

        if (
          match &&
          match[1]?.trim()
        ) {
          openingDate =
            match[1].trim();
        } else if (
          label ===
            'a/c opening date' ||
          label ===
            'opening date' ||
          label ===
            'open date' ||
          label ===
            'date of opening' ||
          label ===
            'start date'
        ) {
          const nextRaw =
            getNextCellVal(
              row,
              columnIndex
            );

          const next =
            formatExcelDate(
              nextRaw
            );

          if (
            next &&
            next !== '-'
          ) {
            openingDate =
              next;
          }
        }
      }

      /**
       * MATURITY DATE
       */
      if (!maturityDate) {
        const regex =
          /(?:maturity\s*date|mat\s*date|due\s*date|expiry\s*date|exp\s*date|completion\s*date)\s*[:\-]\s*(.+)/i;

        const match =
          cellValue.match(
            regex
          );

        if (
          match &&
          match[1]?.trim()
        ) {
          maturityDate =
            match[1].trim();
        } else if (
          label ===
            'maturity date' ||
          label ===
            'mat date' ||
          label ===
            'due date' ||
          label ===
            'expiry date' ||
          label ===
            'exp date' ||
          label ===
            'completion date'
        ) {
          const nextRaw =
            getNextCellVal(
              row,
              columnIndex
            );

          const next =
            formatExcelDate(
              nextRaw
            );

          if (
            next &&
            next !== '-'
          ) {
            maturityDate =
              next;
          }
        }
      }

      /**
       * INTEREST RATE
       */
      if (!interestRate) {
        const regex =
          /(?:interest\s*rate|int\s*rate|roi|rate\s*of\s*interest|rate)\s*[:\-]\s*(.+)/i;

        const match =
          cellValue.match(
            regex
          );

        if (
          match &&
          match[1]?.trim()
        ) {
          interestRate =
            match[1].trim();
        } else if (
          label ===
            'interest rate' ||
          label ===
            'int rate' ||
          label === 'roi' ||
          label ===
            'rate of interest' ||
          label === 'rate'
        ) {
          const next =
            String(
              getNextCellVal(
                row,
                columnIndex
              )
            ).trim();

          if (next) {
            interestRate =
              next;
          }
        }
      }

      /**
       * STATUS
       */
      if (!status) {
        const regex =
          /(?:a\/c\s*status|status)\s*[:\-]\s*(.+)/i;

        const match =
          cellValue.match(
            regex
          );

        if (
          match &&
          match[1]?.trim()
        ) {
          status =
            match[1].trim();
        } else if (
          label === 'status' ||
          label ===
            'a/c status' ||
          label ===
            'account status'
        ) {
          const next =
            String(
              getNextCellVal(
                row,
                columnIndex
              )
            ).trim();

          if (next) {
            status =
              next;
          }
        }
      }

      /**
       * PERIOD
       */
      if (!period) {
        const regex =
          /(?:period|tenure|duration|term|frequency)\s*[:\-]\s*(.+)/i;

        const match =
          cellValue.match(
            regex
          );

        if (
          match &&
          match[1]?.trim()
        ) {
          period =
            match[1].trim();
        } else if (
          label === 'period' ||
          label ===
            'tenure' ||
          label ===
            'duration' ||
          label === 'term' ||
          label ===
            'frequency' ||
          label ===
            'months'
        ) {
          const next =
            String(
              getNextCellVal(
                row,
                columnIndex
              )
            ).trim();

          if (next) {
            period =
              next;
          }
        }
      }
      /**
       * SCHEME NAME / PLAN
       */
      if (!schemeName) {
        const regex =
          /(?:scheme\s*name|scheme|plan)\s*[:\-]\s*(.+)/i;
        const match =
          cellValue.match(regex);
        if (
          match &&
          match[1]?.trim()
        ) {
          schemeName =
            match[1].trim();
        } else if (
          label === 'scheme name' ||
          label === 'scheme' ||
          label === 'plan'
        ) {
          const next =
            String(
              getNextCellVal(
                row,
                columnIndex
              )
            ).trim();
          if (next) {
            schemeName = next;
          }
        }
      }

      /**
       * SCHEME AMOUNT / DAILY INSTALLMENT
       */
      if (schemeAmount === undefined) {
        const regex =
          /(?:daily\s*installment|installment\s*amount|inst\s*amount|scheme\s*amount|daily\s*amount)\s*[:\-]\s*(.+)/i;
        const match =
          cellValue.match(regex);
        if (
          match &&
          match[1]?.trim()
        ) {
          const val =
            parseNumericAmount(match[1]);
          if (val && val > 0) {
            schemeAmount = val;
          }
        } else if (
          label === 'daily installment' ||
          label === 'installment amount' ||
          label === 'inst amount' ||
          label === 'scheme amount' ||
          label === 'daily amount'
        ) {
          const next =
            parseNumericAmount(
              getNextCellVal(
                row,
                columnIndex
              )
            );
          if (next && next > 0) {
            schemeAmount = next;
          }
        }
      }
    }
  }

  /**
   * Some ledgers have:
   *
   * 365 DAYS
   *
   * as a standalone row rather than:
   *
   * Period: 365 DAYS
   *
   * Look for this too.
   */
  if (!period) {
    for (
      let rowIndex = 0;
      rowIndex <
      metadataRowsLimit;
      rowIndex++
    ) {
      const row =
        selectedSheetRows[
          rowIndex
        ] || [];

      for (
        const cell of row
      ) {
        const text =
          String(
            cell || ''
          ).trim();

        if (
          /^\d+\s*(?:days?|months?|years?)$/i.test(
            text
          )
        ) {
          period = text;
          break;
        }
      }

      if (period) {
        break;
      }
    }
  }

  /**
   * Format interest rate.
   */
  if (
    interestRate &&
    !interestRate.includes('%')
  ) {
    const number =
      parseFloat(
        interestRate
      );

    if (!isNaN(number)) {
      if (
        number <= 1 &&
        number > 0
      ) {
        interestRate =
          `${(
            number * 100
          ).toFixed(2).replace(
            /\.00$/,
            ''
          )}%`;
      } else {
        interestRate =
          `${number}%`;
      }
    }
  }

  /**
   * ================================================================
   * STEP 4
   * Extract actual transactions.
   * ================================================================
   */

  const rawTransactions:
    LedgerTransactionRow[] =
    [];

  const transactionDates:
    Date[] = [];

  const particularsList:
    string[] = [];

  for (
    let rowIndex =
      transactionHeaderRowIdx + 1;
    rowIndex <
    selectedSheetRows.length;
    rowIndex++
  ) {
    const row =
      selectedSheetRows[
        rowIndex
      ];

    if (
      !row ||
      !Array.isArray(row)
    ) {
      continue;
    }

    const hasAnyContent =
      row.some(
        (cell) =>
          cell !== null &&
          cell !== undefined &&
          String(
            cell
          ).trim() !== ''
      );

    if (!hasAnyContent) {
      continue;
    }

    const rawDate =
      dateColIdx !== -1
        ? row[dateColIdx]
        : '';

    const dateFormatted =
      formatExcelDate(
        rawDate
      );

    const depositDateObj =
      parseDate(
        rawDate
      );

    const rawParticulars =
      particularsColIdx !== -1
        ? row[
            particularsColIdx
          ]
        : '';

    const particulars =
      String(
        rawParticulars || ''
      ).trim();

    const rawDebit =
      paymentDebitColIdx !== -1
        ? row[
            paymentDebitColIdx
          ]
        : null;

    const rawReceipt =
      row[
        receiptCreditColIdx
      ];

    const rawBalance =
      balanceColIdx !== -1
        ? row[
            balanceColIdx
          ]
        : null;

    const rawIntPaid =
      intPaidColIdx !== -1
        ? row[
            intPaidColIdx
          ]
        : null;

    const numericDebit =
      parseNumericAmount(
        rawDebit
      );

    const hasPositiveDebit =
      numericDebit !== null &&
      !isNaN(numericDebit) &&
      numericDebit > 0;

    const numericIntPaid =
      parseNumericAmount(
        rawIntPaid
      );

    const partLower =
      particulars.toLowerCase();

    const isClosureRow =
      hasPositiveDebit ||
      partLower.includes('closure') ||
      partLower.includes('maturity payout') ||
      partLower.includes('a/c close') ||
      partLower.includes('account close') ||
      partLower.includes('settlement');

    const isSummaryText =
      isRowSummary(
        particulars,
        dateFormatted,
        row
      );

    const numericReceipt =
      parseNumericAmount(
        rawReceipt
      );

    const hasPositiveReceipt =
      numericReceipt !== null &&
      !isNaN(numericReceipt) &&
      numericReceipt > 0;

    rawTransactions.push({
      rowNum:
        rowIndex + 1,

      date:
        dateFormatted !== '-'
          ? dateFormatted
          : '',

      depositDateObj,

      particulars:
        particulars ||
        (
          hasPositiveReceipt
            ? 'Deposit'
            : '-'
        ),

      paymentDebit:
        rawDebit,

      receiptCredit:
        numericReceipt,

      rawReceiptCredit:
        rawReceipt,

      balance:
        rawBalance,

      intPaid:
        rawIntPaid,

      isSummaryRow:
        isSummaryText,

      isClosureRow,

      isValidPayment:
        hasPositiveReceipt &&
        !isSummaryText &&
        !isClosureRow,
    });

    if (
      hasPositiveReceipt &&
      !isSummaryText
    ) {
      if (depositDateObj) {
        transactionDates.push(
          depositDateObj
        );
      }

      if (particulars) {
        particularsList.push(
          particulars
        );
      }
    }
  }

  /**
   * ================================================================
   * STEP 5
   * Remove cumulative/duplicate totals.
   * ================================================================
   */

  let totalDeposited = 0;
  let validTransactionCount = 0;
  let hasSummaryRow = false;

  for (
    const transaction
    of rawTransactions
  ) {
    if (
      transaction.isValidPayment &&
      transaction.receiptCredit !== null
    ) {
      totalDeposited +=
        transaction.receiptCredit;

      validTransactionCount++;
    }

    if (
      transaction.isSummaryRow
    ) {
      hasSummaryRow = true;
    }
  }

  /**
   * Detect a final cumulative row.
   *
   * Example:
   *
   * Previous receipts = ₹9,200
   * Final receipt      = ₹9,200
   *
   * The final row is not a new deposit.
   */
  let removedTrailingSummary =
    true;

  while (
    removedTrailingSummary
  ) {
    removedTrailingSummary =
      false;

    const validIndices:
      number[] = [];

    let currentSum = 0;

    for (
      let index = 0;
      index <
      rawTransactions.length;
      index++
    ) {
      const transaction =
        rawTransactions[
          index
        ];

      if (
        transaction.isValidPayment
      ) {
        validIndices.push(
          index
        );

        currentSum +=
          transaction.receiptCredit ||
          0;
      }
    }

    if (
      validIndices.length > 1
    ) {
      const lastIndex =
        validIndices[
          validIndices.length - 1
        ];

      const lastTransaction =
        rawTransactions[
          lastIndex
        ];

      const lastReceipt =
        lastTransaction.receiptCredit ||
        0;

      const precedingSum =
        currentSum -
        lastReceipt;

      const isPrecedingSumMatch =
        Math.abs(
          lastReceipt -
            precedingSum
        ) < 0.01;

      const balanceValue =
        parseNumericAmount(
          lastTransaction.balance
        );

      const isBalanceSummary =
        !lastTransaction.date &&
        (
          lastTransaction.particulars ===
            '-' ||
          !lastTransaction.particulars
        ) &&
        balanceValue !== null &&
        Math.abs(
          lastReceipt -
            balanceValue
        ) < 0.01;

      if (
        isPrecedingSumMatch ||
        isBalanceSummary
      ) {
        lastTransaction.isSummaryRow =
          true;

        lastTransaction.isValidPayment =
          false;

        hasSummaryRow =
          true;

        removedTrailingSummary =
          true;
      }
    }
  }

  /**
   * Recalculate from confirmed
   * valid transactions.
   */
  totalDeposited = 0;
  validTransactionCount = 0;

  for (
    const transaction
    of rawTransactions
  ) {
    if (
      transaction.isValidPayment &&
      transaction.receiptCredit !== null &&
      transaction.receiptCredit > 0
    ) {
      totalDeposited +=
        transaction.receiptCredit;

      validTransactionCount++;
    }
  }

  if (
    validTransactionCount === 0 ||
    totalDeposited <= 0
  ) {
    throw new RDValidationError(
      'No Valid Payment Transactions Found',
      'Please upload a valid Daily RD or Monthly RD Personal Ledger.'
    );
  }

  /**
   * ================================================================
   * STEP 6
   * Determine RD type.
   * ================================================================
   */

  let detectedRDType:
    RDType | null = null;

  /**
   * Explicit metadata has highest
   * priority.
   */
  if (
    explicitRDTypeText
  ) {
    detectedRDType =
      explicitRDTypeText;
  }

  /**
   * Period-based detection.
   */
  if (
    !detectedRDType &&
    period
  ) {
    const lowerPeriod =
      period.toLowerCase();

    if (
      lowerPeriod.includes(
        'day'
      ) ||
      lowerPeriod.includes(
        'daily'
      ) ||
      lowerPeriod.includes(
        'drd'
      )
    ) {
      detectedRDType =
        'Daily RD';
    } else if (
      lowerPeriod.includes(
        'month'
      ) ||
      lowerPeriod.includes(
        'monthly'
      ) ||
      lowerPeriod.includes(
        'mrd'
      )
    ) {
      detectedRDType =
        'Monthly RD';
    }
  }

  /**
   * Sheet name detection.
   */
  if (
    !detectedRDType &&
    selectedSheetName
  ) {
    const lowerSheet =
      selectedSheetName
        .toLowerCase();

    if (
      lowerSheet.includes(
        'daily'
      ) ||
      lowerSheet.includes(
        'drd'
      )
    ) {
      detectedRDType =
        'Daily RD';
    } else if (
      lowerSheet.includes(
        'monthly'
      ) ||
      lowerSheet.includes(
        'mrd'
      )
    ) {
      detectedRDType =
        'Monthly RD';
    }
  }

  /**
   * Particulars detection.
   */
  if (
    !detectedRDType &&
    particularsList.length > 0
  ) {
    let dailyCount = 0;
    let monthlyCount = 0;

    for (
      const particulars
      of particularsList
    ) {
      const lower =
        particulars
          .toLowerCase();

      if (
        lower.includes(
          'daily'
        ) ||
        lower.includes(
          'drd'
        )
      ) {
        dailyCount++;
      }

      if (
        lower.includes(
          'monthly'
        ) ||
        lower.includes(
          'mrd'
        ) ||
        lower.includes(
          'installment'
        ) ||
        lower.includes(
          'instalment'
        )
      ) {
        monthlyCount++;
      }
    }

    if (
      dailyCount >
        monthlyCount &&
      dailyCount > 0
    ) {
      detectedRDType =
        'Daily RD';
    } else if (
      monthlyCount >
        dailyCount &&
      monthlyCount > 0
    ) {
      detectedRDType =
        'Monthly RD';
    }
  }

  /**
   * Transaction frequency detection.
   */
  if (
    !detectedRDType &&
    transactionDates.length >= 2
  ) {
    const sortedDates =
      [...transactionDates]
        .sort(
          (a, b) =>
            a.getTime() -
            b.getTime()
        );

    let totalDaysDifference =
      0;

    let intervals = 0;

    for (
      let index = 1;
      index <
      sortedDates.length;
      index++
    ) {
      const difference =
        Math.round(
          (
            sortedDates[
              index
            ].getTime() -
            sortedDates[
              index - 1
            ].getTime()
          ) /
            (
              1000 *
              60 *
              60 *
              24
            )
        );

      if (
        difference >= 0
      ) {
        totalDaysDifference +=
          difference;

        intervals++;
      }
    }

    if (
      intervals > 0
    ) {
      const averageDays =
        totalDaysDifference /
        intervals;

      if (
        averageDays < 15
      ) {
        detectedRDType =
          'Daily RD';
      } else {
        detectedRDType =
          'Monthly RD';
      }
    }
  }

  /**
   * Default.
   */
  if (
    !detectedRDType
  ) {
    detectedRDType =
      'Daily RD';
  }

  /**
   * ================================================================
   * STEP 7
   * Dates and tenure.
   * ================================================================
   */

  let openingDateObj =
    parseDate(
      openingDate
    );

  if (
    !openingDateObj
  ) {
    if (
      transactionDates.length > 0
    ) {
      const minimumTime =
        Math.min(
          ...transactionDates.map(
            (date) =>
              date.getTime()
          )
        );

      openingDateObj =
        new Date(
          minimumTime
        );
    } else {
      openingDateObj =
        new Date();
    }

    openingDate =
      formatDateDisplay(
        openingDateObj
      );
  } else {
    openingDate =
      formatDateDisplay(
        openingDateObj
      );
  }

  /**
   * Parse tenure.
   */
  let tenureDays = 365;

  const periodLower =
    (period || '')
      .toLowerCase()
      .trim();

  const dayMatch =
    periodLower.match(
      /(\d+)\s*(?:day|days|d\b)/
    );

  const monthMatch =
    periodLower.match(
      /(\d+)\s*(?:month|months|m\b)/
    );

  const yearMatch =
    periodLower.match(
      /(\d+)\s*(?:year|years|y\b)/
    );

  const pureNumberMatch =
    periodLower.match(
      /^(\d+)$/
    );

  if (dayMatch) {
    tenureDays =
      parseInt(
        dayMatch[1],
        10
      );
  } else if (
    monthMatch
  ) {
    const months =
      parseInt(
        monthMatch[1],
        10
      );

    tenureDays =
      months === 12
        ? 365
        : Math.round(
            months *
              (
                365 / 12
              )
          );
  } else if (
    yearMatch
  ) {
    tenureDays =
      parseInt(
        yearMatch[1],
        10
      ) * 365;
  } else if (
    pureNumberMatch
  ) {
    tenureDays =
      parseInt(
        pureNumberMatch[1],
        10
      );
  }

  if (!period) {
    period =
      `${tenureDays} Days`;
  }

  /**
   * Maturity date.
   */
  let maturityDateObj =
    parseDate(
      maturityDate
    );

  if (
    !maturityDateObj
  ) {
    maturityDateObj =
      new Date(
        openingDateObj.getTime() +
          tenureDays *
            24 *
            60 *
            60 *
            1000
      );

    maturityDate =
      formatDateDisplay(
        maturityDateObj
      );
  } else {
    if (!parseDate(openingDate)) {
      openingDateObj = new Date(
        maturityDateObj.getTime() - tenureDays * 24 * 60 * 60 * 1000
      );
      openingDate = formatDateDisplay(openingDateObj);
    }

    maturityDate =
      formatDateDisplay(
        maturityDateObj
      );
  }

  /**
   * ================================================================
   * STEP 8
   * Interest rate.
   * ================================================================
   */

  let annualRate = 0.12;

  if (
    interestRate
  ) {
    const rateMatch =
      interestRate.match(
        /(\d+(?:\.\d+)?)/
      );

    if (rateMatch) {
      const number =
        parseFloat(
          rateMatch[1]
        );

      if (
        number > 0
      ) {
        annualRate =
          number > 1
            ? number / 100
            : number;
      }
    }
  }

  if (
    !interestRate
  ) {
    interestRate =
      `${(
        annualRate * 100
      ).toFixed(0)}%`;
  }

  /**
   * ================================================================
   * STEP 9
   * FINAL TOTAL DEPOSITED
   * ================================================================
   *
   * ONLY Receipt/Credit is used.
   *
   * Balance is NEVER added.
   * Payment/Debit is NEVER added.
   * Int Paid is NEVER added.
   */
  totalDeposited = 0;
  validTransactionCount = 0;

  for (
    const transaction
    of rawTransactions
  ) {
    if (
      transaction.isValidPayment &&
      transaction.receiptCredit !== null &&
      transaction.receiptCredit > 0
    ) {
      totalDeposited +=
        Number(
          transaction.receiptCredit
        );

      validTransactionCount++;
    }
  }

  const roundedTotalDeposited =
    roundMoney(
      totalDeposited
    );

  /**
   * ================================================================
   * STEP 10
   * DAILY RD
   * ================================================================
   */

  if (
    detectedRDType ===
    'Daily RD'
  ) {
    /**
     * Determine actual Daily Scheme.
     *
     * For your example files:
     *
     * ₹400 / TWO INSTALMENT = ₹200
     * ₹1000 / FIVE INSTALMENT = ₹200
     * ₹2000 / TEN INSTALMENT = ₹200
     *
     * Therefore:
     *
     * Daily Scheme = ₹200
     */
    const dailySchemeAmount =
      determineDailyInstallment(
        rawTransactions,
        roundedTotalDeposited,
        tenureDays,
        schemeAmount,
        schemeName
      );

    const calculation =
      calculateDailyRD(
        rawTransactions,
        roundedTotalDeposited,
        dailySchemeAmount,
        annualRate,
        tenureDays,
        openingDateObj,
        maturityDateObj,
        schemeName
      );

    return {
      fileName,

      fileSize,

      sheetName:
        selectedSheetName,

      customerName:
        customerName ||
        'Not Specified',

      accountNumber:
        accountNumber ||
        'Not Specified',

      rdType:
        detectedRDType,

      openingDate,

      maturityDate,

      interestRate,

      annualRate,

      status,

      period,

      tenureDays,

      transactions:
        rawTransactions,

      totalDeposited:
        roundedTotalDeposited,

      dailySchemeAmount:
        calculation.dailySchemeAmount,

      profitEligibleAmount:
        calculation.profitEligibleAmount,

      nonProfitAmount:
        calculation.nonProfitAmount,

      nonProfitAmountA:
        calculation.nonProfitAmountA,

      adjustedPrincipalX:
        calculation.adjustedPrincipalX,

      normalizedDailyAmount:
        calculation.normalizedDailyAmount,

      totalInterest:
        calculation.totalInterest,

      maturityAmount:
        calculation.maturityAmount,

      actualFinal90DayDeposits:
        calculation.actualFinal90DayDeposits,

      final90DayCollectionCount:
        calculation.final90DayCollectionCount,

      required90DayAmount:
        calculation.required90DayAmount,

      calculationResultY:
        calculation.calculationResultY,

      roundedY:
        calculation.roundedY,

      dailyRDAdjustment:
        calculation.dailyRDAdjustment,

      validTransactionCount,

      hasSummaryRow,

      returnRate:
        Math.round(
          annualRate * 100
        ),

      returnAmount:
        calculation.totalInterest,
    };
  }

  /**
   * ================================================================
   * STEP 11
   * MONTHLY RD
   * ================================================================
   */

  if (
    detectedRDType ===
    'Monthly RD'
  ) {
    const monthlyRate =
      annualRate / 12;

    let tenureMonths = 0;

    const lowerPeriod =
      (period || '')
        .toLowerCase()
        .trim();

    const monthlyMatch =
      lowerPeriod.match(
        /(\d+)\s*(?:month|months|m\b)/
      );

    const yearlyMatch =
      lowerPeriod.match(
        /(\d+)\s*(?:year|years|y\b)/
      );

    if (
      monthlyMatch
    ) {
      tenureMonths =
        parseInt(
          monthlyMatch[1],
          10
        );
    } else if (
      yearlyMatch
    ) {
      tenureMonths =
        parseInt(
          yearlyMatch[1],
          10
        ) * 12;
    } else if (
      tenureDays > 0
    ) {
      tenureMonths =
        Math.max(
          1,
          Math.round(
            tenureDays /
              (
                365 / 12
              )
          )
        );
    }

    if (
      tenureMonths <= 0
    ) {
      tenureMonths =
        Math.max(
          1,
          validTransactionCount
        );
    }

    const monthlyDeposits =
      rawTransactions
        .filter(
          (transaction) =>
            transaction.isValidPayment &&
            transaction.receiptCredit !== null &&
            transaction.receiptCredit > 0
        )
        .map(
          (transaction) => ({
            amount:
              Number(
                transaction.receiptCredit
              ),

            date:
              transaction.depositDateObj ||
              null,
          })
        )
        .sort(
          (a, b) => {
            if (
              !a.date &&
              !b.date
            ) {
              return 0;
            }

            if (!a.date) {
              return 1;
            }

            if (!b.date) {
              return -1;
            }

            return (
              a.date.getTime() -
              b.date.getTime()
            );
          }
        );

    /**
     * MONTHLY RD MATURITY CALCULATION (Company Excel Methodology)
     *
     * Reference Workbook: CALCULATION OF RD - 2026 FEB 04 - 12%.xlsx (MONTHLY sheet)
     * Start with a zero balance.
     * Allocates combined payments across due installment periods to prevent
     * double-counting phantom installments at the end of the term.
     */
    let recordedInterestPaid: number | null = null;
    let closureDate: string | undefined = undefined;
    let closureAmount: number | undefined = undefined;

    for (const tx of rawTransactions) {
      if (tx.intPaid !== null && tx.intPaid !== undefined && tx.intPaid !== '') {
        const intVal = parseNumericAmount(tx.intPaid);
        if (intVal !== null && intVal > 0) {
          recordedInterestPaid = intVal;
        }
      }
      if (tx.isClosureRow) {
        if (tx.paymentDebit) {
          const deb = parseNumericAmount(tx.paymentDebit);
          if (deb) closureAmount = deb;
        }
        if (tx.date) closureDate = tx.date;
      }
    }

    let balance = 0;
    const numberOfMonths = Math.max(1, tenureMonths);
    const expectedInstallment =
      roundedTotalDeposited > 0
        ? roundedTotalDeposited / numberOfMonths
        : 2000;

    const installmentSlots = new Array(numberOfMonths).fill(0);
    let curSlot = 0;
    for (const dep of monthlyDeposits) {
      const count = Math.max(
        1,
        Math.round(dep.amount / expectedInstallment)
      );
      for (let k = 0; k < count && curSlot < numberOfMonths; k++) {
        installmentSlots[curSlot] = expectedInstallment;
        curSlot++;
      }
    }

    for (let m = 0; m < numberOfMonths; m++) {
      balance += installmentSlots[m];
      const periodInterest = balance * monthlyRate;
      balance += periodInterest;
    }

    const totalInterest = roundMoney(balance - roundedTotalDeposited);
    const maturityAmount = roundMoney(balance);

    return {
      fileName,

      fileSize,

      sheetName:
        selectedSheetName,

      customerName:
        customerName ||
        'Not Specified',

      accountNumber:
        accountNumber ||
        'Not Specified',

      rdType:
        detectedRDType,

      openingDate,

      maturityDate,

      interestRate,

      annualRate,

      status,

      period,

      tenureDays,

      transactions:
        rawTransactions,

      totalDeposited:
        roundedTotalDeposited,

      /**
       * Daily RD fields are not applicable
       * to Monthly RD.
       */
      dailySchemeAmount: 0,

      profitEligibleAmount:
        roundedTotalDeposited,

      nonProfitAmount: 0,

      normalizedDailyAmount: 0,

      totalInterest,

      maturityAmount,

      validTransactionCount,

      hasSummaryRow,

      returnRate:
        Math.round(
          annualRate * 100
        ),

      returnAmount:
        totalInterest,

      installmentsDue: numberOfMonths,

      installmentsPaid: curSlot,

      recordedInterestPaid,

      closureDate,

      closureAmount,
    };
  }

  /**
   * ================================================================
   * STEP 12
   * SAFE FALLBACK
   * ================================================================
   */

  const fallbackDailySchemeAmount =
    determineDailySchemeAmount(
      rawTransactions,
      roundedTotalDeposited,
      tenureDays
    );

  const fallback =
    calculateDailyRD(
      rawTransactions,
      roundedTotalDeposited,
      fallbackDailySchemeAmount,
      annualRate,
      tenureDays
    );

  return {
    fileName,

    fileSize,

    sheetName:
      selectedSheetName,

    customerName:
      customerName ||
      'Not Specified',

    accountNumber:
      accountNumber ||
      'Not Specified',

    rdType:
      detectedRDType,

    openingDate,

    maturityDate,

    interestRate,

    annualRate,

    status,

    period,

    tenureDays,

    transactions:
      rawTransactions,

    totalDeposited:
      roundedTotalDeposited,

    dailySchemeAmount:
      fallback.dailySchemeAmount,

    profitEligibleAmount:
      fallback.profitEligibleAmount,

    nonProfitAmount:
      fallback.nonProfitAmount,

    normalizedDailyAmount:
      fallback.normalizedDailyAmount,

    totalInterest:
      fallback.totalInterest,

    maturityAmount:
      fallback.maturityAmount,

    actualFinal90DayDeposits:
      fallback.actualFinal90DayDeposits,

    required90DayAmount:
      fallback.required90DayAmount,

    calculationResultY:
      fallback.calculationResultY,

    roundedY:
      fallback.roundedY,

    dailyRDAdjustment:
      fallback.dailyRDAdjustment,

    validTransactionCount,

    hasSummaryRow,

    returnRate:
      Math.round(
        annualRate * 100
      ),

    returnAmount:
      fallback.totalInterest,
  };
}