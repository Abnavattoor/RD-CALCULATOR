import {
  RDAccountData,
  MonthlyRDInstallmentPeriod,
  MonthlyRDCalculationLog,
  MaturityRolloverDetails,
} from '../types';

export function roundAmount(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Maturity Rollover Rule (Business Rule):
 *
 * When a matured RD amount is used as the basis for a subsequent calculation:
 * 1. Determine the applicable maturity amount.
 * 2. Divide it by the applicable number of months for the subsequent term.
 * 3. Use the resulting monthly amount as the calculation base.
 * 4. Clearly distinguish the original RD principal, original interest, original
 *    maturity amount, and the monthly calculation base used for subsequent growth.
 * 5. Prevent double-counting the same maturity amount or interest.
 */
export function calculateMaturityRollover(
  originalMaturityAmount: number,
  subsequentTenureMonths: number = 12,
  annualInterestRate: number = 12.0,
  originalPrincipal?: number,
  originalInterest?: number
): MaturityRolloverDetails {
  const months = Math.max(1, Math.floor(subsequentTenureMonths));
  const safeRate =
    Number.isFinite(annualInterestRate) && annualInterestRate > 0
      ? annualInterestRate
      : 12.0;
  const monthlyRate = (safeRate / 100) / 12;

  // The applicable maturity amount divided by the applicable number of months
  // is the monthly calculation base for the new term
  const monthlyCalculationBase = originalMaturityAmount / months;

  // Subsequent monthly compounding on the calculation base
  let balance = 0;
  for (let m = 1; m <= months; m++) {
    balance += monthlyCalculationBase;
    const periodInterest = balance * monthlyRate;
    balance += periodInterest;
  }

  const subsequentMaturityAmount = roundAmount(balance);
  const subsequentTotalInterest = roundAmount(balance - originalMaturityAmount);

  return {
    originalPrincipal:
      originalPrincipal !== undefined ? roundAmount(originalPrincipal) : 0,
    originalInterest:
      originalInterest !== undefined ? roundAmount(originalInterest) : 0,
    originalMaturityAmount: roundAmount(originalMaturityAmount),
    subsequentTenureMonths: months,
    monthlyCalculationBase: roundAmount(monthlyCalculationBase),
    annualInterestRate: safeRate,
    subsequentTotalInterest,
    subsequentMaturityAmount,
  };
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

    // Daily RD balance accumulation sequence (Company Excel methodology):
    // Reference: CALCULATION OF RD - 2026 FEB 04 - 12%(2).xlsx, sheet DALIY
    let B = normalizedDailyAmount;
    let C = tenureDays > 0 ? (safeRate / tenureDays) : 0;
    let D = B;

    if (tenureDays === 1) {
      D = B + C;
    } else if (tenureDays >= 2) {
      for (let d = 2; d <= tenureDays; d++) {
        B = (d === 2) ? (normalizedDailyAmount + C) : D;
        C = (B * (safeRate / 100)) / 365;
        D = B + C + normalizedDailyAmount;
      }
    }
    const finalBalance = D + nonProfitAmount;

    const totalInterest = roundAmount(finalBalance - totalDeposited);
    const maturityAmount = roundAmount(finalBalance);

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
    // Inspect transactions for closure / settlement / debit entries and recorded interest
    // -------------------------------------------------------------------------

    let recordedInterestPaid: number | null =
      data.recordedInterestPaid !== undefined ? data.recordedInterestPaid : null;
    let closureDate: string | undefined = data.closureDate;
    let closureAmount: number | undefined = data.closureAmount;

    for (const tx of data.transactions || []) {
      const partLower = String(tx.particulars || '').toLowerCase();
      const debitNum =
        tx.paymentDebit !== null && tx.paymentDebit !== undefined
          ? Number(String(tx.paymentDebit).replace(/[^0-9.]/g, ''))
          : null;
      const isDebit = debitNum !== null && !isNaN(debitNum) && debitNum > 0;
      const isClosureKeywords =
        partLower.includes('close') ||
        partLower.includes('closure') ||
        partLower.includes('maturity') ||
        partLower.includes('settle') ||
        partLower.includes('payout') ||
        partLower.includes('paid to');

      if (isDebit || isClosureKeywords) {
        if (isDebit) {
          closureAmount = debitNum;
        }
        if (tx.date) {
          closureDate = tx.date;
        }
      }

      // Check for recorded interest in intPaid column or particulars
      if (tx.intPaid !== null && tx.intPaid !== undefined && tx.intPaid !== '') {
        const intNum =
          typeof tx.intPaid === 'number'
            ? tx.intPaid
            : parseFloat(String(tx.intPaid).replace(/[^0-9.]/g, ''));
        if (Number.isFinite(intNum) && intNum > 0) {
          recordedInterestPaid = intNum;
        }
      }
    }

    // -------------------------------------------------------------------------
    // Get all valid receipt transactions (excluding closure / debit rows)
    // -------------------------------------------------------------------------

    const monthlyDeposits = (data.transactions || [])
      .filter((transaction) => {
        if (transaction.isSummaryRow) return false;
        const partLower = String(transaction.particulars || '').toLowerCase();
        const debitNum =
          transaction.paymentDebit !== null && transaction.paymentDebit !== undefined
            ? Number(String(transaction.paymentDebit).replace(/[^0-9.]/g, ''))
            : null;
        const isDebit = debitNum !== null && !isNaN(debitNum) && debitNum > 0;
        const isClosureKeywords =
          partLower.includes('closure') ||
          partLower.includes('maturity payout') ||
          partLower.includes('a/c close') ||
          partLower.includes('settlement');

        if (isDebit || isClosureKeywords) {
          return false;
        }

        return (
          transaction.isValidPayment &&
          transaction.receiptCredit !== null &&
          transaction.receiptCredit > 0
        );
      })
      .map((transaction) => {
        const amount = Number(transaction.receiptCredit);
        const paymentDate =
          parseFlexibleDate(transaction.depositDateObj) ||
          parseFlexibleDate(transaction.date);

        return {
          amount,
          date: paymentDate,
          dateStr: transaction.date || (paymentDate ? formatDate(paymentDate) : ''),
          particulars: transaction.particulars,
          originalTransaction: transaction,
        };
      })
      .filter((deposit) => Number.isFinite(deposit.amount) && deposit.amount > 0)
      .sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date.getTime() - b.date.getTime();
      });

    // -------------------------------------------------------------------------
    // Calculate profit-eligible and non-profit amounts
    // Distinguish normal payments, overdue payments, and over-tenure payments
    // -------------------------------------------------------------------------

    let profitEligibleAmount = 0;
    let nonProfitAmount = 0;

    const classifiedDeposits = monthlyDeposits.map((deposit) => {
      // Payments strictly after maturity date are non-profit (over-tenure)
      const isOverTenure =
        maturityDate && deposit.date
          ? deposit.date.getTime() > maturityDate.getTime()
          : false;

      if (isOverTenure) {
        nonProfitAmount += deposit.amount;
      } else {
        profitEligibleAmount += deposit.amount;
      }

      return {
        ...deposit,
        isNonProfit: isOverTenure,
      };
    });

    profitEligibleAmount = roundAmount(profitEligibleAmount);
    nonProfitAmount = roundAmount(nonProfitAmount);

    if (Math.abs(profitEligibleAmount + nonProfitAmount - totalDeposited) > 0.01) {
      profitEligibleAmount = totalDeposited;
      nonProfitAmount = 0;
    }

    // -------------------------------------------------------------------------
    // MONTHLY RD COMPOUNDING CALCULATION WITH INSTALLMENT ALLOCATION
    //
    // Reference Workbook: CALCULATION OF RD - 2026 FEB 04 - 12%.xlsx (MONTHLY sheet)
    //
    // Handles missed and combined installments:
    // When a customer misses installments and pays combined (e.g. ₹2,000 monthly
    // paid as ₹6,000 in month 4 covering 3 installments), allocate ₹2,000 across
    // each of the 3 due periods rather than compressing into 1 period and
    // double-counting phantom installments at the end of the term.
    // -------------------------------------------------------------------------

    const numberOfMonths = Math.max(1, tenureMonths);
    let expectedInstallment =
      data.schemeAmount && data.schemeAmount > 0
        ? data.schemeAmount
        : profitEligibleAmount > 0
        ? profitEligibleAmount / numberOfMonths
        : totalDeposited / numberOfMonths;

    if (expectedInstallment <= 0) {
      expectedInstallment = 2000;
    }

    const openingDateObj = parseFlexibleDate(data.openingDate);
    const installmentSchedule: MonthlyRDInstallmentPeriod[] = [];

    for (let m = 1; m <= numberOfMonths; m++) {
      let dueDateStr = '';
      if (openingDateObj) {
        const d = addMonths(openingDateObj, m - 1);
        dueDateStr = formatDate(d);
      }
      installmentSchedule.push({
        installmentNumber: m,
        monthIndex: m,
        dueDate: dueDateStr,
        expectedAmount: expectedInstallment,
        allocatedAmount: 0,
        status: 'missed',
        openingBalance: 0,
        periodInterest: 0,
        closingBalance: 0,
      });
    }

    let currentSlot = 0;
    let combinedPaymentsDetected = 0;
    let onTimeCount = 0;
    let overdueCount = 0;
    const diagnosticNotes: string[] = [];

    const eligibleDeposits = classifiedDeposits.filter((d) => !d.isNonProfit);

    for (const dep of eligibleDeposits) {
      const installmentsCovered = Math.max(
        1,
        Math.round(dep.amount / expectedInstallment)
      );

      if (installmentsCovered > 1) {
        combinedPaymentsDetected++;
        diagnosticNotes.push(
          `Combined payment of ₹${dep.amount.toFixed(
            2
          )} on ${dep.dateStr || 'ledger date'} allocated to ${installmentsCovered} installments of ₹${expectedInstallment.toFixed(
            2
          )} each.`
        );
      }

      for (
        let k = 0;
        k < installmentsCovered && currentSlot < numberOfMonths;
        k++
      ) {
        const slot = installmentSchedule[currentSlot];
        slot.allocatedAmount = expectedInstallment;
        slot.paymentDate = dep.dateStr;

        const slotDueDate = openingDateObj
          ? addMonths(openingDateObj, currentSlot)
          : null;
        const isLate =
          slotDueDate && dep.date
            ? dep.date.getTime() >
              slotDueDate.getTime() + 7 * 24 * 60 * 60 * 1000
            : false;

        if (installmentsCovered > 1 && k < installmentsCovered - 1) {
          slot.status = 'overdue';
          overdueCount++;
        } else if (isLate) {
          slot.status = 'overdue';
          overdueCount++;
        } else {
          slot.status = 'on-time';
          onTimeCount++;
        }

        currentSlot++;
      }
    }

    const installmentsPaid = currentSlot;
    const missedCount = Math.max(0, numberOfMonths - installmentsPaid);

    // Progressive monthly balance accumulation on the allocated installment schedule
    let balance = 0;
    for (let m = 0; m < numberOfMonths; m++) {
      const slot = installmentSchedule[m];
      slot.openingBalance = roundAmount(balance);
      balance += slot.allocatedAmount;
      const periodInterest = balance * monthlyRate;
      slot.periodInterest = roundAmount(periodInterest);
      balance += periodInterest;
      slot.closingBalance = roundAmount(balance);
    }

    // Include non-profit principal (e.g. over-tenure deposits after maturity)
    balance += nonProfitAmount;

    const rawMaturityAmount = balance;
    const rawTotalInterest = balance - totalDeposited;

    const totalInterest = roundAmount(rawTotalInterest);
    const maturityAmount = roundAmount(rawMaturityAmount);

    // Intermediate calculation logging for complete diagnostic exposure
    const intermediateLog: MonthlyRDCalculationLog = {
      tenureMonths: numberOfMonths,
      monthlyInstallment: expectedInstallment,
      annualRate,
      monthlyRate,
      totalDeposited,
      profitEligiblePrincipal: profitEligibleAmount,
      nonProfitPrincipal: nonProfitAmount,
      installmentsDue: numberOfMonths,
      installmentsPaid,
      combinedPaymentsDetected,
      periods: installmentSchedule,
      rawFinalBalance: rawMaturityAmount,
      calculatedMaturityAmount: maturityAmount,
      calculatedTotalInterest: totalInterest,
      recordedInterestInLedger: recordedInterestPaid,
      interestVariance:
        recordedInterestPaid !== null
          ? roundAmount(totalInterest - recordedInterestPaid)
          : undefined,
      closureDate,
      closureAmount,
      diagnosticNotes,
    };

    // Maturity Rollover Rule projection (business rule)
    const rolloverCalculation = calculateMaturityRollover(
      maturityAmount,
      numberOfMonths,
      safeRate,
      totalDeposited,
      totalInterest
    );

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

      installmentsDue: numberOfMonths,

      installmentsPaid,

      onTimeInstallmentsCount: onTimeCount,

      overdueInstallmentsCount: overdueCount,

      missedInstallmentsCount: missedCount,

      overTenureDepositsCount: classifiedDeposits.filter((d) => d.isNonProfit).length,

      recordedInterestPaid,

      closureDate,

      closureAmount,

      installmentSchedule,

      intermediateCalculationLog: intermediateLog,

      rolloverCalculation,

      // Keep the original maturity date if supplied.
      maturityDate:
        data.maturityDate ||
        (maturityDate ? formatDate(maturityDate) : data.maturityDate),
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