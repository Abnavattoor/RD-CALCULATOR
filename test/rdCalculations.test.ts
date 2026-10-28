/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateDailyRDMaturity,
  calculateMonthlyRDMaturity,
  getDefaultRateForDuration,
  adjustRate,
  validateRateInput,
  getDailyRDBreakdownPage,
  getMonthlyRDBreakdown,
  generateRDCSVReport,
  roundMoney,
  RATE_ADJUSTMENT_STEP,
  CONFIGURABLE_MAX_INTEREST_RATE,
} from '../src/utils/rdInterestCalculator';

import {
  recalculateRDWithRate,
  calculateMaturityRollover,
} from '../src/utils/rdCalculator';
import { getApplicablePreClosureRate } from '../src/utils/preClosureRates';
import {
  createNitcDailyRCDAccountData,
  createNitcMonthlyRCMAccountData,
  createDepositPersonalLedgerRDAccountData,
} from '../src/utils/demoLedger';
import type { RDAccountData } from '../src/types';

describe('RD Calculation & Interest-Rate Controls Test Suite', () => {
  // =========================================================================
  // 1. Daily RD for 365, 730 and 1,095 days
  // =========================================================================
  describe('1. Daily RD for 365, 730, and 1,095 days (Company Excel compounding)', () => {
    test('Reference Workbook Test Case: 365 Days @ 12.0% with ₹54.767 daily deposit (DALIY sheet) returns ₹21,235.13564092562', () => {
      const res = calculateDailyRDMaturity(365, 54.767, 12.0);
      assert.equal(res.isValid, true);
      assert.equal(res.rawMaturityAmount, 21235.13564092562);
      assert.equal(res.maturityAmount, 21235.14);
      assert.equal(res.totalDeposited, 19989.96);
      assert.equal(res.totalInterest, 1245.18);
      assert.equal(roundMoney(res.totalDeposited + res.totalInterest), res.maturityAmount);
    });

    test('365 Days @ 12.0% with ₹55 daily deposit (displayed approximation in workbook)', () => {
      const res = calculateDailyRDMaturity(365, 55, 12.0);
      assert.equal(res.isValid, true);
      assert.equal(res.totalDeposited, 20075.0);
      assert.equal(res.totalInterest, 1250.48);
      assert.equal(res.maturityAmount, 21325.48);
      assert.equal(roundMoney(res.totalDeposited + res.totalInterest), res.maturityAmount);
    });

    test('365 Days @ 12.0% with ₹100 daily deposit (Workbook DALIY methodology)', () => {
      const res = calculateDailyRDMaturity(365, 100, 12.0);
      assert.equal(res.isValid, true);
      assert.equal(res.totalDeposited, 36500.0);
      assert.equal(res.totalInterest, 2273.57);
      assert.equal(res.maturityAmount, 38773.57);
      assert.equal(roundMoney(res.totalDeposited + res.totalInterest), res.maturityAmount);
    });

    test('730 Days @ 12.5% with ₹100 daily deposit (Workbook DALIY methodology)', () => {
      const res = calculateDailyRDMaturity(730, 100, 12.5);
      assert.equal(res.isValid, true);
      assert.equal(res.totalDeposited, 73000.0);
      assert.equal(res.totalInterest, 9919.40);
      assert.equal(res.maturityAmount, 82919.40);
      assert.equal(roundMoney(res.totalDeposited + res.totalInterest), res.maturityAmount);
    });

    test('1,095 Days @ 13.0% with ₹100 daily deposit (Workbook DALIY methodology)', () => {
      const res = calculateDailyRDMaturity(1095, 100, 13.0);
      assert.equal(res.isValid, true);
      assert.equal(res.totalDeposited, 109500.0);
      assert.equal(res.totalInterest, 24392.75);
      assert.equal(res.maturityAmount, 133892.75);
      assert.equal(roundMoney(res.totalDeposited + res.totalInterest), res.maturityAmount);
    });

    test('First-day and final-day interest treatment: verifies daily installment sequence in DALIY sheet', () => {
      // Reference case breakdown: 365 days, 54.767 installment, 12.0% rate
      const breakdown = getDailyRDBreakdownPage(365, 54.767, 12.0, 1, 365);
      assert.equal(breakdown.rows.length, 365);

      // Day 1 (First Day, Row 7): B7 = 54.767, C7 = D4 / D2 = 12 / 365 = 0.0328767...
      const day1 = breakdown.rows[0];
      assert.equal(day1.deposit, 54.767);
      assert.equal(day1.balance, 54.77);
      assert.equal(day1.periodInterest, 0.03); // roundMoney(12 / 365)
      assert.equal(day1.cumulativeDeposit, 54.77);
      assert.equal(day1.cumulativeTotal, 54.80);

      // Day 365 (Final Day, Row 371): C365 = 6.96, cumulativeTotal = 21235.14
      const day365 = breakdown.rows[364];
      assert.equal(day365.deposit, 54.767);
      assert.equal(day365.periodIndex, 365);
      assert.equal(day365.cumulativeDeposit, 19989.96);
      assert.equal(day365.periodInterest, 6.96); // C365 = 6.96112...
      assert.equal(day365.cumulativeTotal, 21235.14);
      assert.equal(day365.cumulativeInterest, 1245.18);
    });
  });

  // =========================================================================
  // 2. Monthly RD for 12, 24 and 36 months (Workbook monthly compounding)
  // =========================================================================
  describe('2. Monthly RD for 12, 24, and 36 months', () => {
    test('Regression: Fixed-installment Monthly RD (₹2,000, 12 months, 12% p.a.) returns ₹25,618.65608665788', () => {
      const res = calculateMonthlyRDMaturity(12, 2000, 12.0);
      assert.equal(res.isValid, true);
      assert.equal(res.rawMaturityAmount, 25618.65608665788);
      assert.equal(res.maturityAmount, 25618.66);
      assert.equal(res.totalDeposited, 24000.0);
      assert.equal(res.totalInterest, 1618.66);
      assert.equal(res.installmentAmount, 2000);
      assert.equal(res.duration, 12);
    });

    test('12 Months @ 12.0% with ₹1,000 monthly deposit', () => {
      const res = calculateMonthlyRDMaturity(12, 1000, 12.0);
      assert.equal(res.isValid, true);
      assert.equal(res.totalDeposited, 12000.0);
      assert.equal(res.totalInterest, 809.33);
      assert.equal(res.maturityAmount, 12809.33);
      assert.equal(roundMoney(res.totalDeposited + res.totalInterest), res.maturityAmount);
    });

    test('24 Months @ 12.5% with ₹1,000 monthly deposit', () => {
      const res = calculateMonthlyRDMaturity(24, 1000, 12.5);
      assert.equal(res.isValid, true);
      assert.equal(res.totalDeposited, 24000.0);
      assert.equal(res.totalInterest, 3389.51);
      assert.equal(res.maturityAmount, 27389.51);
      assert.equal(roundMoney(res.totalDeposited + res.totalInterest), res.maturityAmount);
    });

    test('36 Months @ 13.0% with ₹1,000 monthly deposit', () => {
      const res = calculateMonthlyRDMaturity(36, 1000, 13.0);
      assert.equal(res.isValid, true);
      assert.equal(res.totalDeposited, 36000.0);
      assert.equal(res.totalInterest, 8217.23);
      assert.equal(res.maturityAmount, 44217.23);
      assert.equal(roundMoney(res.totalDeposited + res.totalInterest), res.maturityAmount);
    });
  });

  // =========================================================================
  // 3. Default interest rates for every supported duration
  // =========================================================================
  describe('3. Default interest rates for every supported duration', () => {
    test('Daily RD default rates (365d -> 12%, 730d -> 12.5%, 1095d -> 13%)', () => {
      assert.equal(getDefaultRateForDuration('Daily RD', 365), 12.0);
      assert.equal(getDefaultRateForDuration('Daily RD', 730), 12.5);
      assert.equal(getDefaultRateForDuration('Daily RD', 1095), 13.0);
    });

    test('Monthly RD default rates (12m -> 12%, 24m -> 12%, 36m -> 12%)', () => {
      assert.equal(getDefaultRateForDuration('Monthly RD', 12), 12.0);
      assert.equal(getDefaultRateForDuration('Monthly RD', 24), 12.0);
      assert.equal(getDefaultRateForDuration('Monthly RD', 36), 12.0);
    });
  });

  // =========================================================================
  // 4. Increasing and decreasing the rate by 0.1 percentage points
  // =========================================================================
  describe('4. Increasing and decreasing the rate by 0.1 percentage points', () => {
    test('Rate increments by exactly 0.1 pp without floating point drift', () => {
      const rate1 = adjustRate(12.0, 0.1);
      assert.equal(rate1, 12.1);

      const rate2 = adjustRate(12.1, 0.1);
      assert.equal(rate2, 12.2);

      const rate3 = adjustRate(12.2, -0.1);
      assert.equal(rate3, 12.1);

      const rate4 = adjustRate(12.0, -0.1);
      assert.equal(rate4, 11.9);
    });

    test('Immediate recalculation with increased rate (12.0% -> 12.1%)', () => {
      const resOriginal = calculateDailyRDMaturity(365, 100, 12.0);
      const resIncreased = calculateDailyRDMaturity(365, 100, 12.1);
      assert.equal(resOriginal.maturityAmount, 38773.57);
      assert.equal(resIncreased.totalInterest, 2293.29);
      assert.equal(resIncreased.maturityAmount, 38793.29);
      assert.ok(resIncreased.maturityAmount > resOriginal.maturityAmount);
    });

    test('Immediate recalculation with decreased rate (12.0% -> 11.9%)', () => {
      const resOriginal = calculateDailyRDMaturity(365, 100, 12.0);
      const resDecreased = calculateDailyRDMaturity(365, 100, 11.9);
      assert.equal(resDecreased.totalInterest, 2253.86);
      assert.equal(resDecreased.maturityAmount, 38753.86);
      assert.ok(resDecreased.maturityAmount < resOriginal.maturityAmount);
    });
  });

  // =========================================================================
  // 5. Entering a custom interest rate
  // =========================================================================
  describe('5. Entering a custom interest rate', () => {
    test('Validates and accepts decimal rates', () => {
      const valid1 = validateRateInput('11.75');
      assert.equal(valid1.isValid, true);
      assert.equal(valid1.value, 11.75);

      const valid2 = validateRateInput('14.2');
      assert.equal(valid2.isValid, true);
      assert.equal(valid2.value, 14.2);
    });

    test('Rejects negative rates and non-finite values', () => {
      const negative = validateRateInput('-2.5');
      assert.equal(negative.isValid, false);

      const text = validateRateInput('abc');
      assert.equal(text.isValid, false);

      const empty = validateRateInput('  ');
      assert.equal(empty.isValid, false);
    });

    test('Rejects rates exceeding configurable maximum', () => {
      const exceeded = validateRateInput('125.0', CONFIGURABLE_MAX_INTEREST_RATE);
      assert.equal(exceeded.isValid, false);
    });
  });

  // =========================================================================
  // 6. Resetting the rate to the duration-specific default
  // =========================================================================
  describe('6. Resetting the rate to duration-specific default', () => {
    test('Restores 12.5% for 730 days after manual adjustment', () => {
      const customRate = 14.8;
      assert.notEqual(customRate, getDefaultRateForDuration('Daily RD', 730));
      const resetRate = getDefaultRateForDuration('Daily RD', 730);
      assert.equal(resetRate, 12.5);
    });

    test('Restores 12.0% for 36 months after manual adjustment', () => {
      const customRate = 9.5;
      assert.notEqual(customRate, getDefaultRateForDuration('Monthly RD', 36));
      const resetRate = getDefaultRateForDuration('Monthly RD', 36);
      assert.equal(resetRate, 12.0);
    });
  });

  // =========================================================================
  // 7. Changing the duration after manually adjusting the rate
  // =========================================================================
  describe('7. Changing duration after manually adjusting rate', () => {
    test('Updating duration switches to new duration default rate for Daily RD', () => {
      let currentRate = 14.0; // custom rate on 365 days
      const newDuration = 730;
      currentRate = getDefaultRateForDuration('Daily RD', newDuration);
      assert.equal(currentRate, 12.5);

      const newDuration3 = 1095;
      currentRate = getDefaultRateForDuration('Daily RD', newDuration3);
      assert.equal(currentRate, 13.0);
    });

    test('Monthly RD retains 12% default across all durations without auto-changing to 12.5% or 13%', () => {
      assert.equal(getDefaultRateForDuration('Monthly RD', 12), 12.0);
      assert.equal(getDefaultRateForDuration('Monthly RD', 24), 12.0);
      assert.equal(getDefaultRateForDuration('Monthly RD', 36), 12.0);
    });

    test('Monthly RD interest adjustment ±0.1% updates maturity immediately while preserving installment and duration', () => {
      const installment = 2000;
      const duration = 12;
      const resBase = calculateMonthlyRDMaturity(duration, installment, 12.0);
      assert.equal(resBase.maturityAmount, 25618.66);
      assert.equal(resBase.totalDeposited, 24000.0);
      assert.equal(resBase.totalInterest, 1618.66);

      // +0.1 pp (12.0% -> 12.1%)
      const ratePlus = adjustRate(12.0, 0.1);
      assert.equal(ratePlus, 12.1);
      const resPlus = calculateMonthlyRDMaturity(duration, installment, ratePlus);
      assert.equal(resPlus.installmentAmount, 2000);
      assert.equal(resPlus.duration, 12);
      assert.equal(resPlus.totalDeposited, 24000.0);
      assert.equal(resPlus.maturityAmount > resBase.maturityAmount, true);

      // -0.1 pp (12.0% -> 11.9%)
      const rateMinus = adjustRate(12.0, -0.1);
      assert.equal(rateMinus, 11.9);
      const resMinus = calculateMonthlyRDMaturity(duration, installment, rateMinus);
      assert.equal(resMinus.installmentAmount, 2000);
      assert.equal(resMinus.duration, 12);
      assert.equal(resMinus.totalDeposited, 24000.0);
      assert.equal(resMinus.maturityAmount < resBase.maturityAmount, true);

      // Reset restores 12.0%
      const resetRate = getDefaultRateForDuration('Monthly RD', duration);
      assert.equal(resetRate, 12.0);
      const resReset = calculateMonthlyRDMaturity(duration, installment, resetRate);
      assert.equal(resReset.maturityAmount, 25618.66);
    });

    test('Installment amount remains unchanged when rate is adjusted', () => {
      const installment = 100;
      const res1 = calculateDailyRDMaturity(365, installment, 12.0);
      const res2 = calculateDailyRDMaturity(365, installment, 12.5);
      assert.equal(res1.installmentAmount, installment);
      assert.equal(res2.installmentAmount, installment);
    });
  });

  // =========================================================================
  // 8. Zero installments, invalid values, boundary dates and rounding
  // =========================================================================
  describe('8. Zero installments, invalid values, boundary dates and rounding', () => {
    test('Zero days or zero installments return invalid state', () => {
      const zeroDays = calculateDailyRDMaturity(0, 100, 12.0);
      assert.equal(zeroDays.isValid, false);

      const zeroAmount = calculateDailyRDMaturity(365, 0, 12.0);
      assert.equal(zeroAmount.isValid, false);

      const negativeDays = calculateDailyRDMaturity(-10, 100, 12.0);
      assert.equal(negativeDays.isValid, false);
    });

    test('Zero interest rate produces maturity equal to total deposited', () => {
      const zeroRate = calculateDailyRDMaturity(365, 100, 0);
      assert.equal(zeroRate.isValid, true);
      assert.equal(zeroRate.totalInterest, 0);
      assert.equal(zeroRate.maturityAmount, 36500.0);
    });

    test('Rounding function handles edge cases cleanly', () => {
      assert.equal(roundMoney(123.456), 123.46);
      assert.equal(roundMoney(123.454), 123.45);
      assert.equal(roundMoney(0.0001), 0.0);
      assert.equal(roundMoney(NaN), 0.0);
    });
  });

  // =========================================================================
  // 9. Regression tests for existing functionality
  // =========================================================================
  describe('9. Regression tests for existing functionality', () => {
    test('NITC Daily RCD account recalculation succeeds', () => {
      const rcdAccount = createNitcDailyRCDAccountData();
      const recalculated = recalculateRDWithRate(rcdAccount, 12.0);
      assert.equal(recalculated.rdType, 'Daily RD');
      assert.equal(recalculated.totalDeposited, 19900);
      assert.equal(recalculated.maturityAmount > 19900, true);
    });

    test('NITC Monthly RCM account recalculation succeeds', () => {
      const rcmAccount = createNitcMonthlyRCMAccountData();
      const recalculated = recalculateRDWithRate(rcmAccount, 12.0);
      assert.equal(recalculated.rdType, 'Monthly RD');
      assert.equal(recalculated.totalDeposited, 36000);
      assert.equal(recalculated.maturityAmount > 36000, true);
    });

    test('Pre-closure rates lookup remains functional', () => {
      const rcRateM6 = getApplicablePreClosureRate('RC', 1, 6);
      assert.equal(rcRateM6, 2);

      const rcRateM12 = getApplicablePreClosureRate('RC', 1, 12);
      assert.equal(rcRateM12, 6);
    });
  });

  // =========================================================================
  // 10. Consistency between UI maturity result and exported results
  // =========================================================================
  describe('10. Consistency between UI maturity result and exported results', () => {
    test('Daily RD CSV report totals reconcile with calculateDailyRDMaturity', () => {
      const days = 365;
      const amount = 100;
      const rate = 12.0;

      const calcResult = calculateDailyRDMaturity(days, amount, rate);
      const csv = generateRDCSVReport('Daily RD', days, amount, rate);

      assert.match(csv, /365 Days/);
      assert.match(csv, /12.00% per annum/);
      // Verify final line has cumulative deposit of 36500.00 and total of 38773.57
      const lines = csv.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      assert.match(lastLine, /Day 365/);
      assert.match(lastLine, /36500.00/);
      assert.match(lastLine, /38773.57/);
      assert.equal(calcResult.maturityAmount, 38773.57);
    });

    test('Monthly RD schedule reconciliation', () => {
      const months = 12;
      const amount = 1000;
      const rate = 12.0;

      const calcResult = calculateMonthlyRDMaturity(months, amount, rate);
      const rows = getMonthlyRDBreakdown(months, amount, rate);

      assert.equal(rows.length, 12);
      const lastRow = rows[rows.length - 1];
      assert.equal(lastRow.cumulativeDeposit, calcResult.totalDeposited);
      assert.equal(lastRow.cumulativeInterest, calcResult.totalInterest);
      assert.equal(lastRow.cumulativeTotal, calcResult.maturityAmount);
    });
  });

  // =========================================================================
  // =========================================================================
  // 11. Company Standard Test Case & Ledger Regression
  // =========================================================================
  describe('11. Company Standard Test Case & Ledger Regression', () => {
    test('Standard Test Case in recalculateRDWithRate returns ₹25,618.66 and updates with rate controls', () => {
      // Company standard test case:
      // Monthly installment: ₹2,000
      // Duration: 12 months
      // Annual interest rate: 12%
      // Total deposits: ₹24,000
      // Expected maturity amount: ₹25,618.65608665788 (displays ₹25,618.66)
      // Expected interest: ₹1,618.65608665788 (displays ₹1,618.66)

      const paymentDates = [
        '20/08/2025', '20/09/2025', '20/10/2025', '20/11/2025',
        '20/12/2025', '20/01/2026', '20/02/2026', '20/03/2026',
        '20/04/2026', '20/05/2026', '20/06/2026', '20/07/2026',
      ];
      let runningBal = 0;
      const transactions = paymentDates.map((dateStr, idx) => {
        runningBal += 2000;
        const [d, m, y] = dateStr.split('/').map(Number);
        return {
          rowNum: idx + 1,
          date: dateStr,
          depositDateObj: new Date(y, m - 1, d),
          particulars: `Monthly Installment #${idx + 1}`,
          paymentDebit: null,
          receiptCredit: 2000,
          rawReceiptCredit: 2000,
          balance: runningBal,
          intPaid: null,
          isSummaryRow: false,
          isValidPayment: true,
        };
      });

      const standardAccount: RDAccountData = {
        fileName: 'CALCULATION_OF_RD_2026_FEB_04_12pct.xlsx',
        fileSize: 32000,
        sheetName: 'MONTHLY',
        customerName: 'Standard Test Case Customer',
        accountNumber: 'RD-MONTHLY-2025-01',
        rdType: 'Monthly RD',
        openingDate: '20/08/2025',
        maturityDate: '20/08/2026',
        interestRate: '12%',
        annualRate: 0.12,
        selectedInterestRate: 12,
        status: 'Active',
        period: '12 Months',
        tenureDays: 365,
        transactions,
        totalDeposited: 24000,
        profitEligibleAmount: 24000,
        nonProfitAmount: 0,
        dailySchemeAmount: 0,
        normalizedDailyAmount: 0,
        totalInterest: 0,
        maturityAmount: 24000,
        validTransactionCount: 12,
        hasSummaryRow: true,
        returnRate: 12,
        returnAmount: 0,
      };

      const result = recalculateRDWithRate(standardAccount, 12.0);
      assert.equal(result.totalDeposited, 24000);
      assert.equal(result.totalInterest, 1618.66);
      assert.equal(result.maturityAmount, 25618.66);

      // Verify immediate recalculation when rate is increased by 0.1 pp (+0.1)
      const resIncreased = recalculateRDWithRate(standardAccount, 12.1);
      assert.equal(resIncreased.selectedInterestRate, 12.1);
      assert.equal(resIncreased.interestRate, '12.10%');
      assert.ok(resIncreased.maturityAmount > 25618.66);
      assert.ok(resIncreased.totalInterest > 1618.66);

      // Verify immediate recalculation when rate is decreased by 0.1 pp (-0.1)
      const resDecreased = recalculateRDWithRate(standardAccount, 11.9);
      assert.equal(resDecreased.selectedInterestRate, 11.9);
      assert.equal(resDecreased.interestRate, '11.90%');
      assert.ok(resDecreased.maturityAmount < 25618.66);
      assert.ok(resDecreased.totalInterest < 1618.66);
    });

    test('Actual ledger with over-tenure payment preserves data and marks payment after maturity as non-profit', () => {
      // 12 regular installments within tenure + 1 late payment deposited strictly after account maturity
      const regularDates = [
        '20/08/2025', '20/09/2025', '20/10/2025', '20/11/2025',
        '20/12/2025', '20/01/2026', '20/02/2026', '20/03/2026',
        '20/04/2026', '20/05/2026', '20/06/2026', '20/07/2026',
        '25/08/2026', // Deposited after maturity date (20/08/2026)
      ];
      let runningBal = 0;
      const transactions = regularDates.map((dateStr, idx) => {
        runningBal += 2000;
        const [d, m, y] = dateStr.split('/').map(Number);
        return {
          rowNum: idx + 1,
          date: dateStr,
          depositDateObj: new Date(y, m - 1, d),
          particulars: `Monthly Installment #${idx + 1}`,
          paymentDebit: null,
          receiptCredit: 2000,
          rawReceiptCredit: 2000,
          balance: runningBal,
          intPaid: null,
          isSummaryRow: false,
          isValidPayment: true,
        };
      });

      const overTenureAccount: RDAccountData = {
        fileName: 'Customer_Over_Tenure_Ledger.xlsx',
        fileSize: 34000,
        sheetName: 'DepositPersonalLedgerRD',
        customerName: 'Customer with Over-Tenure Deposit',
        accountNumber: 'RD-MONTHLY-2025-02',
        rdType: 'Monthly RD',
        openingDate: '20/08/2025',
        maturityDate: '20/08/2026',
        interestRate: '12%',
        annualRate: 0.12,
        selectedInterestRate: 12,
        status: 'Active',
        period: '12 Months',
        tenureDays: 365,
        transactions,
        totalDeposited: 26000,
        profitEligibleAmount: 24000,
        nonProfitAmount: 2000,
        dailySchemeAmount: 0,
        normalizedDailyAmount: 0,
        totalInterest: 0,
        maturityAmount: 26000,
        validTransactionCount: 13,
        hasSummaryRow: true,
        returnRate: 12,
        returnAmount: 0,
      };

      const result = recalculateRDWithRate(overTenureAccount, 12.0);
      assert.equal(result.totalDeposited, 26000);
      assert.equal(result.nonProfitAmount, 2000);
      assert.equal(result.profitEligibleAmount, 24000);
      // Compounded profit-eligible interest: ₹1,618.66, plus ₹2,000 non-profit principal = ₹27,618.66
      assert.equal(result.totalInterest, 1618.66);
      assert.equal(result.maturityAmount, 27618.66);
    });

    test('Actual Ledger RD (DepositPersonalLedgerRD.xlsx): combined ₹6,000 payment allocated across 3 installments and closure row handled', () => {
      // Real test case matching DepositPersonalLedgerRD.xlsx:
      // Opening Date: 14 Oct 2024, Duration: 12 months, Rate: 12.0%
      // Total deposits: ₹24,000.00 (9 payments of ₹2,000 and 1 combined payment of ₹6,000)
      // Closure row on 14 Oct 2025 with Int Paid = ₹1,134.00 and Debit = ₹25,134.00
      const accountData = createDepositPersonalLedgerRDAccountData();

      const result = recalculateRDWithRate(accountData, 12.0);

      // Verify principal and transaction count
      assert.equal(result.totalDeposited, 24000.0);
      assert.equal(result.installmentsDue, 12);
      assert.equal(result.installmentsPaid, 12);
      assert.equal(result.recordedInterestPaid, 1134.0);
      assert.equal(result.closureDate, '14/10/2025');

      // Verify the allocated compounding result (NOT the buggy 29,993.40!)
      assert.notEqual(result.maturityAmount, 29993.4);
      assert.equal(result.maturityAmount, 25618.66);
      assert.equal(result.totalInterest, 1618.66);

      // Verify intermediate calculation log is exposed
      assert.ok(result.intermediateCalculationLog);
      assert.equal(result.intermediateCalculationLog?.installmentsDue, 12);
      assert.equal(result.intermediateCalculationLog?.installmentsPaid, 12);
      assert.equal(result.intermediateCalculationLog?.periods.length, 12);
      assert.equal(result.intermediateCalculationLog?.combinedPaymentsDetected, 1);
      assert.equal(result.intermediateCalculationLog?.recordedInterestInLedger, 1134.0);
      assert.equal(result.intermediateCalculationLog?.interestVariance, 484.66);

      // Verify each slot received exactly ₹2,000 allocated with no phantom additions at the end
      const allSlotsHave2000 = result.installmentSchedule?.every(
        (s) => s.allocatedAmount === 2000
      );
      assert.equal(allSlotsHave2000, true);
    });

    test('Diagnosis test: explains why old unallocated loop produced ₹29,993.40 and confirms fix', () => {
      // In the old unallocated loop:
      // 10 transactions totaling 24,000 were placed into months 1..10 (including 6,000 at month 4).
      // Then months 11 and 12 were missing, so the code added standardInstallment (2,000 each) as phantom deposits!
      // Total deposits in loop became 28,000!
      const monthlyRate = 0.01;
      let buggyBalance = 0;
      const unallocatedDeposits = [2000, 2000, 2000, 6000, 2000, 2000, 2000, 2000, 2000, 2000];
      for (let m = 1; m <= 12; m++) {
        const d = unallocatedDeposits[m - 1] !== undefined ? unallocatedDeposits[m - 1] : 2000;
        buggyBalance += d;
        buggyBalance += buggyBalance * monthlyRate;
      }
      assert.equal(buggyBalance.toFixed(2), '29993.40');

      // Now verify that the actual allocation algorithm eliminates this error:
      const accountData = createDepositPersonalLedgerRDAccountData();
      const fixedResult = recalculateRDWithRate(accountData, 12.0);
      assert.equal(fixedResult.maturityAmount, 25618.66);
      assert.equal(fixedResult.maturityAmount < 29993.4, true);
    });

    test('Missed installments without combined payment: does not add phantom money at the end', () => {
      // A customer opens a 12-month RD but only pays 10 installments of ₹2,000 (total = ₹20,000)
      // Months 11 and 12 are missed. The application MUST NOT add phantom deposits for months 11 and 12!
      const regularDates = [
        '14/10/2024', '14/11/2024', '14/12/2024', '14/01/2025',
        '14/02/2025', '14/03/2025', '14/04/2025', '14/05/2025',
        '14/06/2025', '14/07/2025',
      ];
      let bal = 0;
      const transactions = regularDates.map((dateStr, idx) => {
        bal += 2000;
        const [d, m, y] = dateStr.split('/').map(Number);
        return {
          rowNum: idx + 1,
          date: dateStr,
          depositDateObj: new Date(y, m - 1, d),
          particulars: `Monthly Installment #${idx + 1}`,
          paymentDebit: null,
          receiptCredit: 2000,
          rawReceiptCredit: 2000,
          balance: bal,
          intPaid: null,
          isSummaryRow: false,
          isValidPayment: true,
        };
      });

      const underPaidAccount: RDAccountData = {
        fileName: 'Customer_Missed_Installments.xlsx',
        fileSize: 28000,
        sheetName: 'DepositPersonalLedgerRD',
        customerName: 'Customer with Missed Installments',
        accountNumber: 'RD-MISSED-10',
        rdType: 'Monthly RD',
        openingDate: '14/10/2024',
        maturityDate: '14/10/2025',
        interestRate: '12%',
        annualRate: 0.12,
        selectedInterestRate: 12,
        status: 'Active',
        period: '12 Months',
        schemeAmount: 2000,
        tenureDays: 365,
        transactions,
        totalDeposited: 20000,
        profitEligibleAmount: 20000,
        nonProfitAmount: 0,
        dailySchemeAmount: 0,
        normalizedDailyAmount: 0,
        totalInterest: 0,
        maturityAmount: 20000,
        validTransactionCount: 10,
        hasSummaryRow: false,
        returnRate: 12,
        returnAmount: 0,
      };

      const result = recalculateRDWithRate(underPaidAccount, 12.0);
      assert.equal(result.totalDeposited, 20000);
      assert.equal(result.installmentsPaid, 10);
      assert.equal(result.missedInstallmentsCount, 2);

      // Verify months 11 and 12 have allocatedAmount = 0
      assert.equal(result.installmentSchedule?.[10].allocatedAmount, 0);
      assert.equal(result.installmentSchedule?.[11].allocatedAmount, 0);
      assert.equal(result.installmentSchedule?.[10].status, 'missed');
      assert.equal(result.installmentSchedule?.[11].status, 'missed');

      // Interest only earned on money actually deposited
      assert.ok(result.maturityAmount < 25618.66);
    });

    test('Maturity Rollover Rule: divides applicable maturity amount by months to form calculation base and prevents double-counting', () => {
      // When a matured RD amount (e.g. ₹25,618.66) is used as the basis for a subsequent 12-month calculation:
      const originalMaturity = 25618.66;
      const originalPrincipal = 24000.0;
      const originalInterest = 1618.66;

      const rollover = calculateMaturityRollover(
        originalMaturity,
        12,
        12.0,
        originalPrincipal,
        originalInterest
      );

      // 1. Monthly calculation base = 25,618.66 / 12 = 2,134.888...
      assert.equal(rollover.subsequentTenureMonths, 12);
      assert.equal(rollover.monthlyCalculationBase, 2134.89);
      assert.equal(rollover.originalPrincipal, 24000.0);
      assert.equal(rollover.originalInterest, 1618.66);
      assert.equal(rollover.originalMaturityAmount, 25618.66);

      // 2. Compounding for 12 months with monthlyCalculationBase @ 12% p.a.
      // 2134.88833 * 12 = 25618.66
      // Subsequent maturity amount > original maturity amount
      assert.ok(rollover.subsequentMaturityAmount > originalMaturity);
      assert.ok(rollover.subsequentTotalInterest > 0);
      // Verify clean segregation (no double-counting)
      assert.equal(
        roundMoney(rollover.originalMaturityAmount + rollover.subsequentTotalInterest),
        rollover.subsequentMaturityAmount
      );
    });
  });
});
