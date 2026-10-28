/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  calculateDailyRDMaturity,
  calculateMonthlyRDMaturity,
  getDailyRDBreakdownPage as getDailyRDBreakdownPageUnified,
  getMonthlyRDBreakdown as getMonthlyRDBreakdownUnified,
  generateRDCSVReport,
  roundMoney as roundMoneyUnified,
  formatCurrency as formatCurrencyUnified,
  adjustRate,
  validateRateInput,
  getDefaultRateForDuration,
  DAILY_RD_SUPPORTED_DURATIONS,
  MONTHLY_RD_SUPPORTED_DURATIONS,
  RATE_ADJUSTMENT_STEP,
  CONFIGURABLE_MAX_INTEREST_RATE,
  CONFIGURABLE_MIN_INTEREST_RATE,
  RDSchemeType,
  RDCalculationResult,
  RDBreakdownRow,
  RDBreakdownPageResult,
} from './rdInterestCalculator';

export {
  calculateDailyRDMaturity,
  calculateMonthlyRDMaturity,
  adjustRate,
  validateRateInput,
  getDefaultRateForDuration,
  DAILY_RD_SUPPORTED_DURATIONS,
  MONTHLY_RD_SUPPORTED_DURATIONS,
  RATE_ADJUSTMENT_STEP,
  CONFIGURABLE_MAX_INTEREST_RATE,
  CONFIGURABLE_MIN_INTEREST_RATE,
};

export type {
  RDSchemeType,
  RDCalculationResult,
  RDBreakdownRow,
  RDBreakdownPageResult,
};

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

export const roundMoney = roundMoneyUnified;
export const formatCurrency = formatCurrencyUnified;

/**
 * Calculates Recurring Daily Deposit interest and maturity amount using the
 * authoritative workbook daily balance accumulation methodology.
 */
export function calculateDailyRDInterest(
  days: number,
  dailyAmount: number,
  annualInterestRate: number
): DailyRDInterestResult {
  const result = calculateDailyRDMaturity(days, dailyAmount, annualInterestRate);

  return {
    days: result.duration,
    dailyAmount: result.installmentAmount,
    annualInterestRate: result.annualInterestRate,
    totalDeposited: result.totalDeposited,
    totalInterest: result.totalInterest,
    maturityAmount: result.maturityAmount,
    isValid: result.isValid,
    errorMessage: result.errorMessage,
  };
}

/**
 * Returns a specific page of breakdown rows for backward compatibility.
 */
export function getDailyRDBreakdownPage(
  days: number,
  dailyAmount: number,
  annualInterestRate: number,
  page: number = 1,
  pageSize: number = 25
): BreakdownPageResult {
  const unified = getDailyRDBreakdownPageUnified(days, dailyAmount, annualInterestRate, page, pageSize);

  const rows: DailyRDBreakdownRow[] = unified.rows.map((r) => ({
    day: r.periodIndex,
    deposit: r.deposit,
    remainingDays: Math.max(0, days - r.periodIndex),
    interest: r.periodInterest,
    cumulativeDeposit: r.cumulativeDeposit,
    cumulativeInterest: r.cumulativeInterest,
  }));

  return {
    rows,
    totalRows: unified.totalRows,
    currentPage: unified.currentPage,
    totalPages: unified.totalPages,
    pageSize: unified.pageSize,
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
  return generateRDCSVReport('Daily RD', days, dailyAmount, annualInterestRate);
}
