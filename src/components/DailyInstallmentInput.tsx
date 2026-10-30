/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CalendarDays, ArrowRight, ShieldCheck, Check, Sparkles, Coins } from 'lucide-react';

interface DailyInstallmentInputProps {
  initialAmount?: number;
  onContinue: (installmentAmount: number) => void;
  onBack: () => void;
}

const PRESET_AMOUNTS = [50, 100, 200, 500, 1000];

export const DailyInstallmentInput: React.FC<DailyInstallmentInputProps> = ({
  initialAmount = 100,
  onContinue,
  onBack,
}) => {
  const [amount, setAmount] = useState<string>(String(initialAmount));
  const [error, setError] = useState<string | null>(null);

  const numericAmount = parseFloat(amount);
  const isValid = !isNaN(numericAmount) && numericAmount > 0;
  const required90DayAmount = isValid ? numericAmount * 90 : 9000;

  const handlePresetClick = (preset: number) => {
    setAmount(String(preset));
    setError(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, '');
    setAmount(val);
    if (val === '' || parseFloat(val) <= 0) {
      setError('Please enter a valid positive daily installment amount.');
    } else {
      setError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setError('Please enter a valid contractual daily installment amount (e.g. ₹100).');
      return;
    }
    onContinue(Math.round(numericAmount * 100) / 100);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-xs font-semibold text-blue-700 mb-4">
          <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
          <span>Daily RD Setup • Step 2 of 3</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          Enter Daily RD Installment
        </h2>
        <p className="mt-2 text-sm text-gray-600 max-w-lg mx-auto">
          Specify the contractual daily installment amount for this account. This amount is used to determine the required 90-day deposit threshold.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm">
        {/* Preset Selector */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
            Quick Select Common Installments
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
            {PRESET_AMOUNTS.map((preset) => {
              const isSelected = numericAmount === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className={`py-3 px-3 rounded-2xl text-center border-2 font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 text-blue-700 shadow-xs ring-2 ring-blue-100'
                      : 'border-gray-200 bg-gray-50/50 text-gray-700 hover:border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  <div className="text-sm sm:text-base font-extrabold">₹{preset}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    {preset === 100 ? 'Default' : '/ day'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Input */}
        <div className="mt-6">
          <label htmlFor="daily-amount-input" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
            Contractual Daily Installment (₹ / day)
          </label>
          <div className="relative rounded-2xl shadow-xs">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-xl font-bold text-gray-500">₹</span>
            </div>
            <input
              id="daily-amount-input"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={handleInputChange}
              placeholder="100"
              className={`w-full pl-9 pr-4 py-3.5 text-lg font-bold rounded-2xl border-2 focus:outline-none focus:ring-4 transition-all ${
                error
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-100 text-red-900'
                  : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100 text-gray-900 bg-white'
              }`}
            />
          </div>
          {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
        </div>

        {/* Dynamic Calculation Info Box */}
        <div className="mt-6 bg-slate-50 border border-slate-200/80 rounded-2xl p-4.5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700 shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div className="text-xs leading-relaxed text-slate-700">
              <p className="font-bold text-slate-900 text-sm">Required 90-Day Calculation Rule</p>
              <p className="mt-1">
                Required 90-Day Amount = Contractual Daily Installment × 90
              </p>
              <div className="mt-2.5 flex items-center gap-2 font-mono font-bold text-blue-800 bg-white border border-slate-200 rounded-xl px-3 py-1.5 w-fit">
                <span>₹{isValid ? numericAmount.toLocaleString() : '100'}</span>
                <span>× 90 days =</span>
                <span className="text-blue-600">₹{required90DayAmount.toLocaleString()}</span>
              </div>
              <p className="mt-2 text-slate-500 text-[11px]">
                Any actual collections in the final 90 calendar days exceeding ₹{required90DayAmount.toLocaleString()} will become Non-Profit amount A.
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Actions */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onBack}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            ← Back to RD Type
          </button>

          <button
            type="submit"
            disabled={!isValid}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-sm font-bold shadow-md shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <span>Continue to Document Upload</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
