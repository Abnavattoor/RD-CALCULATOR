import { RDAccountData } from '../types';

function roundAmount(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Convert different date formats into a JavaScript Date.
 *
 * Supported examples:
 * 20-08-2025
 * 20/08/2025
 * 20-08-2025
 * 2025-08-20
 * 20 Aug 2025
 */
function parseFlexibleDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate()
    );
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  // -------------------------------------------------------------------------
  // YYYY-MM-DD
  // -------------------------------------------------------------------------

  let match = text.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/
  );

  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
  }

  // -------------------------------------------------------------------------
  // DD-MM-YYYY / DD/MM/YYYY
  // -------------------------------------------------------------------------

  match = text.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/
  );

  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);

    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
  }

  // -------------------------------------------------------------------------
  // DD Mon YYYY
  // -------------------------------------------------------------------------

  const parsedNative = new Date(text);

  if (!Number.isNaN(parsedNative.getTime())) {
    return new Date(
      parsedNative.getFullYear(),
      parsedNative.getMonth(),
      parsedNative.getDate()
    );
  }

  return null;
}

/**
 * Add days without changing the local time.
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add months while keeping the date as close as possible.
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Format a date for internal/debugging purposes.
 */
function formatDate(date: Date | null): string {
  if (!date) {
    return '';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}

/**
 * Recalculate an already parsed RD ledger using a user-selected
 * annual interest rate.
 *
 * Rate is supplied as a percentage:
 *
 * 12 = 12%
 * 15 = 15%
 * 18 = 18%
 */
export function recalculateRDWithRate(
  data: RDAccountData,
  ratePercent: number
): RDAccountData {
  const safeRate =
    Number.isFinite(ratePercent) && ratePercent > 0
      ? ratePercent
      : 12;

  const annualRate = safeRate / 100;

  const totalDeposited = roundAmount(
    data.totalDeposited || 0
  );

  // ===========================================================================
  // DAILY RD
  // ===========================================================================
  //
  // IMPORTANT:
  // Daily RD logic remains exactly as previously established.
  //
  // On each actual payment date:
  //
  //     eligible = min(payment, daily scheme amount)
  //     non-profit = amount above daily scheme amount
  //
  // Missed days are NOT backfilled.
  //
  // ===========================================================================

  if (data.rdType === 'Daily RD') {
    const tenureDays =
      data.tenureDays && data.tenureDays > 0
        ? data.tenureDays
        : 365;

    const profitEligibleAmount = roundAmount(
      data.profitEligibleAmount !== undefined
        ? data.profitEligibleAmount
        : totalDeposited
    );

    const nonProfitAmount = roundAmount(
      data.nonProfitAmount !== undefined
        ? data.nonProfitAmount
        : Math.max(
            0,
            totalDeposited - profitEligibleAmount
          )
    );

    const normalizedDailyAmount =
      profitEligibleAmount / tenureDays;

    let accumulatedInterest = 0;

    for (let day = 1; day <= tenureDays; day++) {
      accumulatedInterest +=
        normalizedDailyAmount *
        annualRate *
        (day / tenureDays);
    }

    const totalInterest = roundAmount(
      accumulatedInterest
    );

    const maturityAmount = roundAmount(
      totalDeposited + totalInterest
    );

    return {
      ...data,

      annualRate,

      interestRate: `${safeRate.toFixed(2)}%`,

      selectedInterestRate: safeRate,

      totalDeposited,

      profitEligibleAmount,

      nonProfitAmount,

      normalizedDailyAmount,

      totalInterest,

      maturityAmount,

      returnRate: safeRate,

      returnAmount: totalInterest,
    };
  }

  // ===========================================================================
  // MONTHLY RD
  // ===========================================================================
  //
  // MONTHLY RD BUSINESS RULE
  //
  // Example:
  //
  // Opening Date   : 20-08-2025
  // Maturity Date  : 20-08-2026
  //
  // Last profitable payment date:
  //
  // 20-08-2026 - 15 days
  // = 05-08-2026
  //
  // Payment on/before 05-08-2026
  //     -> PROFIT ELIGIBLE
  //
  // Payment from 06-08-2026 onward
  //     -> NON-PROFIT
  //
  // The payment is still included in Total Deposited.
  // It simply does NOT contribute to Monthly RD interest.
  //
  // ===========================================================================

  if (data.rdType === 'Monthly RD') {
    // -------------------------------------------------------------------------
    // Determine tenure in months
    // -------------------------------------------------------------------------

    const periodText = data.period || '';

    let tenureMonths = 0;

    const monthMatch = periodText.match(
      /(\d+)\s*(?:month|months|m\b)/i
    );

    const yearMatch = periodText.match(
      /(\d+)\s*(?:year|years|y\b)/i
    );

    if (monthMatch) {
      tenureMonths = parseInt(
        monthMatch[1],
        10
      );
    } else if (yearMatch) {
      tenureMonths =
        parseInt(yearMatch[1], 10) * 12;
    } else if (
      data.tenureDays &&
      data.tenureDays > 0
    ) {
      tenureMonths = Math.max(
        1,
        Math.round(data.tenureDays / (365 / 12))
      );
    }

    if (tenureMonths <= 0) {
      tenureMonths = Math.max(
        1,
        data.validTransactionCount || 1
      );
    }

    // -------------------------------------------------------------------------
    // Determine maturity date
    // -------------------------------------------------------------------------

    let maturityDate =
      parseFlexibleDate(data.maturityDate);

    // -------------------------------------------------------------------------
    // If maturity date is not available in the ledger,
    // calculate it from the opening date + tenure.
    // -------------------------------------------------------------------------

    if (!maturityDate) {
      const openingDate =
        parseFlexibleDate(data.openingDate);

      if (openingDate) {
        maturityDate = addMonths(
          openingDate,
          tenureMonths
        );
      }
    }

    // -------------------------------------------------------------------------
    // Last profitable payment date
    //
    // Maturity date - 15 days
    // -------------------------------------------------------------------------

    let lastProfitablePaymentDate: Date | null =
      null;

    if (maturityDate) {
      lastProfitablePaymentDate = addDays(
        maturityDate,
        -15
      );
    }

    // -------------------------------------------------------------------------
    // Monthly interest rate
    // -------------------------------------------------------------------------

    const monthlyRate = annualRate / 12;

    // -------------------------------------------------------------------------
    // Get all valid receipt transactions
    // -------------------------------------------------------------------------

    const monthlyDeposits = data.transactions
      .filter(
        (transaction) =>
          transaction.isValidPayment &&
          transaction.receiptCredit !== null &&
          transaction.receiptCredit > 0
      )
      .map((transaction) => {
        const amount = Number(
          transaction.receiptCredit
        );

        const paymentDate =
          parseFlexibleDate(
            transaction.depositDateObj
          ) ||
          parseFlexibleDate(
            transaction.date
          );

        return {
          amount,
          date: paymentDate,
          originalTransaction: transaction,
        };
      })
      .filter(
        (deposit) =>
          Number.isFinite(deposit.amount) &&
          deposit.amount > 0
      )
      .sort((a, b) => {
        if (!a.date && !b.date) {
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
      });

    // -------------------------------------------------------------------------
    // Calculate profit-eligible and non-profit amounts
    // -------------------------------------------------------------------------

    let profitEligibleAmount = 0;
    let nonProfitAmount = 0;

    // Store classification for internal calculation.
    const classifiedDeposits =
      monthlyDeposits.map(
        (deposit) => {

          /*
           * If maturity date cannot be determined,
           * preserve the old behaviour and consider
           * the payment profitable.
           */
          let isNonProfit = false;

          if (
            lastProfitablePaymentDate &&
            deposit.date
          ) {
            /*
             * Payment after the 15-day cutoff
             * becomes non-profit.
             */
            isNonProfit =
              deposit.date.getTime() >
              lastProfitablePaymentDate.getTime();
          }

          if (isNonProfit) {
            nonProfitAmount += deposit.amount;
          } else {
            profitEligibleAmount += deposit.amount;
          }

          return {
            ...deposit,
            isNonProfit,
          };
        }
      );

    profitEligibleAmount = roundAmount(
      profitEligibleAmount
    );

    nonProfitAmount = roundAmount(
      nonProfitAmount
    );

    // -------------------------------------------------------------------------
    // Safety check:
    //
    // Total Deposited should always equal:
    //
    // Profit Eligible + Non-Profit
    //
    // If the transaction-level calculation differs from the parsed total,
    // preserve the ledger's actual total deposited amount.
    // -------------------------------------------------------------------------

    const classifiedTotal = roundAmount(
      profitEligibleAmount +
        nonProfitAmount
    );

    if (
      Math.abs(
        classifiedTotal - totalDeposited
      ) > 0.01
    ) {
      nonProfitAmount = roundAmount(
        Math.max(
          0,
          totalDeposited -
            profitEligibleAmount
        )
      );
    }

    // -------------------------------------------------------------------------
    // Progressive Monthly RD interest
    // -------------------------------------------------------------------------
    //
    // Only PROFIT-ELIGIBLE payments participate.
    //
    // Non-profit payments are completely excluded from
    // the interest calculation.
    //
    // The existing progressive monthly calculation
    // is preserved for profitable installments.
    // -------------------------------------------------------------------------

    let accumulatedInterest = 0;

    classifiedDeposits.forEach(
      (deposit, index) => {

        // ---------------------------------------------------------------
        // Non-profit installment:
        // No Monthly RD interest.
        // ---------------------------------------------------------------

        if (deposit.isNonProfit) {
          return;
        }

        // ---------------------------------------------------------------
        // Progressive tenure calculation.
        // ---------------------------------------------------------------

        const monthsRemaining = Math.max(
          1,
          tenureMonths - index
        );

        accumulatedInterest +=
          deposit.amount *
          monthlyRate *
          monthsRemaining;
      }
    );

    const totalInterest = roundAmount(
      accumulatedInterest
    );

    const maturityAmount = roundAmount(
      totalDeposited + totalInterest
    );

    // -------------------------------------------------------------------------
    // Average monthly installment
    // -------------------------------------------------------------------------

    const monthlyInstallment =
      monthlyDeposits.length > 0
        ? totalDeposited /
          monthlyDeposits.length
        : 0;

    // -------------------------------------------------------------------------
    // Return updated Monthly RD data
    // -------------------------------------------------------------------------

    return {
      ...data,

      annualRate,

      interestRate: `${safeRate.toFixed(2)}%`,

      selectedInterestRate: safeRate,

      totalDeposited,

      profitEligibleAmount,

      nonProfitAmount,

      dailySchemeAmount: 0,

      normalizedDailyAmount: 0,

      totalInterest,

      maturityAmount,

      returnRate: safeRate,

      returnAmount: totalInterest,

      // Keep the original maturity date if supplied.
      maturityDate:
        data.maturityDate ||
        (maturityDate
          ? formatDate(maturityDate)
          : data.maturityDate),

    };
  }

  // ===========================================================================
  // FALLBACK
  // ===========================================================================

  return {
    ...data,

    annualRate,

    interestRate: `${safeRate.toFixed(2)}%`,

    selectedInterestRate: safeRate,

    totalDeposited,

    totalInterest: 0,

    maturityAmount: totalDeposited,

    returnRate: safeRate,

    returnAmount: 0,
  };
}