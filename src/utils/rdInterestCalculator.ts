/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RDSchemeType = 'Daily RD' | 'Monthly RD';

export interface RDDurationOption {
  value: number; // days for Daily RD, months for Monthly RD
  label: string;
  defaultRate: number; // e.g. 12, 12.5, 13
  years: number;
}

export const DAILY_RD_SUPPORTED_DURATIONS: RDDurationOption[] = [
  { value: 365, label: '365 Days (1 Year)', defaultRate: 12.0, years: 1 },
  { value: 730, label: '730 Days (2 Years)', defaultRate: 12.5, years: 2 },
  { value: 1095, label: '1,095 Days (3 Years)', defaultRate: 13.0, years: 3 },
];

export const MONTHLY_RD_SUPPORTED_DURATIONS: RDDurationOption[] = [
  { value: 12, label: '12 Months (1 Year)', defaultRate: 12.0, years: 1 },
  { value: 24, label: '24 Months (2 Years)', defaultRate: 12.0, years: 2 },
  { value: 36, label: '36 Months (3 Years)', defaultRate: 12.0, years: 3 },
];

export const CONFIGURABLE_MAX_INTEREST_RATE = 100.0;
export const CONFIGURABLE_MIN_INTEREST_RATE = 0.0;
export const RATE_ADJUSTMENT_STEP = 0.1; // 0.1 percentage points

export interface RDCalculationResult {
  schemeType: RDSchemeType;
  duration: number; // days or months
  durationUnit: 'days' | 'months';
  installmentAmount: number;
  annualInterestRate: number; // percentage, e.g. 12.5
  totalDeposited: number;
  totalInterest: number;
  maturityAmount: number;
  rawMaturityAmount?: number;
  rawTotalInterest?: number;
  isValid: boolean;
  errorMessage?: string;
  formulaDescription: string;
}

export interface RDBreakdownRow {
  periodIndex: number;
  label: string;
  deposit: number;
  balance: number;
  periodInterest: number;
  cumulativeDeposit: number;
  cumulativeInterest: number;
  cumulativeTotal: number;
}

export interface RDBreakdownPageResult {
  rows: RDBreakdownRow[];
  totalRows: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
}

/**
 * Rounds monetary amounts to 2 decimal places with financial precision.
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
 * Returns the default annual interest rate associated with a given duration and scheme.
 *
 * Daily RD:
 *   365 days  -> 12.0%
 *   730 days  -> 12.5%
 *   1095 days -> 13.0%
 *
 * Monthly RD:
 *   12 months -> 12.0%
 *   24 months -> 12.0% (default 12%, does not auto-change to 12.5% or 13%)
 *   36 months -> 12.0% (default 12%, does not auto-change to 12.5% or 13%)
 */
export function getDefaultRateForDuration(
  schemeType: RDSchemeType,
  duration: number
): number {
  if (schemeType === 'Daily RD') {
    if (duration <= 365) return 12.0;
    if (duration <= 730) return 12.5;
    return 13.0;
  } else {
    // Keep 12% as the default for all supported Monthly RD durations unless user changes it
    return 12.0;
  }
}

/**
 * Adjusts interest rate by a configurable step (default 0.1 percentage points).
 * Prevents floating point inaccuracy artifacts (e.g. 12.0 + 0.1 becoming 12.100000000000001).
 */
export function adjustRate(
  currentRate: number,
  delta: number,
  maxRate: number = CONFIGURABLE_MAX_INTEREST_RATE,
  minRate: number = CONFIGURABLE_MIN_INTEREST_RATE
): number {
  const safeCurrent = Number.isFinite(currentRate) ? currentRate : 12.0;
  const newRate = Math.round((safeCurrent + delta) * 10) / 10;
  return Math.max(minRate, Math.min(maxRate, newRate));
}

/**
 * Validates a user-entered interest rate string or number.
 */
export function validateRateInput(
  input: string | number,
  maxRate: number = CONFIGURABLE_MAX_INTEREST_RATE,
  minRate: number = CONFIGURABLE_MIN_INTEREST_RATE
): { isValid: boolean; value: number; error?: string } {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed === '') {
      return { isValid: false, value: 0, error: 'Interest rate cannot be empty.' };
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return { isValid: false, value: 0, error: 'Please enter a valid numeric interest rate.' };
    }
    if (parsed < minRate) {
      return { isValid: false, value: parsed, error: `Interest rate cannot be less than ${minRate}%.` };
    }
    if (parsed > maxRate) {
      return { isValid: false, value: parsed, error: `Interest rate cannot exceed ${maxRate}%.` };
    }
    return { isValid: true, value: parsed };
  }

  if (!Number.isFinite(input)) {
    return { isValid: false, value: 0, error: 'Please enter a valid numeric interest rate.' };
  }
  if (input < minRate) {
    return { isValid: false, value: input, error: `Interest rate cannot be less than ${minRate}%.` };
  }
  if (input > maxRate) {
    return { isValid: false, value: input, error: `Interest rate cannot exceed ${maxRate}%.` };
  }
  return { isValid: true, value: input };
}

/**
 * Core Daily Recurring Deposit Calculation Engine.
 *
 * Implements the intended daily balance accumulation methodology:
 * For each day d in 1..N:
 *   Cumulative balance on day d: Balance_d = d * dailyAmount
 *   Daily interest on day d: Balance_d * (annualInterestRate / 100) / 365
 *   Total interest = sum_{d=1}^N (d * dailyAmount) * (annualInterestRate / 100) / 365
 *                  = dailyAmount * ((annualInterestRate / 100) / 365) * (N * (N + 1) / 2)
 *
 * Total Deposited = N * dailyAmount
 * Maturity Amount = Total Deposited + Total Interest
 *
 * Floating-point calculations use full precision internally.
 */
export function calculateDailyRDMaturity(
  days: number,
  dailyAmount: number,
  annualInterestRate: number,
  maxRate: number = CONFIGURABLE_MAX_INTEREST_RATE
): RDCalculationResult {
  // Input validation
  if (!Number.isFinite(days) || !Number.isFinite(dailyAmount) || !Number.isFinite(annualInterestRate)) {
    return {
      schemeType: 'Daily RD',
      duration: 0,
      durationUnit: 'days',
      installmentAmount: 0,
      annualInterestRate: 0,
      totalDeposited: 0,
      totalInterest: 0,
      maturityAmount: 0,
      isValid: false,
      errorMessage: 'Please enter valid numeric values for all parameters.',
      formulaDescription: '',
    };
  }

  const cleanDays = Math.floor(days);
  const cleanAmount = dailyAmount;
  const cleanRate = annualInterestRate;

  if (cleanDays <= 0) {
    return {
      schemeType: 'Daily RD',
      duration: cleanDays,
      durationUnit: 'days',
      installmentAmount: cleanAmount,
      annualInterestRate: cleanRate,
      totalDeposited: 0,
      totalInterest: 0,
      maturityAmount: 0,
      isValid: false,
      errorMessage: 'Duration in days must be greater than 0.',
      formulaDescription: '',
    };
  }

  if (cleanAmount <= 0) {
    return {
      schemeType: 'Daily RD',
      duration: cleanDays,
      durationUnit: 'days',
      installmentAmount: cleanAmount,
      annualInterestRate: cleanRate,
      totalDeposited: 0,
      totalInterest: 0,
      maturityAmount: 0,
      isValid: false,
      errorMessage: 'Daily installment amount must be greater than ₹0.',
      formulaDescription: '',
    };
  }

  if (cleanRate < 0) {
    return {
      schemeType: 'Daily RD',
      duration: cleanDays,
      durationUnit: 'days',
      installmentAmount: cleanAmount,
      annualInterestRate: cleanRate,
      totalDeposited: 0,
      totalInterest: 0,
      maturityAmount: 0,
      isValid: false,
      errorMessage: 'Annual interest rate cannot be negative.',
      formulaDescription: '',
    };
  }

  if (cleanRate > maxRate) {
    return {
      schemeType: 'Daily RD',
      duration: cleanDays,
      durationUnit: 'days',
      installmentAmount: cleanAmount,
      annualInterestRate: cleanRate,
      totalDeposited: 0,
      totalInterest: 0,
      maturityAmount: 0,
      isValid: false,
      errorMessage: `Annual interest rate cannot exceed ${maxRate}%.`,
      formulaDescription: '',
    };
  }

  // Total Deposited
  const totalDeposited = cleanDays * cleanAmount;

  // Company Daily RD Excel Methodology (Reference: CALCULATION OF RD - 2026 FEB 04 - 12%(2).xlsx, sheet DALIY):
  // D2 = duration in days, D3 = installment amount, D4 = annual interest rate.
  // First day (row 7):
  //   B7 = D3
  //   C7 = D4 / D2
  // Second day (row 8):
  //   B8 = B7 + C7
  //   C8 = (B8 * D4%) / 365
  //   D8 = B8 + C8 + D3
  // Day 3 to Day N (row 9 to row 7 + D2 - 1):
  //   For day i from 3 to N:
  //   B_i = D_{i-1}
  //   C_i = (B_i * (D4 / 100)) / 365
  //   D_i = B_i + C_i + D3
  // Final maturity is D at day N.
  let B = cleanAmount;
  let C = cleanDays > 0 ? (cleanRate / cleanDays) : 0;
  let D = B;

  if (cleanDays === 1) {
    D = B + C;
  } else if (cleanDays >= 2) {
    for (let d = 2; d <= cleanDays; d++) {
      B = (d === 2) ? (cleanAmount + C) : D;
      C = (B * (cleanRate / 100)) / 365;
      D = B + C + cleanAmount;
    }
  }

  const rawMaturityAmount = D;
  const rawTotalInterest = D - totalDeposited;

  return {
    schemeType: 'Daily RD',
    duration: cleanDays,
    durationUnit: 'days',
    installmentAmount: cleanAmount,
    annualInterestRate: cleanRate,
    totalDeposited: roundMoney(totalDeposited),
    totalInterest: roundMoney(rawTotalInterest),
    maturityAmount: roundMoney(rawMaturityAmount),
    rawMaturityAmount,
    rawTotalInterest,
    isValid: true,
    formulaDescription: `Company Excel Daily RD (DALIY sheet): ₹${cleanAmount}/day for ${cleanDays} days at ${cleanRate.toFixed(2)}% p.a.`,
  };
}

/**
 * Core Monthly Recurring Deposit Calculation Engine.
 *
 * Implements the intended monthly balance accumulation methodology:
 * For each month m in 1..n:
 *   Cumulative balance on month m: Balance_m = m * monthlyAmount
 *   Monthly interest on month m: Balance_m * (annualInterestRate / 100) / 12
 *   Total interest = sum_{m=1}^n (m * monthlyAmount) * (annualInterestRate / 100) / 12
 *                  = monthlyAmount * ((annualInterestRate / 100) / 12) * (n * (n + 1) / 2)
 *
 * Total Deposited = n * monthlyAmount
 * Maturity Amount = Total Deposited + Total Interest
 *
 * Floating-point calculations use full precision internally.
 */
export function calculateMonthlyRDMaturity(
  months: number,
  monthlyAmount: number,
  annualInterestRate: number,
  maxRate: number = CONFIGURABLE_MAX_INTEREST_RATE
): RDCalculationResult {
  // Input validation
  if (!Number.isFinite(months) || !Number.isFinite(monthlyAmount) || !Number.isFinite(annualInterestRate)) {
    return {
      schemeType: 'Monthly RD',
      duration: 0,
      durationUnit: 'months',
      installmentAmount: 0,
      annualInterestRate: 0,
      totalDeposited: 0,
      totalInterest: 0,
      maturityAmount: 0,
      isValid: false,
      errorMessage: 'Please enter valid numeric values for all parameters.',
      formulaDescription: '',
    };
  }

  const cleanMonths = Math.floor(months);
  const cleanAmount = monthlyAmount;
  const cleanRate = annualInterestRate;

  if (cleanMonths <= 0) {
    return {
      schemeType: 'Monthly RD',
      duration: cleanMonths,
      durationUnit: 'months',
      installmentAmount: cleanAmount,
      annualInterestRate: cleanRate,
      totalDeposited: 0,
      totalInterest: 0,
      maturityAmount: 0,
      isValid: false,
      errorMessage: 'Duration in months must be greater than 0.',
      formulaDescription: '',
    };
  }

  if (cleanAmount <= 0) {
    return {
      schemeType: 'Monthly RD',
      duration: cleanMonths,
      durationUnit: 'months',
      installmentAmount: cleanAmount,
      annualInterestRate: cleanRate,
      totalDeposited: 0,
      totalInterest: 0,
      maturityAmount: 0,
      isValid: false,
      errorMessage: 'Monthly installment amount must be greater than ₹0.',
      formulaDescription: '',
    };
  }

  if (cleanRate < 0) {
    return {
      schemeType: 'Monthly RD',
      duration: cleanMonths,
      durationUnit: 'months',
      installmentAmount: cleanAmount,
      annualInterestRate: cleanRate,
      totalDeposited: 0,
      totalInterest: 0,
      maturityAmount: 0,
      isValid: false,
      errorMessage: 'Annual interest rate cannot be negative.',
      formulaDescription: '',
    };
  }

  if (cleanRate > maxRate) {
    return {
      schemeType: 'Monthly RD',
      duration: cleanMonths,
      durationUnit: 'months',
      installmentAmount: cleanAmount,
      annualInterestRate: cleanRate,
      totalDeposited: 0,
      totalInterest: 0,
      maturityAmount: 0,
      isValid: false,
      errorMessage: `Annual interest rate cannot exceed ${maxRate}%.`,
      formulaDescription: '',
    };
  }

  // Total Deposited
  const totalDeposited = cleanMonths * cleanAmount;

  // Fixed-installment Monthly RD (Workbook reference methodology):
  // Start with a zero balance.
  // For each installment period, add the installment first,
  // then calculate monthly interest on the resulting balance and add the interest.
  const monthlyRate = (cleanRate / 100) / 12;
  let balance = 0;

  for (let m = 1; m <= cleanMonths; m++) {
    balance += cleanAmount;
    const interest = balance * monthlyRate;
    balance += interest;
  }

  const rawMaturityAmount = balance;
  const rawTotalInterest = balance - totalDeposited;

  return {
    schemeType: 'Monthly RD',
    duration: cleanMonths,
    durationUnit: 'months',
    installmentAmount: cleanAmount,
    annualInterestRate: cleanRate,
    totalDeposited: roundMoney(totalDeposited),
    totalInterest: roundMoney(rawTotalInterest),
    maturityAmount: roundMoney(rawMaturityAmount),
    rawMaturityAmount,
    rawTotalInterest,
    isValid: true,
    formulaDescription: `Monthly compounding: ₹${cleanAmount}/month for ${cleanMonths} months at ${(cleanRate / 12).toFixed(4)}% per month`,
  };
}

/**
 * Returns paginated breakdown rows for Daily RD.
 */
export function getDailyRDBreakdownPage(
  days: number,
  dailyAmount: number,
  annualInterestRate: number,
  page: number = 1,
  pageSize: number = 25
): RDBreakdownPageResult {
  const cleanDays = Math.max(0, Math.floor(days));
  const cleanAmount = Math.max(0, dailyAmount);
  const cleanRate = Math.max(0, annualInterestRate);

  if (cleanDays <= 0 || cleanAmount <= 0) {
    return {
      rows: [],
      totalRows: 0,
      currentPage: 1,
      totalPages: 1,
      pageSize,
    };
  }

  const safePageSize = Math.max(1, Math.min(pageSize, 2000));
  const totalPages = Math.ceil(cleanDays / safePageSize);
  const safePage = Math.max(1, Math.min(page, totalPages));

  const startDay = (safePage - 1) * safePageSize + 1;
  const endDay = Math.min(cleanDays, safePage * safePageSize);

  const rows: RDBreakdownRow[] = [];

  let B = cleanAmount;
  let C = cleanDays > 0 ? cleanRate / cleanDays : 0;
  let D = cleanDays === 1 ? B + C : 0;

  for (let d = 1; d <= cleanDays; d++) {
    if (d === 1) {
      const balanceBeforeInterest = B;
      const periodInterest = C;
      const closingBalance = B + C;
      const cumulativeDeposit = cleanAmount;
      const cumulativeInterest = periodInterest;

      if (d >= startDay && d <= endDay) {
        rows.push({
          periodIndex: 1,
          label: 'Day 1',
          deposit: cleanAmount,
          balance: roundMoney(balanceBeforeInterest),
          periodInterest: roundMoney(periodInterest),
          cumulativeDeposit: roundMoney(cumulativeDeposit),
          cumulativeInterest: roundMoney(cumulativeInterest),
          cumulativeTotal: roundMoney(closingBalance),
        });
      }
    } else {
      B = (d === 2) ? (cleanAmount + C) : D;
      C = (B * (cleanRate / 100)) / 365;
      D = B + C + cleanAmount;
      const cumulativeDeposit = d * cleanAmount;
      const cumulativeInterest = D - cumulativeDeposit;

      if (d >= startDay && d <= endDay) {
        rows.push({
          periodIndex: d,
          label: `Day ${d}`,
          deposit: cleanAmount,
          balance: roundMoney(B),
          periodInterest: roundMoney(C),
          cumulativeDeposit: roundMoney(cumulativeDeposit),
          cumulativeInterest: roundMoney(cumulativeInterest),
          cumulativeTotal: roundMoney(D),
        });
      }
    }
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
 * Returns breakdown rows for Monthly RD (typically 12, 24, 36 months).
 */
export function getMonthlyRDBreakdown(
  months: number,
  monthlyAmount: number,
  annualInterestRate: number
): RDBreakdownRow[] {
  const cleanMonths = Math.max(0, Math.floor(months));
  const cleanAmount = Math.max(0, monthlyAmount);
  const cleanRate = Math.max(0, annualInterestRate);

  if (cleanMonths <= 0 || cleanAmount <= 0) {
    return [];
  }

  const monthlyRate = (cleanRate / 100) / 12;
  const rows: RDBreakdownRow[] = [];

  let balance = 0;
  let cumulativeDeposit = 0;

  for (let m = 1; m <= cleanMonths; m++) {
    const balanceBeforeInterest = balance + cleanAmount;
    const periodInterest = balanceBeforeInterest * monthlyRate;
    balance = balanceBeforeInterest + periodInterest;
    cumulativeDeposit += cleanAmount;
    const cumulativeInterest = balance - cumulativeDeposit;

    rows.push({
      periodIndex: m,
      label: `Month ${m}`,
      deposit: cleanAmount,
      balance: roundMoney(balanceBeforeInterest),
      periodInterest: roundMoney(periodInterest),
      cumulativeDeposit: roundMoney(cumulativeDeposit),
      cumulativeInterest: roundMoney(cumulativeInterest),
      cumulativeTotal: roundMoney(balance),
    });
  }

  return rows;
}

/**
 * Generates CSV content of the calculation schedule for download.
 */
export function generateRDCSVReport(
  schemeType: RDSchemeType,
  duration: number,
  installmentAmount: number,
  annualInterestRate: number
): string {
  const cleanDuration = Math.max(0, Math.floor(duration));
  const cleanAmount = Math.max(0, installmentAmount);
  const cleanRate = Math.max(0, annualInterestRate);

  const isDaily = schemeType === 'Daily RD';
  const unitName = isDaily ? 'Day' : 'Month';

  const headers = [
    unitName,
    `Installment Amount (Rs)`,
    `Balance Before Interest (Rs)`,
    `Interest Earned (Rs)`,
    `Cumulative Deposited (Rs)`,
    `Cumulative Total (Rs)`,
  ];

  const lines: string[] = [
    `RD Maturity Report - ${schemeType}`,
    `Duration,${cleanDuration} ${unitName}s`,
    `Installment Amount,Rs ${cleanAmount.toFixed(2)}`,
    `Annual Interest Rate,${cleanRate.toFixed(2)}% per annum`,
    '',
    headers.join(','),
  ];

  if (isDaily) {
    let B = cleanAmount;
    let C = cleanDuration > 0 ? (cleanRate / cleanDuration) : 0;
    let D = cleanDuration === 1 ? (B + C) : 0;

    for (let i = 1; i <= cleanDuration; i++) {
      if (i === 1) {
        const balanceBefore = B;
        const periodInterest = C;
        const closingBalance = B + C;
        const cumulativeDeposit = cleanAmount;

        lines.push(
          [
            'Day 1',
            cleanAmount.toFixed(2),
            balanceBefore.toFixed(2),
            periodInterest.toFixed(2),
            cumulativeDeposit.toFixed(2),
            closingBalance.toFixed(2),
          ].join(',')
        );
      } else {
        B = (i === 2) ? (cleanAmount + C) : D;
        C = (B * (cleanRate / 100)) / 365;
        D = B + C + cleanAmount;
        const cumulativeDeposit = i * cleanAmount;

        lines.push(
          [
            `Day ${i}`,
            cleanAmount.toFixed(2),
            B.toFixed(2),
            C.toFixed(2),
            cumulativeDeposit.toFixed(2),
            D.toFixed(2),
          ].join(',')
        );
      }
    }
  } else {
    const monthlyRate = (cleanRate / 100) / 12;
    let balance = 0;
    let cumulativeDeposit = 0;

    for (let m = 1; m <= cleanDuration; m++) {
      const balanceBefore = balance + cleanAmount;
      const periodInterest = balanceBefore * monthlyRate;
      balance = balanceBefore + periodInterest;
      cumulativeDeposit += cleanAmount;

      lines.push(
        [
          `Month ${m}`,
          cleanAmount.toFixed(2),
          balanceBefore.toFixed(2),
          periodInterest.toFixed(2),
          cumulativeDeposit.toFixed(2),
          balance.toFixed(2),
        ].join(',')
      );
    }
  }

  return lines.join('\n');
}
