/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import * as XLSX from 'xlsx';
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
import {
  parseRDLedgerWorkbook,
  detectDaySheetHeader,
  parseDaySheetRows,
  selectDaySheetCustomer,
  calculateDailyRDNonProfitMaturity,
  determineDailyInstallment,
  roundMaturityY,
  RDValidationError,
  isCollectionTransaction,
  getTransactionDate,
} from '../src/utils/excelParser';
import type { RDAccountData, LedgerTransactionRow } from '../src/types';

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

  // =========================================================================
  // 6. Branch Day Sheet Workbook Format & Daily RD Non-Profit 90-Day Rule
  // =========================================================================
  describe('6. Branch Day Sheet Workbook Parsing & Daily RD Non-Profit Rules', () => {
    // Helper to generate a mock Day Sheet ArrayBuffer with SheetJS
    function createMockDaySheetWorkbook(): ArrayBuffer {
      const wb = XLSX.utils.book_new();

      // Summary sheet 1: TOTAL BUSINESS (contains broken formula / summary)
      const wsTotalBusiness = XLSX.utils.aoa_to_sheet([
        ['TOTAL BUSINESS SUMMARY'],
        ['TOTAL COLLECTIONS', '#REF!'],
      ]);
      XLSX.utils.book_append_sheet(wb, wsTotalBusiness, 'TOTAL BUSINESS');

      // Summary sheet 2: AGENT REPORT
      const wsAgentReport = XLSX.utils.aoa_to_sheet([
        ['AGENT REPORT'],
        ['TOTAL COMMISSIONS', '#REF!'],
      ]);
      XLSX.utils.book_append_sheet(wb, wsAgentReport, 'AGENT REPORT');

      // Main transaction worksheet: Sheet2
      // Row 1: Org heading
      // Row 2: Day Sheet title
      // Row 3: Headers
      // Row 4 onward: Transactions
      const sheet2Rows: any[][] = [
        ['ABC URBAN NIDHI LIMITED - KOCHI BRANCH'],
        ['BRANCH DAY SHEET REPORT'],
        ['DATE', 'MEMBERSHIP ID', 'CUSTOMER NAME', 'NEW/BOND NO', 'SCHEME NAME & PLAN', 'AMOUNT', 'NATURE OF RECEIPT'],
      ];

      // Add 200 daily deposits of ₹100 for SOJAN SUNNY starting 01/01/2025
      const baseDate = new Date(2025, 0, 1);
      for (let i = 0; i < 200; i++) {
        const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + i);
        const dayStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        sheet2Rows.push([
          dayStr,
          'M-10293',
          'SOJAN SUNNY',
          'BOND-8821',
          'DAILY RD - 365 DAYS',
          100,
          'DAILY RD RECEIPT',
        ]);
      }

      // Add a non-RD entry that should be discarded (e.g. loan repayment)
      sheet2Rows.push([
        '15/05/2025',
        'M-10293',
        'SOJAN SUNNY',
        'BOND-8821',
        'LOAN ACCOUNT',
        5000,
        'LOAN RECOVERY',
      ]);

      // Add records for another customer (ANIL KUMAR) in the same Day Sheet
      for (let i = 0; i < 50; i++) {
        const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + i);
        const dayStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        sheet2Rows.push([
          dayStr,
          'M-55102',
          'ANIL KUMAR',
          'BOND-9900',
          'DRD 200',
          200,
          'COLLECTION',
        ]);
      }

      const wsSheet2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
      XLSX.utils.book_append_sheet(wb, wsSheet2, 'Sheet2');

      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      return buf;
    }

    test('Header detection: detectDaySheetHeader recognizes normalized column headers in Day Sheet', () => {
      const headers = ['DATE', 'MEMBERSHIP ID', 'CUSTOMER NAME', 'NEW/BOND NO', 'SCHEME NAME & PLAN', 'AMOUNT', 'NATURE OF RECEIPT'];
      const cols = detectDaySheetHeader(headers);
      assert.ok(cols);
      assert.equal(cols?.dateCol, 0);
      assert.equal(cols?.membershipIdCol, 1);
      assert.equal(cols?.customerNameCol, 2);
      assert.equal(cols?.bondNoCol, 3);
      assert.equal(cols?.schemeCol, 4);
      assert.equal(cols?.amountCol, 5);
      assert.equal(cols?.natureCol, 6);
    });

    test('Workbook parser supports Day Sheet format and ignores summary sheets with #REF!', () => {
      const data = createMockDaySheetWorkbook();
      const parsed = parseRDLedgerWorkbook(data, 'SOJAN SUNNY(2).xlsx', data.byteLength);

      assert.equal(parsed.rdType, 'Daily RD');
      assert.equal(parsed.customerName, 'SOJAN SUNNY');
      assert.equal(parsed.accountNumber, 'BOND-8821');
      assert.equal(parsed.sheetName, 'Sheet2');
      assert.equal(parsed.isDaySheet, true);

      // Verify non-RD transaction was discarded and only the 200 RD deposits of ₹100 are counted
      assert.equal(parsed.validTransactionCount, 200);
      assert.equal(parsed.totalDeposited, 20000.0);
      assert.equal(parsed.dailySchemeAmount, 100);

      // Multi-customer detection
      assert.ok(parsed.daySheetCustomers);
      assert.equal(parsed.daySheetCustomers?.length, 2);
      const customerNames = parsed.daySheetCustomers?.map((c) => c.customerName);
      assert.ok(customerNames?.includes('SOJAN SUNNY'));
      assert.ok(customerNames?.includes('ANIL KUMAR'));
    });

    test('Customer isolation & switching: filters records per selected customer', () => {
      const data = createMockDaySheetWorkbook();
      const parsed = parseRDLedgerWorkbook(data, 'SOJAN SUNNY(2).xlsx', data.byteLength);

      // Switch to ANIL KUMAR
      const anilData = selectDaySheetCustomer(parsed, 'ANIL KUMAR');
      assert.equal(anilData.customerName, 'ANIL KUMAR');
      assert.equal(anilData.accountNumber, 'BOND-9900');
      assert.equal(anilData.validTransactionCount, 50);
      assert.equal(anilData.totalDeposited, 10000.0);
      assert.equal(anilData.dailySchemeAmount, 200);
    });

    test('Daily RD non-profit 90-day calculation: excess deposits in final 90 days create non-profit amount A', () => {
      // 1. First installment on 01/01/2025.
      // 2. Tenure = 365 days -> Maturity Date = 01/01/2026.
      // 3. Final 90-day window starts at maturityDate - 89 days.
      // 4. Daily installment = ₹100.
      // 5. Required final-90-day amount = 100 * 90 = ₹9,000.
      // Customer deposited 200 installments of ₹100 before final 90 days (₹20,000)
      // and deposited ₹12,000 inside final 90 days (120 deposits of ₹100).
      // Total actual deposits = 20,000 + 12,000 = ₹32,000.
      // Actual in final 90 days = ₹12,000.
      // Excess in final 90 days A = 12,000 - 9,000 = ₹3,000 (Non-Profit).
      // Profit-eligible principal X = 32,000 - 3,000 = ₹29,000.
      const txns: any[] = [];
      const baseDate = new Date(2025, 0, 1);
      const maturityDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 365);
      const periodStart = new Date(maturityDate.getFullYear(), maturityDate.getMonth(), maturityDate.getDate() - 89);

      // 200 deposits before final 90 days (days 0..199)
      for (let i = 0; i < 200; i++) {
        const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + i);
        txns.push({
          rowNum: i + 1,
          date: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
          depositDateObj: d,
          particulars: 'Daily RD',
          receiptCredit: 100,
          rawReceiptCredit: 100,
          isValidPayment: true,
          isSummaryRow: false,
        });
      }

      // 120 deposits inside final 90 days (all within final 90 days)
      for (let i = 0; i < 120; i++) {
        const dayOffset = Math.min(i % 89, 89);
        const d = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate() + dayOffset);
        txns.push({
          rowNum: 201 + i,
          date: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
          depositDateObj: d,
          particulars: 'Daily RD',
          receiptCredit: 100,
          rawReceiptCredit: 100,
          isValidPayment: true,
          isSummaryRow: false,
        });
      }

      const totalDeposited = txns.reduce((sum, t) => sum + t.receiptCredit, 0);
      assert.equal(totalDeposited, 32000);

      const res = calculateDailyRDNonProfitMaturity(txns, totalDeposited, 100, 12.0, 365);
      assert.equal(res.dailySchemeAmount, 100);
      assert.equal(res.actualFinal90DayDeposits, 12000);
      assert.equal(res.required90DayAmount, 9000);
      assert.equal(res.nonProfitAmount, 3000);
      assert.equal(res.profitEligibleAmount, 29000);
      assert.equal(roundMoney(res.profitEligibleAmount + res.nonProfitAmount), totalDeposited);

      // Verify interest Y calculated on X using company Excel formula and final rounding
      const expectedCalc = calculateDailyRDMaturity(365, res.profitEligibleAmount / 365, 12.0);
      const expectedRawY = expectedCalc.rawMaturityAmount || 0;
      const expectedRoundedY = roundMaturityY(expectedRawY);
      assert.equal(res.calculationResultY, roundMoney(expectedRawY));
      assert.equal(res.roundedY, expectedRoundedY);
      assert.equal(res.maturityAmount, roundMoney(expectedRoundedY + res.nonProfitAmount));
    });

    test('User Validation Example: ₹100/day, 365d, Total ₹36,500, Final-90d ₹16,000 -> A ₹7,000, X ₹29,500, Y ₹31,337.55, Rounded Y ₹31,338, Maturity ₹38,338', () => {
      // Step 1: First installment date 01/01/2025 -> maturity date 01/01/2026 (+365 days)
      // Step 2: Final 90-day period ending on maturity date (04/10/2025 to 01/01/2026 inclusive)
      // Step 3: Required Amount = 100 * 90 = 9000
      // Step 4: Actual deposits in final 90 days = 16000 -> A = MAX(0, 16000 - 9000) = 7000
      // Step 5: X = 36500 - 7000 = 29500
      // Step 6: Y = 31337.55
      // Step 7: Rounded Y = 31338
      // Step 8: Final Maturity Amount = 31338 + 7000 = 38338
      const baseDate = new Date(2025, 0, 1);
      const maturityDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 365);
      const periodStart = new Date(maturityDate.getFullYear(), maturityDate.getMonth(), maturityDate.getDate() - 89);

      const txns: any[] = [];
      // 205 deposits of ₹100 before the final 90 days = ₹20,500
      for (let i = 0; i < 205; i++) {
        const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + i);
        txns.push({
          rowNum: i + 1,
          date: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
          depositDateObj: d,
          particulars: 'Daily RD',
          receiptCredit: 100,
          rawReceiptCredit: 100,
          isValidPayment: true,
          isSummaryRow: false,
        });
      }

      // Deposits totaling ₹16,000 during the final 90 days (160 deposits of ₹100)
      for (let i = 0; i < 160; i++) {
        const dayOffset = Math.min(i % 89, 89);
        const d = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate() + dayOffset);
        txns.push({
          rowNum: 206 + i,
          date: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
          depositDateObj: d,
          particulars: 'Daily RD',
          receiptCredit: 100,
          rawReceiptCredit: 100,
          isValidPayment: true,
          isSummaryRow: false,
        });
      }

      const totalDeposited = txns.reduce((sum, t) => sum + t.receiptCredit, 0);
      assert.equal(totalDeposited, 36500);

      const res = calculateDailyRDNonProfitMaturity(txns, totalDeposited, 100, 12.0, 365);
      assert.equal(res.normalizedDailyAmount, 100);
      assert.equal(res.required90DayAmount, 9000);
      assert.equal(res.actualFinal90DayDeposits, 16000);
      assert.equal(res.nonProfitAmount, 7000);
      assert.equal(res.profitEligibleAmount, 29500);
      assert.equal(res.calculationResultY, 31337.55);
      assert.equal(res.roundedY, 31338);
      assert.equal(res.maturityAmount, 38338);
      assert.equal(res.totalInterest, 1838);

      // Verify transparent dailyRDAdjustment breakdown structure
      assert.equal(res.dailyRDAdjustment.totalActualDeposits, 36500);
      assert.equal(res.dailyRDAdjustment.actualFinal90DayDeposits, 16000);
      assert.equal(res.dailyRDAdjustment.required90DayAmount, 9000);
      assert.equal(res.dailyRDAdjustment.nonProfitAmountA, 7000);
      assert.equal(res.dailyRDAdjustment.adjustedPrincipalX, 29500);
      assert.equal(res.dailyRDAdjustment.calculationResultY, 31337.55);
      assert.equal(res.dailyRDAdjustment.roundedY, 31338);
      assert.equal(res.dailyRDAdjustment.finalMaturityAmount, 38338);

      // Verify recalculateRDWithRate preserves the exact calculation
      const account: RDAccountData = {
        fileName: 'test_validation.xlsx',
        fileSize: 1000,
        sheetName: 'Sheet1',
        customerName: 'Validation Customer',
        accountNumber: 'BOND-100',
        rdType: 'Daily RD',
        annualRate: 0.12,
        tenureDays: 365,
        totalDeposited: 36500,
        dailySchemeAmount: 100,
        profitEligibleAmount: 29500,
        nonProfitAmount: 7000,
        normalizedDailyAmount: 100,
        totalInterest: 1838,
        maturityAmount: 38338,
        validTransactionCount: txns.length,
        hasSummaryRow: false,
        transactions: txns,
      };

      const recalc = recalculateRDWithRate(account, 12.0);
      assert.equal(recalc.nonProfitAmount, 7000);
      assert.equal(recalc.profitEligibleAmount, 29500);
      assert.equal(recalc.calculationResultY, 31337.55);
      assert.equal(recalc.roundedY, 31338);
      assert.equal(recalc.maturityAmount, 38338);
      assert.equal(recalc.totalInterest, 1838);
    });

    // =========================================================================
    // Issue 4 Required Regression Tests (Scenarios 1-8)
    // =========================================================================
    test('Regression 1: Final 90-day deposits below required amount (A = 0, X = totalDepositsDuringPeriod)', () => {
      // Base installment: ₹100, tenure 365 days
      // Required 90-day amount = 100 * 90 = ₹9,000
      // 275 deposits of ₹100 prior to 90-day window = ₹27,500
      // 50 deposits of ₹100 inside 90-day window = ₹5,000 < ₹9,000
      // Total deposits = ₹32,500
      // actualFinal90DayDeposits = ₹5,000
      // A = Math.max(0, 5000 - 9000) = 0
      // X = 32,500 - 0 = 32,500
      const baseDate = new Date(2025, 0, 1);
      const maturityDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 365);
      const periodStart = new Date(maturityDate.getFullYear(), maturityDate.getMonth(), maturityDate.getDate() - 89);

      const txns: LedgerTransactionRow[] = [];
      for (let i = 0; i < 275; i++) {
        const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + i);
        txns.push({
          rowNum: i + 1,
          date: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
          depositDateObj: d,
          particulars: 'Daily RD',
          receiptCredit: 100,
          rawReceiptCredit: 100,
          isValidPayment: true,
          isSummaryRow: false,
        });
      }
      for (let i = 0; i < 50; i++) {
        const d = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate() + i);
        txns.push({
          rowNum: 276 + i,
          date: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
          depositDateObj: d,
          particulars: 'Daily RD',
          receiptCredit: 100,
          rawReceiptCredit: 100,
          isValidPayment: true,
          isSummaryRow: false,
        });
      }

      const totalDeposited = txns.reduce((sum, t) => sum + (t.receiptCredit || 0), 0);
      assert.equal(totalDeposited, 32500);

      const res = calculateDailyRDNonProfitMaturity(txns, totalDeposited, 100, 12.0, 365);
      assert.equal(res.actualFinal90DayDeposits, 5000);
      assert.equal(res.required90DayAmount, 9000);
      assert.equal(res.nonProfitAmount, 0); // A = 0
      assert.equal(res.profitEligibleAmount, 32500); // X = totalDepositsDuringPeriod
      assert.equal(res.depositsDuringRDPeriod, 32500);
      assert.equal(res.postMaturityDeposits, 0);
    });

    test('Regression 2: Final 90-day deposits equal to required amount (A = 0, X = totalDepositsDuringPeriod)', () => {
      // Required 90-day amount = 100 * 90 = ₹9,000
      // 275 deposits of ₹100 prior to 90-day window = ₹27,500
      // 90 deposits of ₹100 inside 90-day window = ₹9,000 = required
      // Total deposits = ₹36,500
      // actualFinal90DayDeposits = ₹9,000
      // A = Math.max(0, 9000 - 9000) = 0
      // X = 36,500 - 0 = 36,500
      const baseDate = new Date(2025, 0, 1);
      const maturityDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 365);
      const periodStart = new Date(maturityDate.getFullYear(), maturityDate.getMonth(), maturityDate.getDate() - 89);

      const txns: LedgerTransactionRow[] = [];
      for (let i = 0; i < 275; i++) {
        const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + i);
        txns.push({
          rowNum: i + 1,
          date: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
          depositDateObj: d,
          particulars: 'Daily RD',
          receiptCredit: 100,
          rawReceiptCredit: 100,
          isValidPayment: true,
          isSummaryRow: false,
        });
      }
      for (let i = 0; i < 90; i++) {
        const d = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate() + i);
        txns.push({
          rowNum: 276 + i,
          date: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
          depositDateObj: d,
          particulars: 'Daily RD',
          receiptCredit: 100,
          rawReceiptCredit: 100,
          isValidPayment: true,
          isSummaryRow: false,
        });
      }

      const totalDeposited = txns.reduce((sum, t) => sum + (t.receiptCredit || 0), 0);
      assert.equal(totalDeposited, 36500);

      const res = calculateDailyRDNonProfitMaturity(txns, totalDeposited, 100, 12.0, 365);
      assert.equal(res.actualFinal90DayDeposits, 9000);
      assert.equal(res.required90DayAmount, 9000);
      assert.equal(res.nonProfitAmount, 0); // A = 0
      assert.equal(res.profitEligibleAmount, 36500); // X = totalDepositsDuringPeriod
      assert.equal(res.depositsDuringRDPeriod, 36500);
      assert.equal(res.maturityAmount, 38774); // roundedY(38773.57) + 0 = 38774
    });

    test('Regression 3: Final 90-day deposits above required amount (A = actual - required > 0, X = total - A)', () => {
      // Required 90-day amount = 100 * 90 = ₹9,000
      // 200 deposits before final 90 days = ₹20,000
      // 140 deposits of ₹100 inside final 90 days = ₹14,000 > ₹9,000
      // Total deposits = ₹34,000
      // actualFinal90DayDeposits = ₹14,000
      // A = Math.max(0, 14000 - 9000) = ₹5,000
      // X = 34,000 - 5,000 = ₹29,000
      const baseDate = new Date(2025, 0, 1);
      const maturityDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 365);
      const periodStart = new Date(maturityDate.getFullYear(), maturityDate.getMonth(), maturityDate.getDate() - 89);

      const txns: LedgerTransactionRow[] = [];
      for (let i = 0; i < 200; i++) {
        const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + i);
        txns.push({
          rowNum: i + 1,
          date: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
          depositDateObj: d,
          particulars: 'Daily RD',
          receiptCredit: 100,
          rawReceiptCredit: 100,
          isValidPayment: true,
          isSummaryRow: false,
        });
      }
      for (let i = 0; i < 140; i++) {
        const dayOffset = Math.min(i % 89, 89);
        const d = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate() + dayOffset);
        txns.push({
          rowNum: 201 + i,
          date: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
          depositDateObj: d,
          particulars: 'Daily RD',
          receiptCredit: 100,
          rawReceiptCredit: 100,
          isValidPayment: true,
          isSummaryRow: false,
        });
      }

      const totalDeposited = txns.reduce((sum, t) => sum + (t.receiptCredit || 0), 0);
      assert.equal(totalDeposited, 34000);

      const res = calculateDailyRDNonProfitMaturity(txns, totalDeposited, 100, 12.0, 365);
      assert.equal(res.actualFinal90DayDeposits, 14000);
      assert.equal(res.required90DayAmount, 9000);
      assert.equal(res.nonProfitAmount, 5000); // A = 14000 - 9000 = 5000
      assert.equal(res.profitEligibleAmount, 29000); // X = 34000 - 5000 = 29000
      assert.equal(res.depositsDuringRDPeriod, 34000);
      assert.equal(roundMoney(res.profitEligibleAmount + res.nonProfitAmount), 34000);
    });

    test('Regression 4: Post-maturity deposits tracked separately, excluded from A and excluded from X', () => {
      // Customer makes deposits before final 90 days, inside final 90 days, and after maturity date.
      // Base: ₹100/day. Required: ₹9,000.
      // 100 deposits of ₹100 prior to final 90 days = ₹10,000
      // 90 deposits of ₹100 inside final 90 days = ₹9,000
      // 3 post-maturity deposits of ₹500 = ₹1,500 (dated 5, 10, 15 days after maturity date)
      // Total deposited = ₹20,500
      // Deposits during RD period = ₹19,000
      // Post-maturity deposits = ₹1,500
      // actualFinal90DayDeposits = ₹9,000 (does not include post-maturity deposits!)
      // A = Math.max(0, 9000 - 9000) = 0 (post-maturity deposits are NOT added to A!)
      // X = depositsDuringRDPeriod - A = 19,000 - 0 = ₹19,000
      const baseDate = new Date(2025, 0, 1);
      const maturityDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 365);
      const periodStart = new Date(maturityDate.getFullYear(), maturityDate.getMonth(), maturityDate.getDate() - 89);

      const txns: LedgerTransactionRow[] = [];
      for (let i = 0; i < 100; i++) {
        const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + i);
        txns.push({
          rowNum: i + 1,
          date: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
          depositDateObj: d,
          particulars: 'Daily RD Regular',
          receiptCredit: 100,
          rawReceiptCredit: 100,
          isValidPayment: true,
          isSummaryRow: false,
        });
      }
      for (let i = 0; i < 90; i++) {
        const d = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate() + i);
        txns.push({
          rowNum: 101 + i,
          date: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
          depositDateObj: d,
          particulars: 'Daily RD Final 90',
          receiptCredit: 100,
          rawReceiptCredit: 100,
          isValidPayment: true,
          isSummaryRow: false,
        });
      }
      // Post-maturity deposits
      for (let i = 1; i <= 3; i++) {
        const d = new Date(maturityDate.getFullYear(), maturityDate.getMonth(), maturityDate.getDate() + (i * 5));
        txns.push({
          rowNum: 191 + i,
          date: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
          depositDateObj: d,
          particulars: 'Post-maturity deposit',
          receiptCredit: 500,
          rawReceiptCredit: 500,
          isValidPayment: true,
          isSummaryRow: false,
        });
      }

      const totalDeposited = txns.reduce((sum, t) => sum + (t.receiptCredit || 0), 0);
      assert.equal(totalDeposited, 20500);

      const res = calculateDailyRDNonProfitMaturity(txns, totalDeposited, 100, 12.0, 365);
      assert.equal(res.actualFinal90DayDeposits, 9000);
      assert.equal(res.required90DayAmount, 9000);
      assert.equal(res.postMaturityDeposits, 1500); // Tracked separately
      assert.equal(res.nonProfitAmount, 0); // Strictly A = max(0, 9000 - 9000) = 0
      assert.equal(res.depositsDuringRDPeriod, 19000);
      assert.equal(res.profitEligibleAmount, 19000); // X excluded post-maturity deposits
    });

    test('Regression 5: Multiple payments on the same date aggregated into final 90-day deposits', () => {
      // All eligible customer deposits on the same date within the 90-day window are aggregated toward actualFinal90DayDeposits
      const baseDate = new Date(2025, 0, 1);
      const maturityDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 365);
      const periodStart = new Date(maturityDate.getFullYear(), maturityDate.getMonth(), maturityDate.getDate() - 89);

      const txns: LedgerTransactionRow[] = [];
      for (let i = 0; i < 100; i++) {
        const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + i);
        txns.push({
          rowNum: i + 1,
          date: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
          depositDateObj: d,
          particulars: 'Daily RD',
          receiptCredit: 100,
          rawReceiptCredit: 100,
          isValidPayment: true,
          isSummaryRow: false,
        });
      }

      // Inside final 90 days: 3 distinct payments on the exact same date
      const sameDay = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate() + 10);
      txns.push({
        rowNum: 101,
        date: `${sameDay.getDate()}/${sameDay.getMonth() + 1}/${sameDay.getFullYear()}`,
        depositDateObj: sameDay,
        particulars: 'Payment 1',
        receiptCredit: 500,
        rawReceiptCredit: 500,
        isValidPayment: true,
        isSummaryRow: false,
      });
      txns.push({
        rowNum: 102,
        date: `${sameDay.getDate()}/${sameDay.getMonth() + 1}/${sameDay.getFullYear()}`,
        depositDateObj: sameDay,
        particulars: 'Payment 2',
        receiptCredit: 1000,
        rawReceiptCredit: 1000,
        isValidPayment: true,
        isSummaryRow: false,
      });
      txns.push({
        rowNum: 103,
        date: `${sameDay.getDate()}/${sameDay.getMonth() + 1}/${sameDay.getFullYear()}`,
        depositDateObj: sameDay,
        particulars: 'Payment 3',
        receiptCredit: 1500,
        rawReceiptCredit: 1500,
        isValidPayment: true,
        isSummaryRow: false,
      });

      const totalDeposited = txns.reduce((sum, t) => sum + (t.receiptCredit || 0), 0);
      assert.equal(totalDeposited, 13000);

      const res = calculateDailyRDNonProfitMaturity(txns, totalDeposited, 100, 12.0, 365);
      // All 3 payments on same day aggregated: 500 + 1000 + 1500 = 3000
      assert.equal(res.actualFinal90DayDeposits, 3000);
      assert.equal(res.required90DayAmount, 9000);
      assert.equal(res.nonProfitAmount, 0); // 3000 <= 9000
    });

    test('Regression 6: Combined and irregular deposits: determineDailyInstallment correctly identifies base installment', () => {
      // Customer makes combined deposits (e.g. ₹500, ₹1000, ₹2000).
      // Test A: Explicit configured scheme installment amount takes priority
      const txnsCombined: LedgerTransactionRow[] = [
        {
          rowNum: 1,
          date: '01/01/2025',
          depositDateObj: new Date(2025, 0, 1),
          particulars: 'RD Collection',
          receiptCredit: 500,
          rawReceiptCredit: 500,
          isValidPayment: true,
          isSummaryRow: false,
        },
        {
          rowNum: 2,
          date: '10/01/2025',
          depositDateObj: new Date(2025, 0, 10),
          particulars: 'RD Collection',
          receiptCredit: 1000,
          rawReceiptCredit: 1000,
          isValidPayment: true,
          isSummaryRow: false,
        },
        {
          rowNum: 3,
          date: '20/01/2025',
          depositDateObj: new Date(2025, 0, 20),
          particulars: 'RD Collection',
          receiptCredit: 500,
          rawReceiptCredit: 500,
          isValidPayment: true,
          isSummaryRow: false,
        },
      ];

      // When configuredSchemeAmount is passed (e.g. 100), prioritize it over the mode (500)
      const detectedConfigured = determineDailyInstallment(txnsCombined, 2000, 365, 100);
      assert.equal(detectedConfigured, 100);

      // Test B: When particulars mention installment count (e.g. "₹500 - 5 installments", "₹1,000 - 10 installments")
      const txnsWithCount: LedgerTransactionRow[] = [
        {
          rowNum: 1,
          date: '01/01/2025',
          depositDateObj: new Date(2025, 0, 1),
          particulars: '₹500 - 5 installments',
          receiptCredit: 500,
          rawReceiptCredit: 500,
          isValidPayment: true,
          isSummaryRow: false,
        },
        {
          rowNum: 2,
          date: '10/01/2025',
          depositDateObj: new Date(2025, 0, 10),
          particulars: '₹1,000 - 10 installments',
          receiptCredit: 1000,
          rawReceiptCredit: 1000,
          isValidPayment: true,
          isSummaryRow: false,
        },
      ];
      const detectedCount = determineDailyInstallment(txnsWithCount, 1500, 365);
      assert.equal(detectedCount, 100);

      // Test C: When particulars contain DRD 100
      const txnsDRD: LedgerTransactionRow[] = [
        {
          rowNum: 1,
          date: '01/01/2025',
          depositDateObj: new Date(2025, 0, 1),
          particulars: 'DRD 100 combined payment',
          receiptCredit: 1000,
          rawReceiptCredit: 1000,
          isValidPayment: true,
          isSummaryRow: false,
        },
      ];
      const detectedDRD = determineDailyInstallment(txnsDRD, 1000, 365);
      assert.equal(detectedDRD, 100);

      // Verify that with base installment ₹100, required 90-day amount is 100 * 90 = 9000, not 500 * 90 = 45000!
      const res = calculateDailyRDNonProfitMaturity(txnsWithCount, 1500, detectedCount, 12.0, 365);
      assert.equal(res.normalizedDailyAmount, 100);
      assert.equal(res.required90DayAmount, 9000);
    });

    test('Regression 7: Skipped installments do NOT shift maturity date or 90-day window', () => {
      // First installment on 01/01/2025
      const firstDate = new Date(2025, 0, 1);
      const expectedMaturityDate = new Date(2025, 0, 1 + 365); // 01/01/2026
      const expectedPeriodStart = new Date(expectedMaturityDate.getFullYear(), expectedMaturityDate.getMonth(), expectedMaturityDate.getDate() - 89);

      const txns: LedgerTransactionRow[] = [];
      // Day 1 deposit
      txns.push({
        rowNum: 1,
        date: '01/01/2025',
        depositDateObj: firstDate,
        particulars: 'Daily RD',
        receiptCredit: 100,
        rawReceiptCredit: 100,
        isValidPayment: true,
        isSummaryRow: false,
      });

      // Customer skips 60 days (no payments from day 2 to day 61)
      // Resumes on day 62 (04/03/2025)
      for (let i = 62; i < 200; i++) {
        const d = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate() + i);
        txns.push({
          rowNum: txns.length + 1,
          date: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
          depositDateObj: d,
          particulars: 'Daily RD',
          receiptCredit: 100,
          rawReceiptCredit: 100,
          isValidPayment: true,
          isSummaryRow: false,
        });
      }

      const totalDeposited = txns.reduce((sum, t) => sum + (t.receiptCredit || 0), 0);
      const res = calculateDailyRDNonProfitMaturity(txns, totalDeposited, 100, 12.0, 365);

      // Verify maturity date remains strictly firstInstallmentDate + 365 days
      assert.equal(res.maturityDateObj.getTime(), expectedMaturityDate.getTime());
      assert.equal(res.periodStartObj.getTime(), expectedPeriodStart.getTime());
    });

    test('Regression 8: Monthly RD calculation remains strictly unchanged and accurate', () => {
      // Monthly RD standard test case: ₹2,000 monthly, 12 months, 12% p.a.
      // Expected maturity: ₹25,618.65608665788 -> ₹25,618.66
      // Expected interest: ₹1,618.65608665788 -> ₹1,618.66
      const monthlyRes = calculateMonthlyRDMaturity(12, 2000, 12.0);
      assert.equal(monthlyRes.isValid, true);
      assert.equal(monthlyRes.rawMaturityAmount, 25618.65608665788);
      assert.equal(monthlyRes.maturityAmount, 25618.66);
      assert.equal(monthlyRes.totalDeposited, 24000.0);
      assert.equal(monthlyRes.totalInterest, 1618.66);

      // Verify DepositPersonalLedgerRD ledger calculation remains intact
      const accountData = createDepositPersonalLedgerRDAccountData();
      const ledgerResult = recalculateRDWithRate(accountData, 12.0);
      assert.equal(ledgerResult.totalDeposited, 24000.0);
      assert.equal(ledgerResult.maturityAmount, 25618.66);
      assert.equal(ledgerResult.totalInterest, 1618.66);
    });

    test('Informative validation error on invalid workbook format', () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['RANDOM TEXT', 'NO HEADERS HERE'],
        ['123', '456'],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'RandomSheet');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      assert.throws(
        () => parseRDLedgerWorkbook(buf, 'invalid.xlsx', buf.byteLength),
        (err: any) => {
          assert.equal(err.name, 'RDValidationError');
          assert.ok(err.message.includes('Expected transaction headers'));
          return true;
        }
      );
    });

    test('Conventional RD Personal Ledger continues to parse without regression', () => {
      // Create a conventional Personal Ledger workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['Customer Name:', 'RAMESH KUMAR', '', 'Account No:', 'RD-99120'],
        ['RD Type:', 'Monthly RD', '', 'Period:', '12 Months'],
        ['Opening Date:', '01/01/2025', '', 'Maturity Date:', '01/01/2026'],
        ['Date', 'Particulars', 'Payment / Debit', 'Receipt / Credit', 'Balance', 'Int Paid'],
        ['01/01/2025', 'INSTALLMENT 1', '', 2000, 2000, ''],
        ['01/02/2025', 'INSTALLMENT 2', '', 2000, 4000, ''],
        ['01/03/2025', 'INSTALLMENT 3', '', 2000, 6000, ''],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'DepositPersonalLedgerRD');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      const parsed = parseRDLedgerWorkbook(buf, 'DepositPersonalLedgerRD.xlsx', buf.byteLength);
      assert.equal(parsed.customerName, 'RAMESH KUMAR');
      assert.equal(parsed.accountNumber, 'RD-99120');
      assert.equal(parsed.rdType, 'Monthly RD');
      assert.equal(parsed.validTransactionCount, 3);
      assert.equal(parsed.totalDeposited, 6000);
    });

    // =========================================================================
    // DAILY RD FINAL 90-DAY COLLECTION SUM AND NON-PROFIT ADJUSTMENT SUITE
    // =========================================================================
    describe('Daily RD Final 90-Day Collection Sum and Non-Profit Adjustment', () => {
      test('Validation Case: SOJAN SUNNY exact figures (16 collections of ₹1,000 = ₹16,000)', () => {
        // Customer: SOJAN SUNNY, Bond: 38091068, Daily Installment: ₹100, Rate: 12%, Tenure: 365 days
        // Start date: 01/01/2025 -> Maturity date: 01/01/2026 (firstDate + 365 days)
        // Final 90-day window: 03/10/2025 to 01/01/2026 (89 days before maturity through maturity date)
        const startDate = new Date(2025, 0, 1);
        const maturityDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 365);
        const final90DayStart = new Date(maturityDate.getFullYear(), maturityDate.getMonth(), maturityDate.getDate() - 89);

        const txns: LedgerTransactionRow[] = [];

        // 1. Initial deposits before final 90 days totaling ₹20,500 (36,500 - 16,000)
        // e.g. 205 payments of ₹100 from day 0 to day 204
        for (let i = 0; i < 205; i++) {
          const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
          txns.push({
            rowNum: txns.length + 1,
            date: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
            depositDateObj: d,
            particulars: 'Daily RD Installment',
            receiptNumber: `REC-PRE-${i + 1}`,
            receiptCredit: 100,
            rawReceiptCredit: 100,
            isValidPayment: true,
            isSummaryRow: false,
            type: 'COLLECTION',
          });
        }

        // 2. 16 qualifying collection transactions of ₹1,000 each in the final 90-day window = ₹16,000
        for (let i = 0; i < 16; i++) {
          // Spread inside final 90 days (between final90DayStart and maturityDate)
          const d = new Date(final90DayStart.getFullYear(), final90DayStart.getMonth(), final90DayStart.getDate() + (i * 5));
          assert.ok(d >= final90DayStart && d <= maturityDate, 'Must be within final 90 days');
          txns.push({
            rowNum: txns.length + 1,
            date: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
            depositDateObj: d,
            particulars: 'RD COLLECTION DEPOSIT',
            receiptNumber: `REC-COL-${1000 + i}`,
            receiptCredit: 1000,
            rawReceiptCredit: 1000,
            isValidPayment: true,
            isSummaryRow: false,
            type: 'COLLECTION',
          });
        }

        const totalDeposited = txns.reduce((sum, t) => sum + (t.receiptCredit || 0), 0);
        assert.equal(totalDeposited, 36500, 'Total actual deposits must be ₹36,500');

        const result = calculateDailyRDNonProfitMaturity(txns, totalDeposited, 100, 12.0, 365);

        // 1. Total actual deposits = ₹36,500
        assert.equal(result.totalActualDeposited, 36500);

        // 2. Number of qualifying final 90-day collection transactions = 16
        assert.equal(result.final90DayCollectionCount, 16);

        // 3. Actual Deposits in Final 90 Days = ₹16,000 (16 * ₹1,000)
        assert.equal(result.actualFinal90DayDeposits, 16000);

        // 4. Required Amount for Final 90 Days = 100 * 90 = ₹9,000
        assert.equal(result.required90DayAmount, 9000);

        // 5. Non-Profit Amount (A) = MAX(0, 16000 - 9000) = ₹7,000
        assert.equal(result.nonProfitAmountA, 7000);

        // 6. Adjusted Principal (X) = 36500 - 7000 = ₹29,500
        assert.equal(result.adjustedPrincipalX, 29500);

        // 7. Maturity Calculation Result (Y) = ₹31,337.55 (exact raw 31337.546733249837)
        assert.equal(result.calculationResultY, 31337.55);

        // 8. Rounded Maturity Amount = ₹31,338
        assert.equal(result.roundedY, 31338);

        // 9. Final Maturity Amount = 31338 + 7000 = ₹38,338
        assert.equal(result.finalMaturityAmount, 38338);
      });

      test('Multiple collections on the same date are all summed without dropping any', () => {
        // Customer has 5 collections of ₹1,000 on the EXACT same date in the final 90 days
        const startDate = new Date(2025, 0, 1);
        const maturityDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 365);
        const sameDayInFinal90 = new Date(maturityDate.getFullYear(), maturityDate.getMonth(), maturityDate.getDate() - 20);

        const txns: LedgerTransactionRow[] = [
          {
            rowNum: 1,
            date: '01/01/2025',
            depositDateObj: startDate,
            receiptCredit: 10000,
            rawReceiptCredit: 10000,
            isValidPayment: true,
            isSummaryRow: false,
            receiptNumber: 'REC-001',
            particulars: 'Daily RD Opening',
            type: 'COLLECTION',
          },
        ];

        // 5 distinct transactions on the same date
        for (let i = 1; i <= 5; i++) {
          txns.push({
            rowNum: i + 1,
            date: '12/12/2025',
            depositDateObj: sameDayInFinal90,
            receiptCredit: 1000,
            rawReceiptCredit: 1000,
            receiptNumber: `SAME-DAY-REC-${i}`,
            isValidPayment: true,
            isSummaryRow: false,
            particulars: `Batch collection payment #${i}`,
            type: 'COLLECTION',
          });
        }

        const totalDeposited = txns.reduce((s, t) => s + (t.receiptCredit || 0), 0); // 15,000
        const result = calculateDailyRDNonProfitMaturity(txns, totalDeposited, 50, 12.0, 365);

        // All 5 transactions on the same day must be counted!
        assert.equal(result.final90DayCollectionCount, 5);
        assert.equal(result.actualFinal90DayDeposits, 5000);
        // Required = 50 * 90 = 4,500
        assert.equal(result.required90DayAmount, 4500);
        // A = 5,000 - 4,500 = 500
        assert.equal(result.nonProfitAmountA, 500);
        // X = 15,000 - 500 = 14,500
        assert.equal(result.adjustedPrincipalX, 14500);
      });

      test('Multiple collections across different dates are accurately accumulated', () => {
        const startDate = new Date(2025, 0, 1);
        const maturityDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 365);
        const final90DayStart = new Date(maturityDate.getFullYear(), maturityDate.getMonth(), maturityDate.getDate() - 89);

        const txns: LedgerTransactionRow[] = [
          {
            rowNum: 1,
            date: '01/01/2025',
            depositDateObj: startDate,
            receiptCredit: 5000,
            rawReceiptCredit: 5000,
            receiptNumber: 'REC-OPEN',
            particulars: 'Daily RD Opening',
            isValidPayment: true,
            isSummaryRow: false,
            type: 'COLLECTION',
          },
        ];
        // 8 collections of ₹2,000 on 8 different days within the final 90 days
        for (let i = 0; i < 8; i++) {
          const d = new Date(final90DayStart.getFullYear(), final90DayStart.getMonth(), final90DayStart.getDate() + (i * 10));
          txns.push({
            rowNum: txns.length + 1,
            date: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
            depositDateObj: d,
            receiptCredit: 2000,
            rawReceiptCredit: 2000,
            receiptNumber: `DIFF-DATE-${i + 1}`,
            particulars: 'Daily RD Collection',
            isValidPayment: true,
            isSummaryRow: false,
            type: 'COLLECTION',
          });
        }

        const totalDeposited = 21000;
        const result = calculateDailyRDNonProfitMaturity(txns, totalDeposited, 100, 12.0, 365);
        assert.equal(result.final90DayCollectionCount, 8);
        assert.equal(result.actualFinal90DayDeposits, 16000);
        assert.equal(result.required90DayAmount, 9000);
        assert.equal(result.nonProfitAmountA, 7000);
      });

      test('Transactions before the 90-day period are excluded from 90-day collection sum', () => {
        const startDate = new Date(2025, 0, 1);
        const maturityDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 365);
        const final90DayStart = new Date(maturityDate.getFullYear(), maturityDate.getMonth(), maturityDate.getDate() - 89);

        // Date 1 day before the final 90-day window
        const dayBefore90 = new Date(final90DayStart.getFullYear(), final90DayStart.getMonth(), final90DayStart.getDate() - 1);

        const txns: LedgerTransactionRow[] = [
          {
            rowNum: 1,
            date: '01/01/2025',
            depositDateObj: startDate,
            receiptCredit: 5000,
            rawReceiptCredit: 5000,
            particulars: 'Daily RD Opening',
            isValidPayment: true,
            isSummaryRow: false,
            type: 'COLLECTION',
          },
          {
            rowNum: 2,
            date: `${dayBefore90.getDate()}/${dayBefore90.getMonth() + 1}/${dayBefore90.getFullYear()}`,
            depositDateObj: dayBefore90,
            receiptCredit: 5000,
            rawReceiptCredit: 5000,
            particulars: 'Daily RD Early Payment',
            isValidPayment: true,
            isSummaryRow: false,
            type: 'COLLECTION',
          },
          {
            rowNum: 3,
            date: `${final90DayStart.getDate()}/${final90DayStart.getMonth() + 1}/${final90DayStart.getFullYear()}`,
            depositDateObj: final90DayStart, // On start date (inclusive)
            receiptCredit: 2000,
            rawReceiptCredit: 2000,
            particulars: 'Daily RD Final 90 Day Payment',
            isValidPayment: true,
            isSummaryRow: false,
            type: 'COLLECTION',
          },
        ];

        const totalDeposited = 12000;
        const result = calculateDailyRDNonProfitMaturity(txns, totalDeposited, 50, 12.0, 365);

        // Only rowNum 3 is within the final 90 days!
        assert.equal(result.final90DayCollectionCount, 1);
        assert.equal(result.actualFinal90DayDeposits, 2000);
        assert.equal(result.totalActualDeposited, 12000);
      });

      test('Transactions after maturity are excluded from 90-day sum and A, tracked in postMaturityDeposits', () => {
        const startDate = new Date(2025, 0, 1);
        const maturityDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 365);
        const afterMaturityDate = new Date(maturityDate.getFullYear(), maturityDate.getMonth(), maturityDate.getDate() + 5);

        const txns: LedgerTransactionRow[] = [
          {
            rowNum: 1,
            date: '01/01/2025',
            depositDateObj: startDate,
            receiptCredit: 10000,
            rawReceiptCredit: 10000,
            particulars: 'Daily RD Opening',
            isValidPayment: true,
            isSummaryRow: false,
            type: 'COLLECTION',
          },
          {
            rowNum: 2,
            date: `${maturityDate.getDate()}/${maturityDate.getMonth() + 1}/${maturityDate.getFullYear()}`,
            depositDateObj: maturityDate, // On maturity date (inclusive)
            receiptCredit: 3000,
            rawReceiptCredit: 3000,
            particulars: 'Daily RD On Maturity Date',
            isValidPayment: true,
            isSummaryRow: false,
            type: 'COLLECTION',
          },
          {
            rowNum: 3,
            date: `${afterMaturityDate.getDate()}/${afterMaturityDate.getMonth() + 1}/${afterMaturityDate.getFullYear()}`,
            depositDateObj: afterMaturityDate, // AFTER maturity date
            receiptCredit: 4000,
            rawReceiptCredit: 4000,
            particulars: 'Daily RD After Maturity',
            isValidPayment: true,
            isSummaryRow: false,
            type: 'COLLECTION',
          },
        ];

        const totalDeposited = 17000;
        const result = calculateDailyRDNonProfitMaturity(txns, totalDeposited, 50, 12.0, 365);

        // Only rowNum 2 is in final 90 days
        assert.equal(result.final90DayCollectionCount, 1);
        assert.equal(result.actualFinal90DayDeposits, 3000);
        // Post maturity deposits tracked separately
        assert.equal(result.postMaturityDeposits, 4000);
        // Required = 50 * 90 = 4,500. 3,000 <= 4,500 => A = 0
        assert.equal(result.nonProfitAmountA, 0);
      });

      test('Non-collection transactions (debit, zero/negative, loans, charges) are excluded from final 90 days', () => {
        const startDate = new Date(2025, 0, 1);
        const maturityDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 365);
        const dateInFinal90 = new Date(maturityDate.getFullYear(), maturityDate.getMonth(), maturityDate.getDate() - 10);

        const openRow: LedgerTransactionRow = {
          rowNum: 1,
          date: '01/01/2025',
          depositDateObj: startDate,
          receiptCredit: 5000,
          rawReceiptCredit: 5000,
          isValidPayment: true,
          isSummaryRow: false,
          particulars: 'Daily RD Opening',
          type: 'COLLECTION',
        };

        const validCollectionRow: LedgerTransactionRow = {
          rowNum: 2,
          date: '01/12/2025',
          depositDateObj: dateInFinal90,
          receiptCredit: 1000,
          rawReceiptCredit: 1000,
          isValidPayment: true,
          isSummaryRow: false,
          particulars: 'Daily RD Collection',
          type: 'COLLECTION',
        };

        const debitRow: LedgerTransactionRow = {
          rowNum: 3,
          date: '02/12/2025',
          depositDateObj: dateInFinal90,
          paymentDebit: 1000,
          receiptCredit: 0,
          rawReceiptCredit: 0,
          isValidPayment: false,
          isSummaryRow: false,
          particulars: 'Withdrawal / Debit',
          type: 'PAYMENT',
        };

        const loanRow: LedgerTransactionRow = {
          rowNum: 4,
          date: '03/12/2025',
          depositDateObj: dateInFinal90,
          receiptCredit: 1000,
          rawReceiptCredit: 1000,
          isValidPayment: true,
          isSummaryRow: false,
          particulars: 'LOAN RECOVERY / CHARGE',
          type: 'LOAN',
        };

        assert.equal(isCollectionTransaction(validCollectionRow), true);
        assert.equal(isCollectionTransaction(debitRow), false);
        assert.equal(isCollectionTransaction(loanRow), false);

        const txns = [openRow, validCollectionRow, debitRow, loanRow];
        const result = calculateDailyRDNonProfitMaturity(txns, 6000, 100, 12.0, 365);

        // Only the valid collection row in final 90 days is included
        assert.equal(result.final90DayCollectionCount, 1);
        assert.equal(result.actualFinal90DayDeposits, 1000);
      });

      test('Duplicate transaction prevention prevents identical receipt / row from being counted twice', () => {
        const startDate = new Date(2025, 0, 1);
        const maturityDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 365);
        const dateInFinal90 = new Date(maturityDate.getFullYear(), maturityDate.getMonth(), maturityDate.getDate() - 15);

        const openRow: LedgerTransactionRow = {
          rowNum: 1,
          date: '01/01/2025',
          depositDateObj: startDate,
          receiptCredit: 5000,
          rawReceiptCredit: 5000,
          isValidPayment: true,
          isSummaryRow: false,
          particulars: 'Daily RD Opening',
          type: 'COLLECTION',
        };

        // Two identical rows with same receipt number in final 90 days
        const row1: LedgerTransactionRow = {
          rowNum: 2,
          date: '10/12/2025',
          depositDateObj: dateInFinal90,
          receiptCredit: 1000,
          rawReceiptCredit: 1000,
          receiptNumber: 'REC-DUP-999',
          isValidPayment: true,
          isSummaryRow: false,
          particulars: 'Daily RD deposit',
          type: 'COLLECTION',
        };

        const duplicateRow: LedgerTransactionRow = {
          rowNum: 3,
          date: '10/12/2025',
          depositDateObj: dateInFinal90,
          receiptCredit: 1000,
          rawReceiptCredit: 1000,
          receiptNumber: 'REC-DUP-999',
          isValidPayment: true,
          isSummaryRow: false,
          particulars: 'Daily RD deposit',
          type: 'COLLECTION',
        };

        const result = calculateDailyRDNonProfitMaturity([openRow, row1, duplicateRow], 6000, 100, 12.0, 365);

        // Duplicate is ignored, exactly 1 collection counted in final 90 days
        assert.equal(result.final90DayCollectionCount, 1);
        assert.equal(result.actualFinal90DayDeposits, 1000);
      });

      test('No excess deposits: when actual deposits in final 90 days <= required, A = 0 and X = total deposits', () => {
        const startDate = new Date(2025, 0, 1);
        const maturityDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 365);
        const dateInFinal90 = new Date(maturityDate.getFullYear(), maturityDate.getMonth(), maturityDate.getDate() - 25);

        const txns: LedgerTransactionRow[] = [
          {
            rowNum: 1,
            date: '01/01/2025',
            depositDateObj: startDate,
            receiptCredit: 25000,
            rawReceiptCredit: 25000,
            particulars: 'Daily RD Opening',
            isValidPayment: true,
            isSummaryRow: false,
            type: 'COLLECTION',
          },
          {
            rowNum: 2,
            date: '05/12/2025',
            depositDateObj: dateInFinal90,
            receiptCredit: 5000,
            rawReceiptCredit: 5000,
            particulars: 'Daily RD Payment in Final 90',
            isValidPayment: true,
            isSummaryRow: false,
            type: 'COLLECTION',
          },
        ];

        const totalDeposited = 30000;
        // Daily installment = 100 -> required 90-day = 9,000. Actual in final 90 days = 5,000 <= 9,000
        const result = calculateDailyRDNonProfitMaturity(txns, totalDeposited, 100, 12.0, 365);

        assert.equal(result.final90DayCollectionCount, 1);
        assert.equal(result.actualFinal90DayDeposits, 5000);
        assert.equal(result.required90DayAmount, 9000);
        assert.equal(result.nonProfitAmountA, 0);
        assert.equal(result.adjustedPrincipalX, 30000);
        assert.equal(result.finalMaturityAmount, result.roundedY);
      });

      test('Excel Day Sheet parsing: unifies customer rows across bond number so all 16 collections are captured', () => {
        // Construct a Sheet2 table matching SOJAN SUNNY Day Sheet format
        // Organization header row 1, Day Sheet title row 2, columns row 3, data rows 4+
        const headers = [
          'SL NO',
          'BRANCH',
          'DATE',
          'BOND NO',
          'MEM ID',
          'CUSTOMER NAME',
          'SCHEME NAME & PLAN',
          'AMOUNT',
          'NATURE OF RECEIPT',
        ];

        const rows: any[][] = [
          ['XYZ COOPERATIVE CREDIT SOCIETY', '', '', '', '', '', '', '', ''],
          ['DAY SHEET REPORT', '', '', '', '', '', '', '', ''],
          headers,
        ];

        // First deposit: Day 1
        rows.push([1, 'MAIN', '01/01/2025', '38091068', 'MEM-101', 'SOJAN SUNNY', 'DRD 100', 20500, 'OPENING COLLECTION']);

        // 16 collection transactions in final 90 days (Nov/Dec 2025)
        // Notice: Customer Name is left blank on some rows as happens in branch Day Sheets
        for (let i = 1; i <= 16; i++) {
          const day = String(i * 2).padStart(2, '0');
          const custNameCol = (i % 3 === 0) ? '' : 'SOJAN SUNNY'; // Some rows have empty customer name
          rows.push([
            i + 1,
            'MAIN',
            `${day}/11/2025`,
            '38091068',
            'MEM-101',
            custNameCol,
            'DRD 100',
            1000,
            `DAILY COLLECTION REC-${i}`,
          ]);
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet2');
        const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

        const parsed = parseRDLedgerWorkbook(buf, 'SOJAN SUNNY(2).xlsx', buf.byteLength);

        // Verification of parsed account
        assert.equal(parsed.customerName, 'SOJAN SUNNY');
        assert.equal(parsed.accountNumber, '38091068');
        assert.equal(parsed.rdType, 'Daily RD');
        assert.equal(parsed.totalDeposited, 36500);

        // All 16 collections in final 90 days are captured!
        assert.equal(parsed.final90DayCollectionCount, 16);
        assert.equal(parsed.actualFinal90DayDeposits, 16000);
        assert.equal(parsed.required90DayAmount, 9000);
        assert.equal(parsed.nonProfitAmountA, 7000);
        assert.equal(parsed.adjustedPrincipalX, 29500);
        assert.equal(parsed.roundedY, 31338);
        assert.equal(parsed.maturityAmount, 38338);
      });
    });
  });
});

