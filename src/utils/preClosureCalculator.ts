/**
 * Pre-Closure Calculator
 *
 * IMPORTANT:
 * The existing pre-closure calculation is intentionally preserved.
 *
 * Existing calculation:
 *
 *   Pre-Closure Return =
 *     Total Deposited × Applicable Pre-Closure Rate / 100
 *
 *   Final Payable =
 *     Total Deposited + Pre-Closure Return
 *
 * This file additionally calculates the ACTUAL LEDGER INTEREST
 * accumulated from the ledger's running balance until the
 * selected pre-closure date.
 */

import { RDAccountData, LedgerTransactionRow } from '../types';
import {
  getApplicablePreClosureRate,
  PreClosureScheme,
} from './preClosureRates';

// ============================================================================
// RESULT TYPE
// ============================================================================

export interface PreClosureCalculationResult {
  scheme: PreClosureScheme;
  originalTenureYears: number;
  closureDate: string;
  closureMonth: number;

  // Existing pre-closure calculation
  applicableRate: number;
  totalDeposited: number;
  returnAmount: number;
  finalPayable: number;

  // NEW: actual ledger interest
  ledgerInterestRate: number;
  accurateInterestTillClosure: number;
  ledgerValueTillClosure: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function roundAmount(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseDateValue(
  value: unknown
): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate()
    );
  }

  if (typeof value !== 'string') {
    return null;
  }

  const text = value.trim();

  if (!text) {
    return null;
  }

  // --------------------------------------------------------------------------
  // DD/MM/YYYY
  // --------------------------------------------------------------------------

  let match = text.match(
    /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/
  );

  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(match[3]);

    const date = new Date(
      year,
      month,
      day
    );

    if (
      date.getFullYear() === year &&
      date.getMonth() === month &&
      date.getDate() === day
    ) {
      return date;
    }
  }

  // --------------------------------------------------------------------------
  // YYYY-MM-DD
  // --------------------------------------------------------------------------

  match = text.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/
  );

  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);

    const date = new Date(
      year,
      month,
      day
    );

    if (
      date.getFullYear() === year &&
      date.getMonth() === month &&
      date.getDate() === day
    ) {
      return date;
    }
  }

  // --------------------------------------------------------------------------
  // Fallback
  // --------------------------------------------------------------------------

  const fallback = new Date(text);

  if (!Number.isNaN(fallback.getTime())) {
    return new Date(
      fallback.getFullYear(),
      fallback.getMonth(),
      fallback.getDate()
    );
  }

  return null;
}

function dateToKey(date: Date): string {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function addDays(
  date: Date,
  days: number
): Date {
  const result = new Date(date);

  result.setDate(
    result.getDate() + days
  );

  return result;
}

function differenceInCalendarDays(
  from: Date,
  to: Date
): number {
  const fromUtc = Date.UTC(
    from.getFullYear(),
    from.getMonth(),
    from.getDate()
  );

  const toUtc = Date.UTC(
    to.getFullYear(),
    to.getMonth(),
    to.getDate()
  );

  return Math.round(
    (toUtc - fromUtc) /
      (1000 * 60 * 60 * 24)
  );
}

function parseMoney(
  value: unknown
): number {
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  if (typeof value !== 'string') {
    return 0;
  }

  const cleaned = value
    .replace(/₹/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();

  if (!cleaned) {
    return 0;
  }

  const number = Number(cleaned);

  return Number.isFinite(number)
    ? number
    : 0;
}

// ============================================================================
// GET TRANSACTION DATE
// ============================================================================

function getTransactionDate(
  transaction: LedgerTransactionRow
): Date | null {
  if (
    transaction.depositDateObj instanceof Date &&
    !Number.isNaN(
      transaction.depositDateObj.getTime()
    )
  ) {
    return new Date(
      transaction.depositDateObj.getFullYear(),
      transaction.depositDateObj.getMonth(),
      transaction.depositDateObj.getDate()
    );
  }

  return parseDateValue(
    transaction.date
  );
}

// ============================================================================
// GET TRANSACTION BALANCE
// ============================================================================

function getTransactionBalance(
  transaction: LedgerTransactionRow
): number | null {
  const balance = parseMoney(
    transaction.balance
  );

  if (
    Number.isFinite(balance) &&
    balance > 0
  ) {
    return balance;
  }

  return null;
}

// ============================================================================
// CALCULATE ACTUAL LEDGER INTEREST
//
// Formula:
//
//   Daily Interest =
//     Running Balance × Annual Rate × Days / 36500
//
// The calculation walks through the actual ledger dates.
//
// If there is a gap between two transaction dates, the previous
// running balance is used for the missing days.
//
// Example:
//
// 10 May   balance ₹200
// 11 May   balance ₹400
// 12 May   balance ₹600
//
// Interest is calculated using the balance applicable to each day.
//
// ============================================================================

export function calculateAccurateLedgerInterest(
  data: RDAccountData,
  closureDateInput: string | Date,
  annualRateOverride?: number
): number {
  const closureDate =
    parseDateValue(
      closureDateInput
    );

  if (!closureDate) {
    return 0;
  }

  // --------------------------------------------------------------------------
  // Determine ledger interest rate.
  //
  // Priority:
  // 1. Explicit override
  // 2. data.annualRate
  // 3. data.selectedInterestRate
  // 4. data.interestRate
  // 5. 0
  // --------------------------------------------------------------------------

  let annualRate = 0;

  if (
    typeof annualRateOverride === 'number' &&
    Number.isFinite(annualRateOverride)
  ) {
    annualRate = annualRateOverride;
  } else if (
    typeof data.annualRate === 'number' &&
    Number.isFinite(data.annualRate)
  ) {
    annualRate = data.annualRate;
  } else if (
    typeof data.selectedInterestRate === 'number' &&
    Number.isFinite(data.selectedInterestRate)
  ) {
    annualRate =
      data.selectedInterestRate;
  } else if (data.interestRate) {
    annualRate = parseMoney(
      data.interestRate
    );
  }

  if (
    !Number.isFinite(annualRate) ||
    annualRate <= 0
  ) {
    return 0;
  }

  // --------------------------------------------------------------------------
  // Get valid dated transactions.
  // --------------------------------------------------------------------------

  const datedTransactions = (
    data.transactions || []
  )
    .map((transaction) => ({
      transaction,
      date: getTransactionDate(
        transaction
      ),
    }))
    .filter(
      (
        item
      ): item is {
        transaction: LedgerTransactionRow;
        date: Date;
      } => item.date !== null
    )
    .filter(
      (item) =>
        item.date.getTime() <=
        closureDate.getTime()
    )
    .sort(
      (a, b) =>
        a.date.getTime() -
        b.date.getTime()
    );

  if (datedTransactions.length === 0) {
    return 0;
  }

  // --------------------------------------------------------------------------
  // We create a map of all ledger dates.
  //
  // When a transaction has a balance column, we use that exact balance.
  // Otherwise we build the running balance from receipt/deposit values.
  // --------------------------------------------------------------------------

  const balanceByDate =
    new Map<string, number>();

  let runningBalance = 0;

  for (const item of datedTransactions) {
    const transaction =
      item.transaction;

    const dateKey =
      dateToKey(item.date);

    const explicitBalance =
      getTransactionBalance(
        transaction
      );

    if (
      explicitBalance !== null
    ) {
      runningBalance =
        explicitBalance;
    } else {
      const credit =
        parseMoney(
          transaction.receiptCredit
        );

      if (
        transaction.isValidPayment &&
        credit > 0
      ) {
        runningBalance += credit;
      }
    }

    balanceByDate.set(
      dateKey,
      Math.max(
        0,
        runningBalance
      )
    );
  }

  // --------------------------------------------------------------------------
  // First ledger date.
  // --------------------------------------------------------------------------

  const firstDate =
    datedTransactions[0].date;

  if (
    closureDate.getTime() <
    firstDate.getTime()
  ) {
    return 0;
  }

  // --------------------------------------------------------------------------
  // Walk through every calendar day.
  //
  // The balance for a day is the latest ledger balance on or before
  // that day.
  // --------------------------------------------------------------------------

  let interest = 0;

  let currentBalance = 0;

  let currentDate =
    new Date(firstDate);

  while (
    currentDate.getTime() <=
    closureDate.getTime()
  ) {
    const key =
      dateToKey(currentDate);

    if (
      balanceByDate.has(key)
    ) {
      currentBalance =
        balanceByDate.get(key) || 0;
    }

    if (currentBalance > 0) {
      const dailyInterest =
        (
          currentBalance *
          annualRate
        ) / 36500;

      interest += dailyInterest;
    }

    currentDate =
      addDays(
        currentDate,
        1
      );
  }

  return roundAmount(
    interest
  );
}

// ============================================================================
// CALCULATE PRE-CLOSURE
//
// EXISTING LOGIC IS PRESERVED.
//
// ============================================================================

export function calculatePreClosure(
  data: RDAccountData,
  scheme: PreClosureScheme,
  originalTenureYears: number,
  closureDateInput: string
): PreClosureCalculationResult {
  const closureDate =
    parseDateValue(
      closureDateInput
    );

  if (!closureDate) {
    throw new Error(
      'Please select a valid pre-closure date.'
    );
  }

  // --------------------------------------------------------------------------
  // Opening date
  // --------------------------------------------------------------------------

  const openingDate =
    parseDateValue(
      data.openingDate || ''
    );

  if (!openingDate) {
    throw new Error(
      'Opening date could not be determined from the ledger.'
    );
  }

  // --------------------------------------------------------------------------
  // Closure must be after opening.
  // --------------------------------------------------------------------------

  if (
    closureDate.getTime() <=
    openingDate.getTime()
  ) {
    throw new Error(
      'Pre-closure date must be after the RD opening date.'
    );
  }

  // --------------------------------------------------------------------------
  // Original maturity date
  // --------------------------------------------------------------------------

  let maturityDate: Date;

  if (data.maturityDate) {
    const parsedMaturity =
      parseDateValue(
        data.maturityDate
      );

    if (parsedMaturity) {
      maturityDate =
        parsedMaturity;
    } else {
      maturityDate =
        new Date(openingDate);
      maturityDate.setFullYear(
        maturityDate.getFullYear() +
          originalTenureYears
      );
    }
  } else {
    maturityDate =
      new Date(openingDate);

    maturityDate.setFullYear(
      maturityDate.getFullYear() +
        originalTenureYears
    );
  }

  // --------------------------------------------------------------------------
  // Closure must be before original maturity.
  // --------------------------------------------------------------------------

  if (
    closureDate.getTime() >=
    maturityDate.getTime()
  ) {
    throw new Error(
      'Pre-closure date must be before the original maturity date.'
    );
  }

  // --------------------------------------------------------------------------
  // Completed calendar months.
  // --------------------------------------------------------------------------

  let completedMonths =
    (
      closureDate.getFullYear() -
        openingDate.getFullYear()
    ) *
      12 +
    (
      closureDate.getMonth() -
        openingDate.getMonth()
    );

  if (
    closureDate.getDate() <
    openingDate.getDate()
  ) {
    completedMonths -= 1;
  }

  completedMonths =
    Math.max(
      0,
      completedMonths
    );

  // Closure month is the month currently being entered.
  const closureMonth =
    completedMonths + 1;

  // --------------------------------------------------------------------------
  // EXISTING RATE TABLE
  // --------------------------------------------------------------------------

  const applicableRate =
    getApplicablePreClosureRate(
      scheme,
      originalTenureYears,
      closureMonth
    );

  // --------------------------------------------------------------------------
  // EXISTING PRE-CLOSURE DEPOSIT CALCULATION
  //
  // Only payments actually made up to the closure date count.
  // --------------------------------------------------------------------------

  const totalDeposited =
    roundAmount(
      (data.transactions || [])
        .filter(
          (transaction) => {
            const transactionDate =
              getTransactionDate(
                transaction
              );

            return (
              transactionDate !== null &&
              transactionDate.getTime() <=
                closureDate.getTime() &&
              transaction.isValidPayment
            );
          }
        )
        .reduce(
          (sum, transaction) =>
            sum +
            Math.max(
              0,
              parseMoney(
                transaction.receiptCredit
              )
            ),
          0
        )
    );

  // --------------------------------------------------------------------------
  // EXISTING PRE-CLOSURE FORMULA
  //
  // DO NOT CHANGE.
  //
  // Pre-Closure Return =
  // Total Deposited × Applicable Rate / 100
  //
  // Final Payable =
  // Total Deposited + Pre-Closure Return
  // --------------------------------------------------------------------------

  const returnAmount =
    roundAmount(
      totalDeposited *
        (applicableRate / 100)
    );

  const finalPayable =
    roundAmount(
      totalDeposited +
        returnAmount
    );

  // --------------------------------------------------------------------------
  // NEW INFORMATIONAL CALCULATION
  //
  // This DOES NOT affect finalPayable.
  // --------------------------------------------------------------------------

  const accurateInterestTillClosure =
    calculateAccurateLedgerInterest(
      data,
      closureDate,
      undefined
    );

  const ledgerInterestRate =
    (
      typeof data.annualRate ===
        'number' &&
      Number.isFinite(
        data.annualRate
      )
        ? data.annualRate
        : typeof data.selectedInterestRate ===
              'number' &&
            Number.isFinite(
              data.selectedInterestRate
            )
          ? data.selectedInterestRate
          : 0
    );

  const ledgerValueTillClosure =
    roundAmount(
      totalDeposited +
        accurateInterestTillClosure
    );

  return {
    scheme,
    originalTenureYears,
    closureDate: closureDateInput,
    closureMonth,
    applicableRate,
    totalDeposited,
    returnAmount,
    finalPayable,

    // NEW
    ledgerInterestRate,
    accurateInterestTillClosure,
    ledgerValueTillClosure,
  };
}