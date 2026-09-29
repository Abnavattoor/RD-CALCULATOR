/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DailyRDInterestResult {
  days: number;
  dailyAmount: number;
  annualInterestRate: number;
  totalDeposited: number;
  totalInterest: number;
  maturityAmount: number;
  isValid: boolean;
  errorMessage?: string;
}

export interface DailyRDBreakdownRow {
  day: number;
  deposit: number;
  remainingDays: number;
  interest: number;
  cumulativeDeposit: number;
  cumulativeInterest: number;
}

export interface BreakdownPageResult {
  rows: DailyRDBreakdownRow[];
  totalRows: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
}

/**
 * Rounds monetary amounts to 2 decimal places without cumulative error.
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Formats a numeric value into INR currency format (e.g. ₹36,500.00).
 */
export function formatCurrency(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeValue);
}

/**
 * Calculates Recurring Daily Deposit interest and maturity amount.
 *
 * This is a RECURRING DAILY DEPOSIT.
 * Rather than calculating interest over the entire lump sum (Total Deposit × Rate × Days / 365),
 * interest is calculated for each daily installment according to how many days that installment
 * remained invested:
 *
 * Day 1: Deposit = Daily Amount, Investment duration = Number of Days - 1
 * Day 2: Deposit = Daily Amount, Investment duration = Number of Days - 2
 * ...
 * Day N: Deposit = Daily Amount, Investment duration = 0
 *
 * Simple interest per installment:
 * Interest = Daily Amount × (Annual Interest Rate / 100) × (Remaining Days / 365)
 *
 * Total Interest is calculated with full precision:
 * Sum of remaining days = (Days × (Days - 1)) / 2
 * Total Interest = (Daily Amount × (Annual Interest Rate / 100) / 365) × ((Days × (Days - 1)) / 2)
 * Maturity Value = Total Deposited + Total Interest
 *
 * @param days Number of days (positive integer)
 * @param dailyAmount Fixed daily deposit amount in ₹ (positive number)
 * @param annualInterestRate Annual interest rate percentage (e.g. 12 for 12%)
 */
export function calculateDailyRDInterest(
  days: number,
  dailyAmount: number,
  annualInterestRate: number
): DailyRDInterestResult {
  // Guard against invalid inputs
  if (
    !Number.isFinite(days) ||
    !Number.isFinite(dailyAmount) ||
    !Number.isFinite(annualInterestRate)
  ) {
    return {
      days: 0,
      dailyAmount: 0,
      annualInterestRate: 0,
      totalDeposited: 0,
      totalInterest: 0,
      maturityAmount: 0,
      isValid: false,
      errorMessage: 'Please enter valid numeric values.',
    };
  }

  const cleanDays = Math.floor(days);
  const cleanDailyAmount = dailyAmount;
  const cleanRate = annualInterestRate;

  if (cleanDays <= 0) {
    return {
      days: cleanDays,
      dailyAmount: cleanDailyAmount,
      annualInterestRate: cleanRate,
      totalDeposited: 0,
      totalInterest: 0,
      maturityAmount: 0,
      isValid: false,
      errorMessage: 'Number of days must be greater than 0.',
    };
  }

  if (cleanDailyAmount <= 0) {
    return {
      days: cleanDays,
      dailyAmount: cleanDailyAmount,
      annualInterestRate: cleanRate,
      totalDeposited: 0,
      totalInterest: 0,
      maturityAmount: 0,
      isValid: false,
      errorMessage: 'Daily amount must be greater than ₹0.',
    };
  }

  if (cleanRate < 0) {
    return {
      days: cleanDays,
      dailyAmount: cleanDailyAmount,
      annualInterestRate: cleanRate,
      totalDeposited: 0,
      totalInterest: 0,
      maturityAmount: 0,
      isValid: false,
      errorMessage: 'Annual interest rate cannot be negative.',
    };
  }

  // 1. Total Deposited
  const totalDeposited = cleanDays * cleanDailyAmount;

  // 2. Interest Earned with full mathematical precision
  // Sum of remaining days: (N - 1) + (N - 2) + ... + 0 = N * (N - 1) / 2
  const sumRemainingDays = (cleanDays * (cleanDays - 1)) / 2;
  const rateFractionPerDay = (cleanRate / 100) / 365;
  const totalInterest = cleanDailyAmount * rateFractionPerDay * sumRemainingDays;

  // 3. Final Maturity Amount
  const maturityAmount = totalDeposited + totalInterest;

  return {
    days: cleanDays,
    dailyAmount: cleanDailyAmount,
    annualInterestRate: cleanRate,
    totalDeposited,
    totalInterest,
    maturityAmount,
    isValid: true,
  };
}

/**
 * Returns a specific page of breakdown rows on-demand.
 * This avoids memory overhead when Number of Days is large (e.g. 1000+ days).
 */
export function getDailyRDBreakdownPage(
  days: number,
  dailyAmount: number,
  annualInterestRate: number,
  page: number = 1,
  pageSize: number = 25
): BreakdownPageResult {
  const cleanDays = Math.max(0, Math.floor(days));
  const cleanDailyAmount = Math.max(0, dailyAmount);
  const cleanRate = Math.max(0, annualInterestRate);

  if (cleanDays <= 0 || cleanDailyAmount <= 0) {
    return {
      rows: [],
      totalRows: 0,
      currentPage: 1,
      totalPages: 1,
      pageSize,
    };
  }

  const safePageSize = Math.max(1, Math.min(pageSize, 200));
  const totalPages = Math.ceil(cleanDays / safePageSize);
  const safePage = Math.max(1, Math.min(page, totalPages));

  const startDay = (safePage - 1) * safePageSize + 1;
  const endDay = Math.min(cleanDays, safePage * safePageSize);

  const rateFractionPerDay = (cleanRate / 100) / 365;

  // Cumulative before this page
  // Before startDay: Day 1 to startDay - 1
  const prevCount = startDay - 1;
  let cumulativeDeposit = prevCount * cleanDailyAmount;
  // Cumulative interest up to startDay - 1:
  // sum_{i=1}^{prevCount} (cleanDailyAmount * rateFraction * (cleanDays - i))
  // = cleanDailyAmount * rateFraction * [prevCount * cleanDays - (prevCount * (prevCount + 1)) / 2]
  let cumulativeInterest = 0;
  if (prevCount > 0) {
    const sumDaysPrev = prevCount * cleanDays - (prevCount * (prevCount + 1)) / 2;
    cumulativeInterest = cleanDailyAmount * rateFractionPerDay * sumDaysPrev;
  }

  const rows: DailyRDBreakdownRow[] = [];

  for (let d = startDay; d <= endDay; d++) {
    const remainingDays = cleanDays - d;
    const interest = cleanDailyAmount * rateFractionPerDay * remainingDays;
    cumulativeDeposit += cleanDailyAmount;
    cumulativeInterest += interest;

    rows.push({
      day: d,
      deposit: cleanDailyAmount,
      remainingDays,
      interest,
      cumulativeDeposit,
      cumulativeInterest,
    });
  }

  return {
    rows,
    totalRows: cleanDays,
    currentPage: safePage,
    totalPages,
    pageSize: safePageSize,
  };
}

/**
 * Generates CSV content of the interest breakdown for download.
 */
export function generateDailyRDBreakdownCSV(
  days: number,
  dailyAmount: number,
  annualInterestRate: number
): string {
  const cleanDays = Math.max(0, Math.floor(days));
  const cleanDailyAmount = Math.max(0, dailyAmount);
  const cleanRate = Math.max(0, annualInterestRate);

  const headers = [
    'Day',
    'Deposit Amount (Rs)',
    'Remaining Days',
    'Interest Earned (Rs)',
    'Cumulative Deposit (Rs)',
    'Cumulative Total (Rs)',
  ];

  const rateFractionPerDay = (cleanRate / 100) / 365;
  const lines: string[] = [headers.join(',')];

  let cumulativeDeposit = 0;
  let cumulativeInterest = 0;

  for (let d = 1; d <= cleanDays; d++) {
    const remainingDays = cleanDays - d;
    const interest = cleanDailyAmount * rateFractionPerDay * remainingDays;
    cumulativeDeposit += cleanDailyAmount;
    cumulativeInterest += interest;

    lines.push(
      [
        d,
        cleanDailyAmount.toFixed(2),
        remainingDays,
        interest.toFixed(2),
        cumulativeDeposit.toFixed(2),
        (cumulativeDeposit + cumulativeInterest).toFixed(2),
      ].join(',')
    );
  }

  return lines.join('\n');
}
