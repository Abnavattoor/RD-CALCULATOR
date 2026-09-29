/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Calculator,
  CalendarDays,
  IndianRupee,
  Percent,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Download,
  TrendingUp,
  Coins,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  calculateDailyRDInterest,
  getDailyRDBreakdownPage,
  generateDailyRDBreakdownCSV,
  formatCurrency,
  roundMoney,
  DailyRDInterestResult,
} from '../utils/dailyRDInterestCalculator';

interface DailyRDInterestCalculatorProps {
  onBackToCalculators?: () => void;
}

const PRESET_DAYS = [
  { label: '30 Days (1 mo)', value: 30 },
  { label: '90 Days (3 mos)', value: 90 },
  { label: '180 Days (6 mos)', value: 180 },
  { label: '365 Days (1 yr)', value: 365 },
  { label: '730 Days (2 yrs)', value: 730 },
];

const PRESET_AMOUNTS = [50, 100, 200, 500, 1000];
const PRESET_RATES = [8, 10, 12, 14, 15, 18];

export const DailyRDInterestCalculator: React.FC<DailyRDInterestCalculatorProps> = ({
  onBackToCalculators,
}) => {
  // Input states
  const [daysInput, setDaysInput] = useState<string>('365');
  const [dailyAmountInput, setDailyAmountInput] = useState<string>('100');
  const [interestRateInput, setInterestRateInput] = useState<number>(12);
  const [customRateText, setCustomRateText] = useState<string>('');

  // UI states
  const [showBreakdown, setShowBreakdown] = useState<boolean>(false);
  const [breakdownPage, setBreakdownPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Live calculation
  const parsedDays = Number(daysInput);
  const parsedDailyAmount = Number(dailyAmountInput);
  const parsedRate = customRateText !== '' ? Number(customRateText) : interestRateInput;

  const result: DailyRDInterestResult = useMemo(() => {
    return calculateDailyRDInterest(parsedDays, parsedDailyAmount, parsedRate);
  }, [parsedDays, parsedDailyAmount, parsedRate]);

  // Breakdown pagination result
  const breakdownData = useMemo(() => {
    if (!result.isValid || !showBreakdown) {
      return null;
    }
    return getDailyRDBreakdownPage(
      result.days,
      result.dailyAmount,
      result.annualInterestRate,
      breakdownPage,
      pageSize
    );
  }, [result, showBreakdown, breakdownPage, pageSize]);

  // Handle Preset Day click
  const handlePresetDays = (val: number) => {
    setDaysInput(String(val));
    setBreakdownPage(1);
  };

  // Handle Preset Amount click
  const handlePresetAmount = (val: number) => {
    setDailyAmountInput(String(val));
    setBreakdownPage(1);
  };

  // Handle Preset Rate click
  const handlePresetRate = (rate: number) => {
    setInterestRateInput(rate);
    setCustomRateText('');
    setBreakdownPage(1);
  };

  // Handle Custom Rate change
  const handleCustomRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomRateText(val);
    setBreakdownPage(1);
  };

  // Reset function
  const handleReset = () => {
    setDaysInput('365');
    setDailyAmountInput('100');
    setInterestRateInput(12);
    setCustomRateText('');
    setShowBreakdown(false);
    setBreakdownPage(1);
  };

  // CSV Download handler
  const handleDownloadCSV = () => {
    if (!result.isValid) return;
    const csvContent = generateDailyRDBreakdownCSV(
      result.days,
      result.dailyAmount,
      result.annualInterestRate
    );
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Daily_RD_Breakdown_${result.days}days_${result.dailyAmount}rs_${result.annualInterestRate}pct.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isPresetRate = customRateText === '' && PRESET_RATES.includes(interestRateInput);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 sm:py-10">
      {/* NAVIGATION / TOP BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white flex items-center justify-center shadow-lg shadow-indigo-100">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-[11px] font-bold text-indigo-700 uppercase tracking-wider mb-1">
              Recurring Daily Calculator
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
              Daily RD Interest Calculator
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onBackToCalculators && (
            <button
              type="button"
              onClick={onBackToCalculators}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm font-semibold text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50 shadow-xs transition-all"
            >
              ← Back to Calculators
            </button>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm font-semibold text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50 shadow-xs transition-all"
            title="Reset to default values (365 days, ₹100, 12%)"
          >
            <RotateCcw className="w-4 h-4 text-gray-400" />
            Reset
          </button>
        </div>
      </div>

      {/* DESCRIPTION */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-100/80 p-4 sm:p-5 mb-8">
        <p className="text-sm text-gray-700 leading-relaxed">
          Calculate the accumulated deposit and recurring simple interest for a daily recurring deposit.
          Unlike a fixed deposit where the total sum is deposited upfront, interest here is earned by each daily installment based on its exact remaining days invested.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: INPUTS */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 sm:p-7">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-indigo-600" />
              Deposit Parameters
            </h3>

            {/* INPUT 1: NUMBER OF DAYS */}
            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="number-of-days"
                  className="text-sm font-bold text-gray-900 flex items-center gap-2"
                >
                  <CalendarDays className="w-4 h-4 text-blue-600" />
                  Number of Days
                </label>
                <span className="text-xs font-semibold text-gray-500">
                  e.g. 365
                </span>
              </div>

              <div className="relative">
                <input
                  id="number-of-days"
                  type="number"
                  min="1"
                  step="1"
                  value={daysInput}
                  onChange={(e) => {
                    setDaysInput(e.target.value);
                    setBreakdownPage(1);
                  }}
                  placeholder="365"
                  className="w-full h-12 rounded-xl border border-gray-300 bg-white px-4 pr-16 text-base font-bold text-gray-900 outline-none transition focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                  DAYS
                </span>
              </div>

              {/* Day presets */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PRESET_DAYS.map((preset) => {
                  const isActive = Number(daysInput) === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => handlePresetDays(preset.value)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                        isActive
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* INPUT 2: DAILY AMOUNT */}
            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="daily-amount"
                  className="text-sm font-bold text-gray-900 flex items-center gap-2"
                >
                  <IndianRupee className="w-4 h-4 text-emerald-600" />
                  Daily Amount
                </label>
                <span className="text-xs font-semibold text-gray-500">
                  per day
                </span>
              </div>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-gray-500">
                  ₹
                </span>
                <input
                  id="daily-amount"
                  type="number"
                  min="1"
                  step="1"
                  value={dailyAmountInput}
                  onChange={(e) => {
                    setDailyAmountInput(e.target.value);
                    setBreakdownPage(1);
                  }}
                  placeholder="100"
                  className="w-full h-12 rounded-xl border border-gray-300 bg-white pl-9 pr-4 text-base font-bold text-gray-900 outline-none transition focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50"
                />
              </div>

              {/* Amount presets */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PRESET_AMOUNTS.map((amt) => {
                  const isActive = Number(dailyAmountInput) === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handlePresetAmount(amt)}
                      className={`text-xs px-3 py-1 rounded-lg border font-medium transition-all ${
                        isActive
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-white'
                      }`}
                    >
                      ₹{amt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* INPUT 3: ANNUAL INTEREST RATE */}
            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-amber-600" />
                  Annual Interest Rate (%)
                </label>
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {parsedRate > 0 ? `${parsedRate.toFixed(2)}%` : '0%'}
                </span>
              </div>

              {/* Preset rates */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {PRESET_RATES.map((rate) => {
                  const isSelected = isPresetRate && interestRateInput === rate;
                  return (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => handlePresetRate(rate)}
                      className={`h-10 rounded-xl border text-sm font-bold transition-all ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50 text-amber-800 shadow-xs'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-amber-300 hover:bg-amber-50/40'
                      }`}
                    >
                      {rate}%
                    </button>
                  );
                })}
              </div>

              {/* Custom rate */}
              <div className="pt-2">
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={customRateText}
                    onChange={handleCustomRateChange}
                    placeholder="Enter custom rate (e.g. 11.5)"
                    className={`w-full h-11 rounded-xl border bg-white px-4 pr-10 text-sm font-semibold outline-none transition ${
                      customRateText !== ''
                        ? 'border-amber-500 text-gray-900 ring-2 ring-amber-50'
                        : 'border-gray-300 text-gray-700 focus:border-amber-500'
                    }`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* ACTION / CALCULATE BUTTON */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  // Re-evaluates state, triggers breakdown scroll or open
                  if (result.isValid) {
                    // Smoothly focus or notify user
                  }
                }}
                disabled={!result.isValid}
                className={`w-full h-12 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-sm transition-all duration-200 ${
                  result.isValid
                    ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white shadow-indigo-100 cursor-pointer'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Calculator className="w-5 h-5" />
                Calculate
              </button>
              <p className="text-center text-xs text-gray-400 mt-2">
                Calculations update live as you type or pick presets
              </p>
            </div>

            {/* Error Message if invalid */}
            {!result.isValid && result.errorMessage && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{result.errorMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: RESULT SUMMARY */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-7">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  ₹
                </div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">
                  Calculation Result
                </h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {result.days} Days • {result.annualInterestRate}% p.a.
              </span>
            </div>

            {/* MAIN STATS GRID */}
            <div className="grid grid-cols-2 gap-3.5 mb-5">
              {/* Total Days */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-xs font-semibold text-gray-500 block mb-1">
                  Total Days
                </span>
                <span className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  {result.days.toLocaleString('en-IN')}
                </span>
                <span className="text-[11px] text-gray-400 block mt-0.5">
                  {(result.days / 365).toFixed(2)} years
                </span>
              </div>

              {/* Daily Amount */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-xs font-semibold text-gray-500 block mb-1">
                  Daily Amount
                </span>
                <span className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  {formatCurrency(result.dailyAmount)}
                </span>
                <span className="text-[11px] text-gray-400 block mt-0.5">
                  per day installment
                </span>
              </div>
            </div>

            {/* FINANCIAL TOTALS */}
            <div className="space-y-3.5 mb-6">
              {/* Total Deposited */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50/60 border border-blue-100">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-800 block">
                    Total Deposited
                  </span>
                  <span className="text-xs text-blue-600">
                    {result.days} installments × {formatCurrency(result.dailyAmount)}
                  </span>
                </div>
                <span className="text-xl sm:text-2xl font-black text-blue-900">
                  {formatCurrency(result.totalDeposited)}
                </span>
              </div>

              {/* Interest Earned */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50/70 border border-amber-200">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-900 block flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-700" />
                    Interest Earned
                  </span>
                  <span className="text-xs text-amber-700">
                    Recurring duration calculation ({result.annualInterestRate}%)
                  </span>
                </div>
                <span className="text-xl sm:text-2xl font-black text-amber-900">
                  {formatCurrency(result.totalInterest)}
                </span>
              </div>

              {/* Total Amount / Maturity Value */}
              <div className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-100">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-100 block">
                    Total Amount (Maturity Value)
                  </span>
                  <span className="text-xs text-emerald-200">
                    Total Deposited + Interest
                  </span>
                </div>
                <span className="text-2xl sm:text-3xl font-black tracking-tight">
                  {formatCurrency(result.maturityAmount)}
                </span>
              </div>
            </div>

            {/* VISUAL PROPORTION BAR */}
            {result.maturityAmount > 0 && (
              <div className="pt-2 pb-1 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5 font-medium">
                  <span>
                    Deposit:{' '}
                    <strong className="text-gray-900">
                      {((result.totalDeposited / result.maturityAmount) * 100).toFixed(1)}%
                    </strong>
                  </span>
                  <span>
                    Interest:{' '}
                    <strong className="text-emerald-700">
                      {((result.totalInterest / result.maturityAmount) * 100).toFixed(1)}%
                    </strong>
                  </span>
                </div>
                <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden flex">
                  <div
                    style={{
                      width: `${(result.totalDeposited / result.maturityAmount) * 100}%`,
                    }}
                    className="bg-blue-600 h-full"
                    title={`Deposit: ${formatCurrency(result.totalDeposited)}`}
                  />
                  <div
                    style={{
                      width: `${(result.totalInterest / result.maturityAmount) * 100}%`,
                    }}
                    className="bg-amber-500 h-full"
                    title={`Interest: ${formatCurrency(result.totalInterest)}`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* FORMULA RECAP CARD */}
          <div className="rounded-2xl bg-gray-50 border border-gray-200/80 p-4 sm:p-5 text-xs text-gray-600 leading-relaxed">
            <h4 className="font-bold text-gray-800 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              How Interest is Calculated
            </h4>
            <p className="text-gray-600 mb-2">
              For every daily deposit, interest is computed for the specific days it remains invested:
            </p>
            <div className="font-mono bg-white p-2.5 rounded-lg border border-gray-200 text-[11px] text-gray-700 space-y-1">
              <div>Day 1: ₹{result.dailyAmount} × {result.annualInterestRate}% × ({result.days} - 1) / 365</div>
              <div>Day 2: ₹{result.dailyAmount} × {result.annualInterestRate}% × ({result.days} - 2) / 365</div>
              <div className="text-gray-400">...</div>
              <div>Day {result.days}: ₹{result.dailyAmount} × {result.annualInterestRate}% × 0 / 365 = ₹0.00</div>
            </div>
          </div>
        </div>
      </div>

      {/* OPTIONAL BREAKDOWN SECTION */}
      <div className="mt-10 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowBreakdown((prev) => !prev)}
          className="w-full px-6 py-4.5 flex items-center justify-between bg-white hover:bg-gray-50/70 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                View Interest Breakdown
              </h3>
              <p className="text-xs text-gray-500">
                Detailed day-by-day table of installments, investment durations, and earned interest
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
              {showBreakdown ? 'Hide Breakdown' : 'Expand Table'}
            </span>
            {showBreakdown ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </button>

        {showBreakdown && result.isValid && breakdownData && (
          <div className="border-t border-gray-100 p-5 sm:p-6 bg-gray-50/40">
            {/* BREAKDOWN HEADER CONTROLS */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="text-xs text-gray-500">
                Showing{' '}
                <strong className="text-gray-800">
                  {(breakdownData.currentPage - 1) * breakdownData.pageSize + 1}
                </strong>{' '}
                to{' '}
                <strong className="text-gray-800">
                  {Math.min(
                    breakdownData.currentPage * breakdownData.pageSize,
                    breakdownData.totalRows
                  )}
                </strong>{' '}
                of <strong className="text-gray-800">{breakdownData.totalRows}</strong> days
              </div>

              <div className="flex items-center gap-2">
                {/* Page Size Selector */}
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span>Rows:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setBreakdownPage(1);
                    }}
                    className="border border-gray-300 rounded-lg bg-white px-2 py-1 text-xs font-semibold outline-none focus:border-indigo-600"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                {/* CSV Download Button */}
                <button
                  type="button"
                  onClick={handleDownloadCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:text-indigo-600 hover:border-indigo-200 shadow-2xs transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download CSV
                </button>
              </div>
            </div>

            {/* BREAKDOWN TABLE */}
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-2xs">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold">
                    <th className="py-3 px-4">Day</th>
                    <th className="py-3 px-4">Deposit</th>
                    <th className="py-3 px-4">Remaining Days</th>
                    <th className="py-3 px-4 text-right">Interest</th>
                    <th className="py-3 px-4 text-right">Cumulative Deposit</th>
                    <th className="py-3 px-4 text-right">Cumulative Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {breakdownData.rows.map((row) => (
                    <tr
                      key={row.day}
                      className="hover:bg-indigo-50/30 transition-colors font-mono text-xs"
                    >
                      <td className="py-2.5 px-4 font-bold text-gray-900">
                        Day {row.day}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-gray-700">
                        {formatCurrency(row.deposit)}
                      </td>
                      <td className="py-2.5 px-4 text-gray-500">
                        {row.remainingDays} days
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-amber-700">
                        {formatCurrency(row.interest)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-gray-600">
                        {formatCurrency(row.cumulativeDeposit)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-800">
                        {formatCurrency(row.cumulativeDeposit + row.cumulativeInterest)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINATION CONTROLS */}
            {breakdownData.totalPages > 1 && (
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <span className="text-xs text-gray-500 font-medium">
                  Page {breakdownData.currentPage} of {breakdownData.totalPages}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBreakdownPage(1)}
                    disabled={breakdownData.currentPage <= 1}
                    className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    First
                  </button>
                  <button
                    type="button"
                    onClick={() => setBreakdownPage((p) => Math.max(1, p - 1))}
                    disabled={breakdownData.currentPage <= 1}
                    className="px-3 py-1 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Prev
                  </button>

                  <span className="px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700">
                    {breakdownData.currentPage}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setBreakdownPage((p) => Math.min(breakdownData.totalPages, p + 1))
                    }
                    disabled={breakdownData.currentPage >= breakdownData.totalPages}
                    className="px-3 py-1 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                  <button
                    type="button"
                    onClick={() => setBreakdownPage(breakdownData.totalPages)}
                    disabled={breakdownData.currentPage >= breakdownData.totalPages}
                    className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Last
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
