/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
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
  Minus,
  Plus,
  Sparkles,
} from 'lucide-react';
import {
  calculateDailyRDMaturity,
  calculateMonthlyRDMaturity,
  getDailyRDBreakdownPage,
  getMonthlyRDBreakdown,
  generateRDCSVReport,
  formatCurrency,
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
} from '../utils/rdInterestCalculator';

interface DailyRDInterestCalculatorProps {
  onBackToCalculators?: () => void;
}

export const DailyRDInterestCalculator: React.FC<DailyRDInterestCalculatorProps> = ({
  onBackToCalculators,
}) => {
  // Scheme Selection: Daily RD vs Monthly RD
  const [schemeType, setSchemeType] = useState<RDSchemeType>('Daily RD');

  // Daily RD state (Default reference case: 365 days, 54.767/day, 12% p.a.)
  const [dailyDays, setDailyDays] = useState<number>(365);
  const [dailyAmountInput, setDailyAmountInput] = useState<string>('54.767');
  const [dailyRate, setDailyRate] = useState<number>(12.0);
  const [dailyRateInput, setDailyRateInput] = useState<string>('12.0');

  // Monthly RD state
  const [monthlyMonths, setMonthlyMonths] = useState<number>(12);
  const [monthlyAmountInput, setMonthlyAmountInput] = useState<string>('2000');
  const [monthlyRate, setMonthlyRate] = useState<number>(12.0);
  const [monthlyRateInput, setMonthlyRateInput] = useState<string>('12.0');

  // UI Breakdown states
  const [showBreakdown, setShowBreakdown] = useState<boolean>(false);
  const [breakdownPage, setBreakdownPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const isDaily = schemeType === 'Daily RD';

  // Duration options for current scheme
  const durationOptions = isDaily
    ? DAILY_RD_SUPPORTED_DURATIONS
    : MONTHLY_RD_SUPPORTED_DURATIONS;

  // Current active duration value
  const currentDuration = isDaily ? dailyDays : monthlyMonths;

  // Associated default rate for the selected duration
  const defaultRateForCurrentDuration = useMemo(() => {
    return getDefaultRateForDuration(schemeType, currentDuration);
  }, [schemeType, currentDuration]);

  // Active rate & rate setter
  const activeRate = isDaily ? dailyRate : monthlyRate;
  const activeRateInput = isDaily ? dailyRateInput : monthlyRateInput;

  // Active installment input
  const activeInstallmentInput = isDaily ? dailyAmountInput : monthlyAmountInput;
  const parsedInstallment = Number(activeInstallmentInput);

  // Live calculation using dedicated module
  const result: RDCalculationResult = useMemo(() => {
    if (isDaily) {
      return calculateDailyRDMaturity(dailyDays, parsedInstallment, dailyRate);
    } else {
      return calculateMonthlyRDMaturity(monthlyMonths, parsedInstallment, monthlyRate);
    }
  }, [isDaily, dailyDays, monthlyMonths, parsedInstallment, dailyRate, monthlyRate]);

  // Synchronize rate input display when active rate changes
  useEffect(() => {
    if (isDaily) {
      setDailyRateInput(dailyRate.toString());
    } else {
      setMonthlyRateInput(monthlyRate.toString());
    }
  }, [isDaily, dailyRate, monthlyRate]);

  // Handle changing duration:
  // "Do not automatically change the rate to 12.5% or 13% when the duration changes."
  // "Keep 12% as the default for all supported Monthly RD durations unless the user changes it."
  const handleDurationChange = (val: number) => {
    if (isDaily) {
      const newDefaultRate = getDefaultRateForDuration(schemeType, val);
      setDailyDays(val);
      setDailyRate(newDefaultRate);
      setDailyRateInput(newDefaultRate.toString());
    } else {
      setMonthlyMonths(val);
      // For Monthly RD, retain the user's rate or the 12.0% default; do not auto-switch to 12.5% or 13%
    }
    setBreakdownPage(1);
  };

  // Handle changing scheme:
  const handleSchemeChange = (newScheme: RDSchemeType) => {
    setSchemeType(newScheme);
    setBreakdownPage(1);
  };

  // Interest rate adjustments: +0.1 pp
  const handleIncreaseRate = () => {
    const nextRate = adjustRate(activeRate, RATE_ADJUSTMENT_STEP);
    if (isDaily) {
      setDailyRate(nextRate);
      setDailyRateInput(nextRate.toString());
    } else {
      setMonthlyRate(nextRate);
      setMonthlyRateInput(nextRate.toString());
    }
  };

  // Interest rate adjustments: -0.1 pp
  const handleDecreaseRate = () => {
    const nextRate = adjustRate(activeRate, -RATE_ADJUSTMENT_STEP);
    if (isDaily) {
      setDailyRate(nextRate);
      setDailyRateInput(nextRate.toString());
    } else {
      setMonthlyRate(nextRate);
      setMonthlyRateInput(nextRate.toString());
    }
  };

  // Direct numeric input for rate
  const handleRateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (isDaily) {
      setDailyRateInput(val);
    } else {
      setMonthlyRateInput(val);
    }

    if (val.trim() === '') return;
    const validated = validateRateInput(val);
    if (validated.isValid) {
      if (isDaily) {
        setDailyRate(validated.value);
      } else {
        setMonthlyRate(validated.value);
      }
    }
  };

  // Reset interest rate:
  // "Reset must restore the correct default rate for the selected duration."
  // "Keep the installment amount and duration unchanged when the rate is adjusted."
  const handleResetRate = () => {
    const defaultR = defaultRateForCurrentDuration;
    if (isDaily) {
      setDailyRate(defaultR);
      setDailyRateInput(defaultR.toString());
    } else {
      setMonthlyRate(defaultR);
      setMonthlyRateInput(defaultR.toString());
    }
  };

  // Reset entire calculator to defaults
  const handleFullReset = () => {
    if (isDaily) {
      setDailyDays(365);
      setDailyAmountInput('54.767');
      setDailyRate(12.0);
      setDailyRateInput('12.0');
    } else {
      setMonthlyMonths(12);
      setMonthlyAmountInput('2000');
      setMonthlyRate(12.0);
      setMonthlyRateInput('12.0');
    }
    setShowBreakdown(false);
    setBreakdownPage(1);
  };

  // Paginated breakdown data
  const breakdownData = useMemo(() => {
    if (!result.isValid || !showBreakdown) return null;

    if (isDaily) {
      return getDailyRDBreakdownPage(
        dailyDays,
        parsedInstallment,
        dailyRate,
        breakdownPage,
        pageSize
      );
    } else {
      const allRows = getMonthlyRDBreakdown(monthlyMonths, parsedInstallment, monthlyRate);
      return {
        rows: allRows,
        totalRows: allRows.length,
        currentPage: 1,
        totalPages: 1,
        pageSize: allRows.length,
      };
    }
  }, [isDaily, dailyDays, monthlyMonths, parsedInstallment, dailyRate, monthlyRate, showBreakdown, breakdownPage, pageSize, result.isValid]);

  // CSV download
  const handleDownloadCSV = () => {
    if (!result.isValid) return;
    const csvContent = generateRDCSVReport(
      schemeType,
      currentDuration,
      parsedInstallment,
      activeRate
    );
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `${schemeType.replace(/\s+/g, '_')}_${currentDuration}${isDaily ? 'days' : 'months'}_rate${activeRate}pct.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isRateAtDefault = Math.abs(activeRate - defaultRateForCurrentDuration) < 0.001;

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
              Recurring Deposit Calculator
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
              RD Interest & Maturity Calculator
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onBackToCalculators && (
            <button
              type="button"
              onClick={onBackToCalculators}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm font-semibold text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50 shadow-xs transition-all cursor-pointer"
            >
              ← Back to Calculators
            </button>
          )}

          <button
            type="button"
            onClick={handleFullReset}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm font-semibold text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50 shadow-xs transition-all cursor-pointer"
            title="Reset calculator to initial state"
          >
            <RotateCcw className="w-4 h-4 text-gray-400" />
            Reset All
          </button>
        </div>
      </div>

      {/* SCHEME TOGGLE: DAILY RD vs MONTHLY RD */}
      <div className="mb-6 p-1.5 bg-gray-100/90 rounded-2xl max-w-md mx-auto flex items-center shadow-inner">
        <button
          type="button"
          onClick={() => handleSchemeChange('Daily RD')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            isDaily
              ? 'bg-white text-indigo-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
          }`}
          aria-pressed={isDaily}
        >
          <CalendarDays className="w-4 h-4 text-blue-600" />
          Daily RD (DALIY)
        </button>

        <button
          type="button"
          onClick={() => handleSchemeChange('Monthly RD')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            !isDaily
              ? 'bg-white text-emerald-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
          }`}
          aria-pressed={!isDaily}
        >
          <Coins className="w-4 h-4 text-emerald-600" />
          Monthly RD (MONTHLY)
        </button>
      </div>

      {/* DESCRIPTION */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-100/80 p-4 sm:p-5 mb-8">
        <p className="text-sm text-gray-700 leading-relaxed">
          {isDaily ? (
            <>
              <strong>Daily Recurring Deposit:</strong> Calculate the accumulated deposit and daily interest
              for <strong>365</strong>, <strong>730</strong>, or <strong>1,095</strong> days. Follows the intended daily balance accumulation
              and daily interest sequence with interactive rate adjustment controls.
            </>
          ) : (
            <>
              <strong>Monthly Recurring Deposit:</strong> Calculate the accumulated monthly installments and interest
              for <strong>12</strong>, <strong>24</strong>, or <strong>36</strong> months. Follows monthly balance accumulation
              with precise rate adjustment controls.
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: INPUTS & CONTROLS */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 sm:p-7">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-indigo-600" />
              {schemeType} Parameters
            </h3>

            {/* PARAMETER 1: SUPPORTED DURATION SELECTION */}
            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-blue-600" />
                  Duration / Term
                </label>
                <span className="text-xs font-semibold text-gray-500">
                  {isDaily ? 'Days' : 'Months'}
                </span>
              </div>

              {/* Supported Duration Buttons */}
              <div className="grid grid-cols-3 gap-2">
                {durationOptions.map((opt) => {
                  const isSelected = currentDuration === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleDurationChange(opt.value)}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 font-bold shadow-xs ring-2 ring-indigo-100'
                          : 'border-gray-200 bg-gray-50 hover:bg-white text-gray-700 hover:border-gray-300'
                      }`}
                      aria-pressed={isSelected}
                    >
                      <div className="text-sm sm:text-base font-extrabold">{opt.value} {isDaily ? 'Days' : 'Mos'}</div>
                      <div className="text-[11px] text-gray-500">{opt.years} {opt.years === 1 ? 'Year' : 'Years'}</div>
                      <div className="mt-1 text-[10px] font-bold text-indigo-700 bg-white/80 py-0.5 rounded border border-indigo-100">
                        Default: {opt.defaultRate}%
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PARAMETER 2: INSTALLMENT AMOUNT */}
            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="installment-amount"
                  className="text-sm font-bold text-gray-900 flex items-center gap-2"
                >
                  <IndianRupee className="w-4 h-4 text-emerald-600" />
                  {isDaily ? 'Daily Installment Amount' : 'Monthly Installment Amount'}
                </label>
                <span className="text-xs font-semibold text-gray-500">
                  {isDaily ? 'per day' : 'per month'}
                </span>
              </div>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-gray-500">
                  ₹
                </span>
                <input
                  id="installment-amount"
                  type="number"
                  min="0.01"
                  step="any"
                  value={activeInstallmentInput}
                  onChange={(e) => {
                    if (isDaily) {
                      setDailyAmountInput(e.target.value);
                    } else {
                      setMonthlyAmountInput(e.target.value);
                    }
                    setBreakdownPage(1);
                  }}
                  placeholder={isDaily ? '54.767' : '1000'}
                  className="w-full h-12 rounded-xl border border-gray-300 bg-white pl-9 pr-4 text-base font-bold text-gray-900 outline-none transition focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50"
                />
              </div>

              {/* Installment Presets */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(isDaily
                  ? [
                      { label: '₹54.77 (Ref)', val: '54.767' },
                      { label: '₹55', val: '55' },
                      { label: '₹100', val: '100' },
                      { label: '₹200', val: '200' },
                      { label: '₹500', val: '500' },
                      { label: '₹1,000', val: '1000' },
                    ]
                  : [
                      { label: '₹500', val: '500' },
                      { label: '₹1,000', val: '1000' },
                      { label: '₹2,000', val: '2000' },
                      { label: '₹3,000', val: '3000' },
                      { label: '₹5,000', val: '5000' },
                    ]
                ).map((preset) => {
                  const isActive = activeInstallmentInput === preset.val || Number(activeInstallmentInput) === Number(preset.val);
                  return (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => {
                        if (isDaily) setDailyAmountInput(preset.val);
                        else setMonthlyAmountInput(preset.val);
                        setBreakdownPage(1);
                      }}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                        isActive
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PARAMETER 3: INTERACTIVE INTEREST-RATE CONTROLS (REQUIREMENT 2) */}
            <div className="space-y-3 mb-6 p-4 rounded-xl bg-amber-50/40 border border-amber-200">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-amber-600" />
                  Annual Interest Rate
                </label>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-amber-900 bg-amber-100/80 px-2.5 py-0.5 rounded-lg border border-amber-200">
                    {activeRate.toFixed(2)}% per annum {!isDaily && `(${(activeRate / 12).toFixed(2)}% / mo)`}
                  </span>
                </div>
              </div>

              {/* Stepper buttons & Numeric Input with 0.1 pp step, with Reset button beside */}
              <div className="flex items-center gap-2 pt-1">
                {/* Minus (−) Button */}
                <button
                  type="button"
                  onClick={handleDecreaseRate}
                  disabled={activeRate <= CONFIGURABLE_MIN_INTEREST_RATE}
                  className="w-11 h-11 rounded-xl border-2 border-amber-300 bg-white hover:border-amber-500 hover:bg-amber-50 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-amber-900 font-bold transition shadow-xs cursor-pointer"
                  title="Decrease rate by 0.1% per annum"
                  aria-label="Decrease interest rate by 0.1 percentage points"
                >
                  <Minus className="w-4 h-4" />
                </button>

                {/* Editable Numeric Interest-Rate Input */}
                <div className="relative flex-1">
                  <input
                    type="number"
                    min={CONFIGURABLE_MIN_INTEREST_RATE}
                    max={CONFIGURABLE_MAX_INTEREST_RATE}
                    step={RATE_ADJUSTMENT_STEP}
                    value={activeRateInput}
                    onChange={handleRateInputChange}
                    aria-label="Enter specific annual interest rate"
                    className="w-full h-11 rounded-xl border-2 border-amber-400 bg-white pl-3.5 pr-14 text-base font-black font-mono text-gray-900 outline-none transition focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-amber-800">
                    % p.a.
                  </span>
                </div>

                {/* Plus (+) Button */}
                <button
                  type="button"
                  onClick={handleIncreaseRate}
                  disabled={activeRate >= CONFIGURABLE_MAX_INTEREST_RATE}
                  className="w-11 h-11 rounded-xl border-2 border-amber-300 bg-white hover:border-amber-500 hover:bg-amber-50 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-amber-900 font-bold transition shadow-xs cursor-pointer"
                  title="Increase rate by 0.1% per annum"
                  aria-label="Increase interest rate by 0.1 percentage points"
                >
                  <Plus className="w-4 h-4" />
                </button>

                {/* Reset Button */}
                <button
                  type="button"
                  onClick={handleResetRate}
                  disabled={isRateAtDefault}
                  title={`Reset to default rate (${isDaily ? defaultRateForCurrentDuration : 12.0}% p.a.)`}
                  className={`h-11 px-3 sm:px-3.5 rounded-xl border-2 font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer ${
                    isRateAtDefault
                      ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                      : 'border-amber-300 bg-white text-amber-800 hover:bg-amber-100 hover:border-amber-400 active:scale-95'
                  }`}
                  aria-label="Reset interest rate to default"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-500 pt-0.5">
                <span>Adjustment step: <strong>±0.1%</strong></span>
                {!isDaily && (
                  <span className="text-emerald-700 font-bold">Monthly rate: <strong>{(activeRate / 12).toFixed(4)}%</strong></span>
                )}
                <span>Default: <strong>{isDaily ? `${defaultRateForCurrentDuration}%` : '12.0%'}</strong></span>
              </div>
            </div>

            {/* Error Message if invalid */}
            {!result.isValid && result.errorMessage && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
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
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                {result.duration} {isDaily ? 'Days' : 'Months'} • {result.annualInterestRate}% p.a.
              </span>
            </div>

            {/* MAIN STATS GRID */}
            <div className="grid grid-cols-2 gap-3.5 mb-5">
              {/* Duration */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-xs font-semibold text-gray-500 block mb-1">
                  Selected Duration
                </span>
                <span className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  {result.duration} {isDaily ? 'Days' : 'Months'}
                </span>
                <span className="text-[11px] text-gray-400 block mt-0.5">
                  {isDaily ? `${(result.duration / 365).toFixed(2)} years` : `${(result.duration / 12).toFixed(1)} years`}
                </span>
              </div>

              {/* Installment Amount */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-xs font-semibold text-gray-500 block mb-1">
                  Installment Amount
                </span>
                <span className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  {formatCurrency(result.installmentAmount)}
                </span>
                <span className="text-[11px] text-gray-400 block mt-0.5">
                  {isDaily ? 'per day' : 'per month'}
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
                    {result.duration} installments × {formatCurrency(result.installmentAmount)}
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
                    Total Interest Earned
                  </span>
                  <span className="text-xs text-amber-700">
                    Accumulated at {result.annualInterestRate}% per annum
                  </span>
                </div>
                <span className="text-xl sm:text-2xl font-black text-amber-900">
                  {formatCurrency(result.totalInterest)}
                </span>
              </div>

              {/* Final Maturity Value */}
              <div className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-100">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-100 block">
                    Final Maturity Amount
                  </span>
                  <span className="text-xs text-emerald-200">
                    Total Deposited + Total Interest
                  </span>
                </div>
                <span className="text-2xl sm:text-3xl font-black tracking-tight font-mono">
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
              Formula & Reconciliation
            </h4>
            <p className="text-gray-600 mb-2">
              {isDaily
                ? 'Daily RD balances accumulate daily, with interest earned on each day’s progressive balance:'
                : 'Monthly RD balances accumulate monthly, with interest earned on each month’s progressive balance:'}
            </p>
            <div className="font-mono bg-white p-2.5 rounded-lg border border-gray-200 text-[11px] text-gray-700 space-y-1">
              <div>{result.formulaDescription}</div>
              <div className="text-emerald-700 font-semibold pt-1">
                Reconciliation: {formatCurrency(result.totalDeposited)} + {formatCurrency(result.totalInterest)} = {formatCurrency(result.maturityAmount)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BREAKDOWN SECTION */}
      <div className="mt-10 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowBreakdown((prev) => !prev)}
          className="w-full px-6 py-4.5 flex items-center justify-between bg-white hover:bg-gray-50/70 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                View Interest Schedule Breakdown
              </h3>
              <p className="text-xs text-gray-500">
                {isDaily
                  ? 'Day-by-day table of installments, progressive balances, and daily interest'
                  : 'Month-by-month table of installments, progressive balances, and monthly interest'}
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
                of <strong className="text-gray-800">{breakdownData.totalRows}</strong> {isDaily ? 'days' : 'months'}
              </div>

              <div className="flex items-center gap-2">
                {isDaily && (
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
                )}

                <button
                  type="button"
                  onClick={handleDownloadCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:text-indigo-600 hover:border-indigo-200 shadow-2xs transition-all cursor-pointer"
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
                    <th className="py-3 px-4">{isDaily ? 'Day' : 'Month'}</th>
                    <th className="py-3 px-4">Installment</th>
                    <th className="py-3 px-4">Cumulative Balance</th>
                    <th className="py-3 px-4 text-right">Interest</th>
                    <th className="py-3 px-4 text-right">Cumulative Deposit</th>
                    <th className="py-3 px-4 text-right">Cumulative Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {breakdownData.rows.map((row) => (
                    <tr
                      key={row.periodIndex}
                      className="hover:bg-indigo-50/30 transition-colors font-mono text-xs"
                    >
                      <td className="py-2.5 px-4 font-bold text-gray-900">
                        {row.label}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-gray-700">
                        {formatCurrency(row.deposit)}
                      </td>
                      <td className="py-2.5 px-4 text-gray-600">
                        {formatCurrency(row.balance)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-amber-700">
                        {formatCurrency(row.periodInterest)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-gray-600">
                        {formatCurrency(row.cumulativeDeposit)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-800">
                        {formatCurrency(row.cumulativeTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINATION CONTROLS (FOR DAILY RD) */}
            {isDaily && breakdownData.totalPages > 1 && (
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <span className="text-xs text-gray-500 font-medium">
                  Page {breakdownData.currentPage} of {breakdownData.totalPages}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBreakdownPage(1)}
                    disabled={breakdownData.currentPage <= 1}
                    className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer"
                  >
                    First
                  </button>
                  <button
                    type="button"
                    onClick={() => setBreakdownPage((p) => Math.max(1, p - 1))}
                    disabled={breakdownData.currentPage <= 1}
                    className="px-3 py-1 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer"
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
                    className="px-3 py-1 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer"
                  >
                    Next
                  </button>
                  <button
                    type="button"
                    onClick={() => setBreakdownPage(breakdownData.totalPages)}
                    disabled={breakdownData.currentPage >= breakdownData.totalPages}
                    className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer"
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
