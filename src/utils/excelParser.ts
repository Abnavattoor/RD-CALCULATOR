import * as XLSX from 'xlsx';
import {
  RDAccountData,
  LedgerTransactionRow,
  RDType,
} from '../types';

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
  tenureDays: number
): number {
  const validTransactions =
    transactions.filter(
      (transaction) =>
        transaction.isValidPayment &&
        transaction.receiptCredit !== null &&
        Number(
          transaction.receiptCredit
        ) > 0
    );

  if (
    validTransactions.length === 0
  ) {
    return roundMoney(
      totalAmount /
        Math.max(tenureDays, 1)
    );
  }

  /**
   * First try explicit installment
   * descriptions.
   */
  const explicitCandidates: number[] =
    [];

  for (
    const transaction
    of validTransactions
  ) {
    const amount =
      Number(
        transaction.receiptCredit
      );

    const count =
      parseInstallmentCount(
        transaction.particulars
      );

    if (
      count &&
      count > 0 &&
      amount > 0
    ) {
      const candidate =
        amount / count;

      if (candidate > 0) {
        explicitCandidates.push(
          candidate
        );
      }
    }
  }

  if (
    explicitCandidates.length > 0
  ) {
    const frequency =
      new Map<number, number>();

    for (
      const candidate
      of explicitCandidates
    ) {
      const value =
        roundMoney(candidate);

      frequency.set(
        value,
        (frequency.get(value) || 0) + 1
      );
    }

    let bestValue =
      explicitCandidates[0];

    let bestCount = 0;

    for (
      const [value, count]
      of frequency.entries()
    ) {
      if (
        count > bestCount ||
        (
          count === bestCount &&
          value < bestValue
        )
      ) {
        bestValue = value;
        bestCount = count;
      }
    }

    if (bestValue > 0) {
      return roundMoney(
        bestValue
      );
    }
  }

  /**
   * Next method: GCD of all
   * actual receipt amounts.
   */
  const amounts =
    validTransactions
      .map((transaction) =>
        roundMoney(
          Number(
            transaction.receiptCredit
          )
        )
      )
      .filter(
        (amount) => amount > 0
      );

  if (amounts.length > 0) {
    const integerAmounts =
      amounts.map(
        (amount) =>
          Math.round(amount * 100)
      );

    let common =
      integerAmounts[0];

    for (
      let index = 1;
      index < integerAmounts.length;
      index++
    ) {
      common =
        gcd(
          common,
          integerAmounts[index]
        );

      if (common === 1) {
        break;
      }
    }

    const gcdAmount =
      common / 100;

    if (gcdAmount >= 1) {
      return roundMoney(
        gcdAmount
      );
    }

    /**
     * Last fallback:
     * smallest positive recurring
     * payment.
     */
    const frequency =
      new Map<number, number>();

    for (
      const amount of amounts
    ) {
      frequency.set(
        amount,
        (frequency.get(amount) || 0) + 1
      );
    }

    let smallestRecurring =
      amounts[0];

    let smallestCount =
      frequency.get(
        smallestRecurring
      ) || 0;

    for (
      const [amount, count]
      of frequency.entries()
    ) {
      if (
        count > smallestCount ||
        (
          count === smallestCount &&
          amount < smallestRecurring
        )
      ) {
        smallestRecurring =
          amount;

        smallestCount =
          count;
      }
    }

    return roundMoney(
      smallestRecurring
    );
  }

  return roundMoney(
    totalAmount /
      Math.max(tenureDays, 1)
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
function calculateDailyRD(
  transactions: LedgerTransactionRow[],
  totalAmount: number,
  dailyAmount: number,
  annualRate: number,
  tenureDays: number
) {
  const validPayments =
    transactions
      .filter(
        (transaction) =>
          transaction.isValidPayment &&
          transaction.receiptCredit !== null &&
          Number(
            transaction.receiptCredit
          ) > 0
      )
      .map((transaction) => ({
        transaction,
        amount:
          Number(
            transaction.receiptCredit
          ),
      }))
      .sort((a, b) => {
        const dateA =
          a.transaction
            .depositDateObj;

        const dateB =
          b.transaction
            .depositDateObj;

        if (
          !dateA &&
          !dateB
        ) {
          return 0;
        }

        if (!dateA) {
          return 1;
        }

        if (!dateB) {
          return -1;
        }

        return (
          dateA.getTime() -
          dateB.getTime()
        );
      });

  let profitEligibleAmount = 0;
  let nonProfitAmount = 0;

  for (
    const payment
    of validPayments
  ) {
    const amount =
      roundMoney(
        payment.amount
      );

    /**
     * One daily installment
     * is eligible on an actual
     * payment date.
     */
    const eligible =
      Math.min(
        amount,
        dailyAmount
      );

    /**
     * Everything above the
     * daily installment is
     * non-profit.
     */
    const nonProfit =
      Math.max(
        0,
        amount - dailyAmount
      );

    profitEligibleAmount +=
      eligible;

    nonProfitAmount +=
      nonProfit;
  }

  const roundedTotal =
    roundMoney(
      totalAmount
    );

  profitEligibleAmount =
    roundMoney(
      profitEligibleAmount
    );

  nonProfitAmount =
    roundMoney(
      nonProfitAmount
    );

  /**
   * Safety reconciliation:
   *
   * Total Deposited
   * =
   * Profit Eligible
   * +
   * Non-Profit
   */
  const difference =
    roundMoney(
      roundedTotal -
        profitEligibleAmount -
        nonProfitAmount
    );

  if (
    Math.abs(difference) > 0.01
  ) {
    nonProfitAmount =
      roundMoney(
        Math.max(
          0,
          roundedTotal -
            profitEligibleAmount
        )
      );
  }

  const calculationDays =
    Math.max(
      1,
      tenureDays
    );

  /**
   * Normalized Daily Amount
   *
   * IMPORTANT:
   * It is based on the profit-eligible
   * amount, not the non-profit amount.
   */
  const normalizedDailyAmount =
    profitEligibleAmount /
    calculationDays;

  /**
   * Progressive Daily RD interest.
   */
  let totalInterest = 0;

  for (
    let day = 1;
    day <= calculationDays;
    day++
  ) {
    totalInterest +=
      normalizedDailyAmount *
      annualRate *
      (day / calculationDays);
  }

  totalInterest =
    roundMoney(
      totalInterest
    );

  /**
   * The non-profit amount is still
   * customer's principal.
   *
   * Therefore it remains inside
   * maturity, but earns no Daily RD
   * profit.
   */
  const maturityAmount =
    roundMoney(
      roundedTotal +
        totalInterest
    );

  return {
    dailySchemeAmount:
      roundMoney(
        dailyAmount
      ),

    profitEligibleAmount,

    nonProfitAmount,

    normalizedDailyAmount:
      roundMoney(
        normalizedDailyAmount
      ),

    totalInterest,

    maturityAmount,
  };
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
   * STEP 1
   * Find the best worksheet.
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
      'Please upload a valid RD Personal Ledger Excel file.'
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

      isValidPayment:
        hasPositiveReceipt &&
        !isSummaryText,
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
      determineDailySchemeAmount(
        rawTransactions,
        roundedTotalDeposited,
        tenureDays
      );

    const calculation =
      calculateDailyRD(
        rawTransactions,
        roundedTotalDeposited,
        dailySchemeAmount,
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
        calculation.dailySchemeAmount,

      profitEligibleAmount:
        calculation.profitEligibleAmount,

      nonProfitAmount:
        calculation.nonProfitAmount,

      normalizedDailyAmount:
        calculation.normalizedDailyAmount,

      totalInterest:
        calculation.totalInterest,

      maturityAmount:
        calculation.maturityAmount,

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
     * Existing Monthly RD
     * progressive calculation.
     */
    let accumulatedInterest =
      0;

    monthlyDeposits.forEach(
      (
        deposit,
        index
      ) => {
        const monthsRemaining =
          Math.max(
            1,
            tenureMonths -
              index
          );

        accumulatedInterest +=
          deposit.amount *
          monthlyRate *
          monthsRemaining;
      }
    );

    const totalInterest =
      roundMoney(
        accumulatedInterest
      );

    const maturityAmount =
      roundMoney(
        roundedTotalDeposited +
          totalInterest
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