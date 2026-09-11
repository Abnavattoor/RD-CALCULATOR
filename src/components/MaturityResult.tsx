import React from 'react';
import { RDAccountData } from '../types';
import { RDCharts } from './RDCharts';
import { formatCurrency } from '../utils/excelParser';
import { generateRDReport } from '../utils/pdfReport';
import { generateExcelReport } from '../utils/excelReport';

import {
  RotateCcw,
  Info,
  Percent,
  CalendarDays,
  Wallet,
  TrendingUp,
  Calculator,
  CheckCircle2,
  BarChart3,
  FileDown,
  FileSpreadsheet,
} from 'lucide-react';

interface MaturityResultProps {
  data: RDAccountData;
  onReset: () => void;
}

export const MaturityResult: React.FC<MaturityResultProps> = ({
  data,
  onReset,
}) => {
  // ========================================================================
  // RD TYPE
  // ========================================================================

  const isMonthly = data.rdType === 'Monthly RD';
  const isDaily = data.rdType === 'Daily RD';

  // ========================================================================
  // INTEREST RATE
  // ========================================================================

  const ratePercent = (data.annualRate * 100).toFixed(2);

  // ========================================================================
  // MONTHLY INSTALLMENT
  // ========================================================================

  const monthlyInstallment =
    data.validTransactionCount > 0
      ? data.totalDeposited / data.validTransactionCount
      : 0;

  // ========================================================================
  // INTEREST PERCENTAGE
  // ========================================================================

  const interestPercentage =
    data.totalDeposited > 0
      ? ((data.totalInterest / data.totalDeposited) * 100).toFixed(2)
      : '0.00';

  // ========================================================================
  // TENURE DISPLAY
  // ========================================================================

  let tenureLabel = '';

  if (isMonthly) {
    const periodText = data.period || '';

    const monthMatch = periodText.match(
      /(\d+)\s*(?:month|months|m\b)/i
    );

    const yearMatch = periodText.match(
      /(\d+)\s*(?:year|years|y\b)/i
    );

    if (monthMatch) {
      tenureLabel = `${monthMatch[1]}-Month Tenure`;
    } else if (yearMatch) {
      tenureLabel = `${yearMatch[1]}-Year Tenure`;
    } else {
      const approximateMonths = Math.max(
        1,
        Math.round((data.tenureDays || 0) / (365 / 12))
      );

      tenureLabel = `${approximateMonths}-Month Tenure`;
    }
  } else {
    tenureLabel = `${data.tenureDays || 365}-Day Tenure`;
  }

  // ========================================================================
  // DISPLAY VALUES
  // ========================================================================

  const contributionLabel = isMonthly
    ? 'Monthly Installment'
    : 'Normalized Daily Amount';

  const contributionValue = isMonthly
    ? monthlyInstallment
    : data.normalizedDailyAmount;

  const contributionDescription = isMonthly
    ? 'Average amount contributed per valid deposit'
    : 'Profit-Eligible Amount ÷ 365';

  const totalInterestDescription = isMonthly
    ? 'Progressive interest on profit-eligible installments'
    : 'Progressive interest across the calculation period';

  // ========================================================================
  // NON-PROFIT AMOUNT
  // ========================================================================

  const nonProfitAmount = data.nonProfitAmount || 0;

  const profitEligibleAmount =
    data.profitEligibleAmount !== undefined
      ? data.profitEligibleAmount
      : Math.max(
          0,
          data.totalDeposited - nonProfitAmount
        );

  // ========================================================================
  // MONTHLY RD - LAST PROFITABLE PAYMENT DATE
  // ========================================================================
  //
  // Maturity Date - 15 days
  //
  // Example:
  // Maturity = 20-Aug-2026
  // Last profitable payment = 05-Aug-2026
  //
  // ========================================================================

  const getLastProfitablePaymentDate = (): string | null => {
    if (!isMonthly || !data.maturityDate) {
      return null;
    }

    const text = String(data.maturityDate).trim();

    if (!text) {
      return null;
    }

    let maturityDate: Date | null = null;

    // YYYY-MM-DD
    let match = text.match(
      /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/
    );

    if (match) {
      maturityDate = new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
      );
    }

    // DD-MM-YYYY / DD/MM/YYYY
    if (!maturityDate || Number.isNaN(maturityDate.getTime())) {
      match = text.match(
        /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/
      );

      if (match) {
        maturityDate = new Date(
          Number(match[3]),
          Number(match[2]) - 1,
          Number(match[1])
        );
      }
    }

    // Native date parsing fallback
    if (!maturityDate || Number.isNaN(maturityDate.getTime())) {
      const parsed = new Date(text);

      if (!Number.isNaN(parsed.getTime())) {
        maturityDate = new Date(
          parsed.getFullYear(),
          parsed.getMonth(),
          parsed.getDate()
        );
      }
    }

    if (!maturityDate || Number.isNaN(maturityDate.getTime())) {
      return null;
    }

    maturityDate.setDate(
      maturityDate.getDate() - 15
    );

    const day = String(
      maturityDate.getDate()
    ).padStart(2, '0');

    const month = String(
      maturityDate.getMonth() + 1
    ).padStart(2, '0');

    const year = maturityDate.getFullYear();

    return `${day}-${month}-${year}`;
  };

  const lastProfitablePaymentDate =
    getLastProfitablePaymentDate();

  // ========================================================================
  // PDF REPORT
  // ========================================================================

  const handleDownloadReport = () => {
    try {
      generateRDReport(data);
    } catch (error) {
      console.error(
        'Failed to generate PDF report:',
        error
      );

      alert(
        'Unable to generate the PDF report. Please try again.'
      );
    }
  };

  // ========================================================================
  // EXCEL REPORT
  // ========================================================================

  const handleExportExcel = () => {
    try {
      generateExcelReport(data);
    } catch (error) {
      console.error(
        'Failed to generate Excel report:',
        error
      );

      alert(
        'Unable to generate the Excel report. Please try again.'
      );
    }
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="w-full max-w-6xl mx-auto px-4 mb-16">

      {/* ====================================================================
          MAIN RESULT CONTAINER
      ==================================================================== */}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

        {/* ==================================================================
            RESULT HEADER
        ================================================================== */}

        <div className="px-6 sm:px-8 pt-7 pb-6 border-b border-gray-100">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

            <div>

              <div className="flex items-center gap-2 mb-2">

                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">

                  <Calculator className="w-5 h-5 text-blue-600" />

                </div>

                <span className="text-xs font-bold uppercase tracking-widest text-blue-600">
                  Calculation Complete
                </span>

              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                Maturity Calculation Result
              </h2>

              <p className="text-sm text-gray-500 mt-1">

                {isMonthly
                  ? 'Monthly RD Progressive Interest Calculation'
                  : 'Daily RD Normalized Progressive Interest Calculation'}

              </p>

            </div>

            {/* RD TYPE + TENURE */}

            <div className="flex flex-wrap items-center gap-2">

              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">

                <CheckCircle2 className="w-3.5 h-3.5" />

                {data.rdType}

              </span>

              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-50 text-gray-700 border border-gray-200">

                <CalendarDays className="w-3.5 h-3.5 text-gray-500" />

                {tenureLabel}

              </span>

            </div>

          </div>

        </div>

        {/* ==================================================================
            HERO MATURITY AMOUNT
        ================================================================== */}

        <div className="px-6 sm:px-8 pt-7">

          <div className="rounded-2xl bg-blue-600 text-white p-6 sm:p-8 shadow-sm">

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

              <div>

                <div className="flex items-center gap-2 mb-2">

                  <Wallet className="w-5 h-5 text-blue-100" />

                  <span className="text-xs font-extrabold uppercase tracking-widest text-blue-100">
                    Final Maturity Amount
                  </span>

                </div>

                <div className="text-4xl sm:text-5xl font-extrabold font-mono tracking-tight">

                  {formatCurrency(data.maturityAmount)}

                </div>

                <p className="text-sm text-blue-100 mt-2">
                  Total deposited amount plus calculated interest
                </p>

              </div>

              {/* INTEREST EARNED */}

              <div className="lg:border-l lg:border-blue-500/70 lg:pl-8">

                <div className="flex items-center gap-2 mb-1">

                  <TrendingUp className="w-4 h-4 text-blue-100" />

                  <span className="text-xs font-bold uppercase tracking-wider text-blue-100">
                    Interest Earned
                  </span>

                </div>

                <div className="text-2xl sm:text-3xl font-bold font-mono">

                  {formatCurrency(data.totalInterest)}

                </div>

                <p className="text-xs text-blue-100 mt-1">
                  {interestPercentage}% of total deposited
                </p>

              </div>

            </div>

          </div>

        </div>

        {/* ==================================================================
            FINANCIAL SUMMARY
        ================================================================== */}

        <div className="px-6 sm:px-8 pt-6">

          <div
            className={`
              grid
              grid-cols-1
              sm:grid-cols-2
              ${isDaily || isMonthly ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}
              gap-4
            `}
          >

            {/* ==============================================================
                TOTAL DEPOSITED
            ============================================================== */}

            <div className="rounded-xl bg-gray-50 border border-gray-200 p-5">

              <div className="flex items-center justify-between mb-3">

                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Total Deposited
                </span>

                <Wallet className="w-4 h-4 text-gray-400" />

              </div>

              <div className="text-2xl font-bold font-mono text-gray-900">

                {formatCurrency(data.totalDeposited)}

              </div>

              <p className="text-xs text-gray-500 mt-2">

                {data.validTransactionCount}{' '}

                {data.validTransactionCount === 1
                  ? 'valid deposit'
                  : 'valid deposits'}

              </p>

            </div>

            {/* ==============================================================
                CONTRIBUTION
            ============================================================== */}

            <div className="rounded-xl bg-blue-50 border border-blue-200 p-5">

              <div className="flex items-center justify-between mb-3">

                <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  {contributionLabel}
                </span>

                <CalendarDays className="w-4 h-4 text-blue-500" />

              </div>

              <div className="text-2xl font-bold font-mono text-blue-950">

                {formatCurrency(contributionValue)}

              </div>

              <p className="text-xs text-blue-700 mt-2">

                {contributionDescription}

              </p>

            </div>

            {/* ==============================================================
                INTEREST RATE
            ============================================================== */}

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-5">

              <div className="flex items-center justify-between mb-3">

                <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  Interest Rate
                </span>

                <Percent className="w-4 h-4 text-amber-500" />

              </div>

              <div className="text-2xl font-bold font-mono text-amber-950">

                {ratePercent}%

              </div>

              <p className="text-xs text-amber-700 mt-2">
                Annual interest rate
              </p>

            </div>

            {/* ==============================================================
                NON-PROFIT AMOUNT
                DAILY + MONTHLY
            ============================================================== */}

            {(isDaily || isMonthly) && (

              <div className="rounded-xl bg-orange-50 border border-orange-200 p-5">

                <div className="flex items-center justify-between mb-3">

                  <span className="text-xs font-bold uppercase tracking-wider text-orange-800">
                    Non-Profit Amount
                  </span>

                  <Wallet className="w-4 h-4 text-orange-500" />

                </div>

                <div className="text-2xl font-bold font-mono text-orange-950">

                  {formatCurrency(nonProfitAmount)}

                </div>

                <p className="text-xs text-orange-700 mt-2 leading-relaxed">

                  {isDaily
                    ? 'Late / excess payment not eligible for Daily RD profit.'
                    : 'Payment made during the 15-day relaxation period is not eligible for Monthly RD profit.'}

                </p>

              </div>

            )}

            {/* ==============================================================
                TOTAL INTEREST
            ============================================================== */}

            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5">

              <div className="flex items-center justify-between mb-3">

                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Total Interest
                </span>

                <TrendingUp className="w-4 h-4 text-emerald-500" />

              </div>

              <div className="text-2xl font-bold font-mono text-emerald-950">

                {formatCurrency(data.totalInterest)}

              </div>

              <p className="text-xs text-emerald-700 mt-2">

                {totalInterestDescription}

              </p>

            </div>

          </div>

        </div>

        {/* ==================================================================
            MONTHLY RD RELAXATION INFORMATION
        ================================================================== */}

        {isMonthly && (

          <div className="px-6 sm:px-8 pt-6">

            <div className="rounded-xl bg-orange-50 border border-orange-200 p-5">

              <div className="flex items-start gap-3">

                <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">

                  <CalendarDays className="w-4 h-4 text-orange-600" />

                </div>

                <div className="flex-1">

                  <h3 className="text-sm font-bold text-orange-900">
                    Monthly RD 15-Day Relaxation Rule
                  </h3>

                  {lastProfitablePaymentDate ? (

                    <p className="text-xs text-orange-800 mt-1.5 leading-relaxed">

                      The last profitable payment date is{' '}

                      <strong>
                        {lastProfitablePaymentDate}
                      </strong>

                      . Payments made after this date and within the
                      15-day period before maturity are accepted, but
                      that payment becomes Non-Profit and does not earn
                      Monthly RD profit.

                    </p>

                  ) : (

                    <p className="text-xs text-orange-800 mt-1.5 leading-relaxed">

                      The final Monthly RD installment should be paid
                      15 days before the maturity date. A payment made
                      during the final 15-day relaxation period is
                      accepted but becomes Non-Profit and does not earn
                      Monthly RD profit.

                    </p>

                  )}

                </div>

              </div>

            </div>

          </div>

        )}

        {/* ==================================================================
            MATURITY BREAKDOWN
        ================================================================== */}

        <div className="px-6 sm:px-8 pt-7">

          <div className="rounded-xl border border-gray-200 overflow-hidden">

            <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">

              <div className="flex items-center gap-2">

                <Calculator className="w-4 h-4 text-blue-600" />

                <h3 className="text-sm font-bold text-gray-900">
                  Maturity Amount Breakdown
                </h3>

              </div>

            </div>

            <div className="p-5">

              <div className="space-y-3 text-sm">

                {/* TOTAL DEPOSITED */}

                <div className="flex items-center justify-between gap-4">

                  <span className="text-gray-600">
                    Total Amount Deposited
                  </span>

                  <span className="font-semibold font-mono text-gray-900">
                    {formatCurrency(data.totalDeposited)}
                  </span>

                </div>

                {/* PROFIT ELIGIBLE */}

                {(isDaily || isMonthly) && (

                  <div className="flex items-center justify-between gap-4">

                    <span className="text-gray-600">
                      Profit-Eligible Amount
                    </span>

                    <span className="font-semibold font-mono text-blue-700">
                      {formatCurrency(profitEligibleAmount)}
                    </span>

                  </div>

                )}

                {/* NON-PROFIT */}

                {(isDaily || isMonthly) && nonProfitAmount > 0 && (

                  <div className="flex items-center justify-between gap-4">

                    <span className="text-orange-700">
                      Non-Profit Amount
                    </span>

                    <span className="font-semibold font-mono text-orange-700">
                      {formatCurrency(nonProfitAmount)}
                    </span>

                  </div>

                )}

                {/* TOTAL INTEREST */}

                <div className="flex items-center justify-between gap-4">

                  <span className="text-gray-600">
                    Total Interest Earned
                  </span>

                  <span className="font-semibold font-mono text-emerald-700">
                    + {formatCurrency(data.totalInterest)}
                  </span>

                </div>

                {/* FINAL MATURITY */}

                <div className="border-t border-gray-200 pt-3 flex items-center justify-between gap-4">

                  <span className="font-bold text-gray-900">
                    Final Maturity Amount
                  </span>

                  <span className="font-bold font-mono text-blue-700 text-base">
                    {formatCurrency(data.maturityAmount)}
                  </span>

                </div>

              </div>

            </div>

          </div>

        </div>

        {/* ==================================================================
            PHASE 3 - CHARTS
        ================================================================== */}

        <div className="px-6 sm:px-8 pt-7">

          <div className="rounded-xl border border-gray-200 overflow-hidden">

            <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">

              <div className="flex items-center gap-2">

                <BarChart3 className="w-4 h-4 text-blue-600" />

                <h3 className="text-sm font-bold text-gray-900">
                  RD Visual Analysis
                </h3>

              </div>

              <p className="text-xs text-gray-500 mt-1">
                Visual breakdown of your deposits and progressive interest growth.
              </p>

            </div>

            <div className="p-5">

              <RDCharts data={data} />

            </div>

          </div>

        </div>

        {/* ==================================================================
            CALCULATION METHODOLOGY
        ================================================================== */}

        <div className="px-6 sm:px-8 pt-7">

          <div className="p-5 rounded-xl bg-gray-50 border border-gray-200">

            <div className="flex items-center gap-2 mb-4">

              <Info className="w-4 h-4 text-blue-600 shrink-0" />

              <h3 className="text-sm font-bold text-gray-900">

                {isMonthly
                  ? 'Monthly RD Calculation Methodology'
                  : 'Daily RD Calculation Methodology'}

              </h3>

            </div>

            {/* ==============================================================
                MONTHLY RD
            ============================================================== */}

            {isMonthly ? (

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">

                {/* STEP 1 */}

                <div className="bg-white p-4 rounded-lg border border-gray-200">

                  <div className="flex items-center gap-2 mb-2">

                    <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold">
                      1
                    </span>

                    <span className="font-semibold text-gray-900 text-sm">
                      Monthly Installment
                    </span>

                  </div>

                  <p className="text-gray-600 leading-relaxed font-mono text-[11px]">
                    Monthly Installment = Total Deposited ÷ Number of Deposits
                  </p>

                  <p className="text-gray-500 mt-2 text-[11px] leading-relaxed">
                    Each valid monthly payment is treated as an RD installment.
                  </p>

                </div>

                {/* STEP 2 */}

                <div className="bg-white p-4 rounded-lg border border-gray-200">

                  <div className="flex items-center gap-2 mb-2">

                    <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold">
                      2
                    </span>

                    <span className="font-semibold text-gray-900 text-sm">
                      15-Day Cutoff
                    </span>

                  </div>

                  <p className="text-gray-600 leading-relaxed font-mono text-[11px]">
                    Last Profitable Date = Maturity Date − 15 Days
                  </p>

                  <p className="text-gray-500 mt-2 text-[11px] leading-relaxed">
                    Payments made after this date during the relaxation period become Non-Profit.
                  </p>

                </div>

                {/* STEP 3 */}

                <div className="bg-white p-4 rounded-lg border border-gray-200">

                  <div className="flex items-center gap-2 mb-2">

                    <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold">
                      3
                    </span>

                    <span className="font-semibold text-gray-900 text-sm">
                      Progressive Interest
                    </span>

                  </div>

                  <p className="text-gray-600 leading-relaxed font-mono text-[11px]">
                    Interest = Eligible Installment × Monthly Rate × Months Remaining
                  </p>

                  <p className="text-gray-500 mt-2 text-[11px] leading-relaxed">
                    Only profit-eligible installments participate in the Monthly RD interest calculation.
                  </p>

                </div>

                {/* STEP 4 */}

                <div className="bg-white p-4 rounded-lg border border-gray-200">

                  <div className="flex items-center gap-2 mb-2">

                    <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold">
                      4
                    </span>

                    <span className="font-semibold text-gray-900 text-sm">
                      Final Maturity
                    </span>

                  </div>

                  <p className="text-gray-600 leading-relaxed font-mono text-[11px]">
                    Maturity Amount = Total Deposited + Total Interest
                  </p>

                  <p className="text-gray-500 mt-2 text-[11px] leading-relaxed">
                    Non-Profit amounts remain part of the deposited principal but do not earn Monthly RD profit.
                  </p>

                </div>

              </div>

            ) : (

              /* ============================================================
                  DAILY RD
              ============================================================ */

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                {/* STEP 1 */}

                <div className="bg-white p-4 rounded-lg border border-gray-200">

                  <div className="flex items-center gap-2 mb-2">

                    <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold">
                      1
                    </span>

                    <span className="font-semibold text-gray-900 text-sm">
                      Deposit Normalization
                    </span>

                  </div>

                  <p className="text-gray-600 leading-relaxed font-mono text-[11px]">
                    Profit-Eligible Daily RD Amount = Profit-Eligible Amount ÷ 365
                  </p>

                  <p className="text-gray-500 mt-2 text-[11px] leading-relaxed">
                    Only the profit-eligible portion is used for Daily RD profit calculation. Late or excess payments are shown separately as Non-Profit Amount.
                  </p>

                </div>

                {/* STEP 2 */}

                <div className="bg-white p-4 rounded-lg border border-gray-200">

                  <div className="flex items-center gap-2 mb-2">

                    <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold">
                      2
                    </span>

                    <span className="font-semibold text-gray-900 text-sm">
                      Progressive Interest
                    </span>

                  </div>

                  <p className="text-gray-600 leading-relaxed font-mono text-[11px]">
                    Day i Interest = Daily Amount × Annual Rate × (i ÷ 365)
                  </p>

                  <p className="text-gray-500 mt-2 text-[11px] leading-relaxed">
                    Interest is progressively accumulated across the calculation period.
                  </p>

                </div>

                {/* STEP 3 */}

                <div className="bg-white p-4 rounded-lg border border-gray-200">

                  <div className="flex items-center gap-2 mb-2">

                    <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold">
                      3
                    </span>

                    <span className="font-semibold text-gray-900 text-sm">
                      Final Maturity
                    </span>

                  </div>

                  <p className="text-gray-600 leading-relaxed font-mono text-[11px]">
                    Maturity Amount = Total Deposited + Total Interest
                  </p>

                  <p className="text-gray-500 mt-2 text-[11px] leading-relaxed">
                    Full precision is maintained internally and rounded for display.
                  </p>

                </div>

              </div>

            )}

          </div>

        </div>

        {/* ==================================================================
            RESULT STATUS
        ================================================================== */}

        <div className="px-6 sm:px-8 pt-6">

          <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">

            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />

            <div>

              <p className="text-sm font-semibold text-emerald-900">
                Calculation completed successfully
              </p>

              <p className="text-xs text-emerald-700 mt-1 leading-relaxed">

                The result was calculated using {data.validTransactionCount}{' '}

                valid ledger{' '}

                {data.validTransactionCount === 1
                  ? 'transaction'
                  : 'transactions'}.

              </p>

            </div>

          </div>

        </div>

        {/* ==================================================================
            REPORT + UPLOAD BUTTONS
        ================================================================== */}

        <div className="px-6 sm:px-8 py-7 mt-6 border-t border-gray-100">

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">

            {/* DOWNLOAD PDF REPORT */}

            <button
              type="button"
              id="btn-download-pdf-report"
              onClick={handleDownloadReport}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg shadow-sm transition active:scale-[0.98] cursor-pointer"
            >

              <FileDown className="w-4 h-4" />

              <span>
                Download PDF Report
              </span>

            </button>

            {/* EXPORT EXCEL REPORT */}

            <button
              type="button"
              id="btn-export-excel-report"
              onClick={handleExportExcel}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition active:scale-[0.98] cursor-pointer"
            >

              <FileSpreadsheet className="w-4 h-4" />

              <span>
                Export Excel Report
              </span>

            </button>

            {/* UPLOAD ANOTHER LEDGER */}

            <button
              type="button"
              id="btn-upload-another-ledger"
              onClick={onReset}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition active:scale-[0.98] cursor-pointer"
            >

              <RotateCcw className="w-4 h-4" />

              <span>
                Upload Another Ledger
              </span>

            </button>

          </div>

        </div>

      </div>

    </div>
  );
};