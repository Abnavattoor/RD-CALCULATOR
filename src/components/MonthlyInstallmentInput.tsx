/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  ArrowRight,
  TrendingUp,
  Percent,
  Calendar,
  Layers,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { calculateMonthlyRDMaturity, formatCurrency } from '../utils/rdInterestCalculator';

export interface MonthlyRDConfigPayload {
  installmentAmount: number;
  openingDate: string; // display string DD-MM-YYYY
  displayOpeningDate: string;
  tenureMonths: number; // 12, 24, or 36
  tenureLabel: string;
  numberOfScheduledInstallments: number;
  totalScheduledDeposits: number;
  annualInterestRate: number; // e.g. 12.0
  expectedMaturityDate: string;
  expectedMaturityAmount: number;
}

interface MonthlyInstallmentInputProps {
  initialAmount?: number;
  initialOpeningDate?: string;
  initialTenureMonths?: number;
  initialAnnualRate?: number;
  onContinue: (config: MonthlyRDConfigPayload) => void;
  onBack: () => void;
}

const PRESET_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];

export const MONTHLY_TENURE_OPTIONS = [
  { label: '1 Year', months: 12 },
  { label: '2 Years', months: 24 },
  { label: '3 Years', months: 36 },
] as const;

function formatLocalDateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateToDisplay(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function parseInputDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  const parts = trimmed.split(/[-/.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const d = Number(parts[2]);
      const res = new Date(y, m, d);
      return isNaN(res.getTime()) ? null : res;
    } else {
      // DD-MM-YYYY
      const d = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const y = Number(parts[2]);
      const res = new Date(y, m, d);
      return isNaN(res.getTime()) ? null : res;
    }
  }
  const fallback = new Date(trimmed);
  return isNaN(fallback.getTime()) ? null : fallback;
}

export const MonthlyInstallmentInput: React.FC<MonthlyInstallmentInputProps> = ({
  initialAmount = 1000,
  initialOpeningDate,
  initialTenureMonths = 12,
  initialAnnualRate = 12.0,
  onContinue,
  onBack,
}) => {
  // 1. Contractual Monthly Installment
  const [amount, setAmount] = useState<string>(String(initialAmount || 1000));
  const [amountError, setAmountError] = useState<string | null>(null);

  // 2. Opening Date (HTML5 date picker uses YYYY-MM-DD)
  const defaultIsoDate = useMemo(() => {
    if (initialOpeningDate) {
      const parsed = parseInputDate(initialOpeningDate);
      if (parsed) return formatLocalDateToISO(parsed);
    }
    return '2025-10-24';
  }, [initialOpeningDate]);

  const [openingDate, setOpeningDate] = useState<string>(defaultIsoDate);
  const [dateError, setDateError] = useState<string | null>(null);

  // 3. Tenure Period (numeric months: 12, 24, 36)
  const [tenureMonths, setTenureMonths] = useState<number>(initialTenureMonths || 12);

  // 4. Annual Interest Rate (default: 12.0% for Monthly RD)
  const [annualRate] = useState<number>(initialAnnualRate || 12.0);

  // Parse amount
  const numericAmount = parseFloat(amount);
  const isAmountValid = !isNaN(numericAmount) && numericAmount >= 1000;

  // Parse opening date
  const openingDateObj = useMemo(() => parseInputDate(openingDate), [openingDate]);
  const isDateValid = openingDateObj !== null && !isNaN(openingDateObj.getTime());

  // 5. Expected Maturity Date = Opening Date + Selected Tenure Months
  const maturityDateObj = useMemo(() => {
    if (!openingDateObj) return null;
    const targetYear = openingDateObj.getFullYear() + Math.floor((openingDateObj.getMonth() + tenureMonths) / 12);
    const targetMonth = (openingDateObj.getMonth() + tenureMonths) % 12;
    const originalDay = openingDateObj.getDate();
    const maxDaysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const safeDay = Math.min(originalDay, maxDaysInTargetMonth);
    return new Date(targetYear, targetMonth, safeDay);
  }, [openingDateObj, tenureMonths]);

  const displayOpeningDate = openingDateObj ? formatDateToDisplay(openingDateObj) : '-';
  const displayMaturityDate = maturityDateObj ? formatDateToDisplay(maturityDateObj) : '-';

  // Scheduled deposits calculation: Total Scheduled Deposits = Monthly Installment × Number of Months
  const totalScheduledDeposits = isAmountValid ? Math.round(numericAmount * tenureMonths * 100) / 100 : 0;
  const numberOfScheduledInstallments = tenureMonths;

  // Expected Maturity Amount using existing Monthly RD interest engine
  const expectedCalculation = useMemo(() => {
    if (!isAmountValid || tenureMonths <= 0) {
      return { maturityAmount: 0, totalInterest: 0, totalDeposited: 0 };
    }
    return calculateMonthlyRDMaturity(tenureMonths, numericAmount, annualRate);
  }, [isAmountValid, numericAmount, tenureMonths, annualRate]);

  const selectedTenureOption =
    MONTHLY_TENURE_OPTIONS.find((opt) => opt.months === tenureMonths) || MONTHLY_TENURE_OPTIONS[0];

  // Preset button click
  const handlePresetClick = (preset: number) => {
    setAmount(String(preset));
    setAmountError(null);
  };

  // Amount input change
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, '');
    setAmount(val);
    const parsed = parseFloat(val);
    if (val === '' || isNaN(parsed) || parsed < 1000) {
      setAmountError('Please enter a valid monthly installment of at least ₹1,000.');
    } else {
      setAmountError(null);
    }
  };

  // Date input change
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setOpeningDate(val);
    if (!val) {
      setDateError('Please select a valid account opening date.');
    } else {
      setDateError(null);
    }
  };

  // Tenure dropdown change
  const handleTenureChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const months = parseInt(e.target.value, 10);
    setTenureMonths(months);
  };

  const isFormValid = isAmountValid && isDateValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAmountValid) {
      setAmountError('Monthly installment amount must be at least ₹1,000 (e.g. ₹1,000/month).');
      return;
    }
    if (!isDateValid) {
      setDateError('Please select an account opening date.');
      return;
    }

    onContinue({
      installmentAmount: Math.round(numericAmount * 100) / 100,
      openingDate: displayOpeningDate,
      displayOpeningDate,
      tenureMonths,
      tenureLabel: selectedTenureOption.label,
      numberOfScheduledInstallments,
      totalScheduledDeposits,
      annualInterestRate: annualRate,
      expectedMaturityDate: displayMaturityDate,
      expectedMaturityAmount: expectedCalculation.maturityAmount,
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-xs font-semibold text-emerald-700 mb-4">
          <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
          <span>Monthly RD Setup • Step 2 of 3</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          Monthly RD Configuration & Schedule
        </h2>
        <p className="mt-2 text-sm text-gray-600 max-w-xl mx-auto">
          Specify the contractual monthly installment amount, authoritative opening date, and tenure period. Review the live expected maturity preview before uploading customer ledgers.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-7">
        {/* ================================================================= */}
        {/* 1. CONTRACTUAL MONTHLY INSTALLMENT                                */}
        {/* ================================================================= */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
            1. Contractual Monthly RD Installment (Minimum ₹1,000)
          </label>

          {/* Quick Select Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {PRESET_AMOUNTS.map((preset) => {
              const isSelected = numericAmount === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className={`py-3 px-2 rounded-2xl text-center border-2 font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/70 text-emerald-700 shadow-xs ring-2 ring-emerald-100'
                      : 'border-gray-200 bg-gray-50/50 text-gray-700 hover:border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  <div className="text-sm font-extrabold">₹{preset.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    {preset === 1000 ? 'Default' : '/ month'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom Input */}
          <div className="mt-4">
            <div className="relative rounded-2xl shadow-xs">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-xl font-bold text-gray-500">₹</span>
              </div>
              <input
                id="monthly-amount-input"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={handleAmountChange}
                placeholder="1000"
                className={`w-full pl-9 pr-4 py-3.5 text-lg font-bold rounded-2xl border-2 focus:outline-none focus:ring-4 transition-all ${
                  amountError
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-100 text-red-900'
                    : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-100 text-gray-900 bg-white'
                }`}
              />
            </div>
            {amountError && <p className="mt-2 text-xs font-semibold text-red-600">{amountError}</p>}
          </div>
        </div>

        {/* ================================================================= */}
        {/* 2 & 3. OPENING DATE & TENURE PERIOD                               */}
        {/* ================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-gray-100">
          {/* Opening Date Field */}
          <div>
            <label htmlFor="monthly-opening-date-input" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
              2. Opening Date (First Installment)
            </label>
            <div className="relative rounded-2xl shadow-xs">
              <input
                id="monthly-opening-date-input"
                type="date"
                value={openingDate}
                onChange={handleDateChange}
                className={`w-full px-4 py-3 text-base font-semibold rounded-2xl border-2 focus:outline-none focus:ring-4 transition-all ${
                  dateError
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-100 text-red-900'
                    : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-100 text-gray-900 bg-white'
                }`}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-gray-500">
              Authoritative starting date for the Monthly RD installment schedule.
            </p>
            {dateError && <p className="mt-1 text-xs font-semibold text-red-600">{dateError}</p>}
          </div>

          {/* Tenure Period Dropdown */}
          <div>
            <label htmlFor="monthly-tenure-select" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
              3. Tenure Period
            </label>
            <div className="relative rounded-2xl shadow-xs">
              <select
                id="monthly-tenure-select"
                value={tenureMonths}
                onChange={handleTenureChange}
                className="w-full px-4 py-3 text-base font-semibold rounded-2xl border-2 border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 text-gray-900 bg-white transition-all cursor-pointer"
              >
                {MONTHLY_TENURE_OPTIONS.map((opt) => (
                  <option key={opt.months} value={opt.months}>
                    {opt.label} ({opt.months} months)
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1.5 text-[11px] text-gray-500">
              Stored numeric months: {tenureMonths} months ({selectedTenureOption.label}).
            </p>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 4. ANNUAL INTEREST RATE DISPLAY                                  */}
        {/* ================================================================= */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                4. Applicable Annual Interest Rate
              </p>
              <p className="text-sm font-semibold text-gray-900">
                Company Monthly RD Rate
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black font-mono text-emerald-700">
              {annualRate.toFixed(1)}%
            </span>
            <span className="text-xs text-gray-500 block font-medium">p.a.</span>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 5. EXPECTED MATURITY PREVIEW                                     */}
        {/* ================================================================= */}
        <div className="bg-gradient-to-br from-emerald-50/70 via-teal-50/30 to-slate-50 border-2 border-emerald-200/80 rounded-3xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-emerald-200/60">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-gray-900">
                  Expected Maturity Preview
                </h3>
                <p className="text-xs text-emerald-700 font-medium">
                  Dynamic projection based on contractual monthly schedule
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold">
              Live Preview
            </span>
          </div>

          {/* Grid of Preview Values */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-5">
            {/* Opening Date */}
            <div className="bg-white/90 border border-emerald-100 rounded-xl p-3 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Opening Date
              </span>
              <span className="text-sm font-bold text-gray-900 font-mono mt-0.5 block">
                {displayOpeningDate}
              </span>
            </div>

            {/* Monthly Installment Amount */}
            <div className="bg-white/90 border border-emerald-100 rounded-xl p-3 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Monthly Installment
              </span>
              <span className="text-sm font-bold text-emerald-700 font-mono mt-0.5 block">
                ₹{isAmountValid ? numericAmount.toLocaleString() : '1,000'} / mo
              </span>
            </div>

            {/* Selected Tenure */}
            <div className="bg-white/90 border border-emerald-100 rounded-xl p-3 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Selected Tenure
              </span>
              <span className="text-sm font-bold text-gray-900 font-mono mt-0.5 block">
                {selectedTenureOption.label} ({tenureMonths} mo)
              </span>
            </div>

            {/* Number of Scheduled Installments */}
            <div className="bg-white/90 border border-emerald-100 rounded-xl p-3 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Scheduled Installments
              </span>
              <span className="text-sm font-bold text-emerald-800 font-mono mt-0.5 block">
                {numberOfScheduledInstallments} installments
              </span>
            </div>

            {/* Total Scheduled Deposit Amount */}
            <div className="bg-white/90 border border-emerald-100 rounded-xl p-3 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Scheduled Deposits
              </span>
              <span className="text-sm font-bold text-indigo-700 font-mono mt-0.5 block">
                {formatCurrency(totalScheduledDeposits)}
              </span>
            </div>

            {/* Annual Interest Rate */}
            <div className="bg-white/90 border border-emerald-100 rounded-xl p-3 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Annual Interest Rate
              </span>
              <span className="text-sm font-bold text-amber-700 font-mono mt-0.5 block">
                {annualRate.toFixed(2)}% p.a.
              </span>
            </div>

            {/* Expected Maturity Date */}
            <div className="bg-white/90 border border-emerald-100 rounded-xl p-3 shadow-xs col-span-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Expected Maturity Date
              </span>
              <span className="text-sm font-bold text-emerald-700 font-mono mt-0.5 block">
                {displayMaturityDate}
              </span>
            </div>
          </div>

          {/* Expected Maturity Amount Hero Card */}
          <div className="rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-800 text-white p-5 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-100 text-[10px] font-bold tracking-wide uppercase mb-1">
                  Estimated Maturity Amount — Before Ledger Verification
                </span>
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white mt-1">
                  {formatCurrency(expectedCalculation.maturityAmount)}
                </div>
              </div>

              <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-emerald-500/40 pt-2 sm:pt-0 sm:pl-5">
                <span className="text-[11px] text-emerald-200 block">
                  Projected Interest
                </span>
                <span className="text-lg font-bold font-mono text-emerald-300">
                  +{formatCurrency(expectedCalculation.totalInterest)}
                </span>
                <span className="text-[10px] text-emerald-200 block">
                  (Principal: {formatCurrency(expectedCalculation.totalDeposited)})
                </span>
              </div>
            </div>

            <p className="mt-3 text-[11px] text-emerald-100/90 leading-relaxed border-t border-emerald-600/60 pt-2.5">
              This is a preliminary estimate based on the contractual installment schedule, not the actual customer's verified deposit history.
            </p>
          </div>
        </div>

        {/* ================================================================= */}
        {/* NAVIGATION ACTIONS                                                */}
        {/* ================================================================= */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onBack}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            ← Back to RD Type
          </button>

          <button
            type="submit"
            disabled={!isFormValid}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-sm font-bold shadow-md shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <span>Continue to Document Upload</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
