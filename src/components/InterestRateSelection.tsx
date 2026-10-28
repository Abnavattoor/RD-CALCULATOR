/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Percent,
  Minus,
  Plus,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  adjustRate,
  validateRateInput,
  RATE_ADJUSTMENT_STEP,
  CONFIGURABLE_MAX_INTEREST_RATE,
  CONFIGURABLE_MIN_INTEREST_RATE,
} from '../utils/rdInterestCalculator';

interface InterestRateSelectionProps {
  selectedRate: number;
  onRateChange: (rate: number) => void;
  defaultRate?: number;
  tenureLabel?: string;
  step?: number;
  maxRate?: number;
  minRate?: number;
}

const PRESET_RATES = [8, 10, 12, 12.5, 13, 14, 15];

export const InterestRateSelection: React.FC<InterestRateSelectionProps> = ({
  selectedRate,
  onRateChange,
  defaultRate = 12.0,
  tenureLabel,
  step = RATE_ADJUSTMENT_STEP,
  maxRate = CONFIGURABLE_MAX_INTEREST_RATE,
  minRate = CONFIGURABLE_MIN_INTEREST_RATE,
}) => {
  const [inputValue, setInputValue] = useState<string>(selectedRate.toString());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync internal input string when external selectedRate changes
  useEffect(() => {
    setInputValue(selectedRate.toString());
    setErrorMessage(null);
  }, [selectedRate]);

  // Handle +0.1 pp increase
  const handleIncrease = () => {
    const nextRate = adjustRate(selectedRate, step, maxRate, minRate);
    onRateChange(nextRate);
  };

  // Handle -0.1 pp decrease
  const handleDecrease = () => {
    const nextRate = adjustRate(selectedRate, -step, maxRate, minRate);
    onRateChange(nextRate);
  };

  // Handle direct numeric input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputValue(text);

    if (text.trim() === '') {
      setErrorMessage('Please enter an interest rate.');
      return;
    }

    const validation = validateRateInput(text, maxRate, minRate);
    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Invalid rate');
    } else {
      setErrorMessage(null);
      onRateChange(validation.value);
    }
  };

  // Handle reset to duration-specific default rate
  const handleReset = () => {
    onRateChange(defaultRate);
    setInputValue(defaultRate.toString());
    setErrorMessage(null);
  };

  // Preset rate buttons
  const handlePresetClick = (rate: number) => {
    onRateChange(rate);
    setInputValue(rate.toString());
    setErrorMessage(null);
  };

  const isDefaultRate = Math.abs(selectedRate - defaultRate) < 0.001;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pt-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-7">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 text-amber-600 shadow-xs">
              <Percent className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">
                  Interest Rate Adjustment
                </h3>
                {tenureLabel && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                    {tenureLabel}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Adjust annual interest rate in increments of {step} percentage points or enter a custom rate.
              </p>
            </div>
          </div>

          {/* ACTIVE RATE PILL */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Current Rate
              </span>
              <span className="text-base sm:text-lg font-black font-mono text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl">
                {selectedRate.toFixed(2)}% per annum
              </span>
            </div>

            <button
              type="button"
              onClick={handleReset}
              disabled={isDefaultRate}
              title={`Restore default rate (${defaultRate}% p.a.)`}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                isDefaultRate
                  ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                  : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 active:scale-[0.98] cursor-pointer'
              }`}
              aria-label="Restore default interest rate"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset ({defaultRate}%)
            </button>
          </div>
        </div>

        {/* STEPPER & NUMERIC INPUT CONTROLS */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 rounded-xl bg-gray-50/80 border border-gray-200 mb-6">
          {/* Stepper buttons & direct input */}
          <div className="md:col-span-7 flex flex-wrap items-center gap-2.5">
            {/* Minus Button */}
            <button
              type="button"
              onClick={handleDecrease}
              disabled={selectedRate <= minRate}
              className="w-12 h-12 rounded-xl border-2 border-gray-200 bg-white hover:border-amber-400 hover:bg-amber-50/50 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-gray-700 hover:text-amber-700 font-bold transition shadow-xs cursor-pointer"
              title={`Decrease interest rate by ${step}%`}
              aria-label={`Decrease interest rate by ${step} percentage points`}
            >
              <Minus className="w-5 h-5" />
            </button>

            {/* Direct Input */}
            <div className="relative flex-1 min-w-[140px] max-w-[220px]">
              <input
                type="number"
                min={minRate}
                max={maxRate}
                step={step}
                value={inputValue}
                onChange={handleInputChange}
                aria-label="Direct annual interest rate input"
                className="w-full h-12 rounded-xl border-2 border-amber-300 bg-white pl-4 pr-16 text-lg font-black font-mono text-gray-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded">
                % p.a.
              </span>
            </div>

            {/* Plus Button */}
            <button
              type="button"
              onClick={handleIncrease}
              disabled={selectedRate >= maxRate}
              className="w-12 h-12 rounded-xl border-2 border-gray-200 bg-white hover:border-amber-400 hover:bg-amber-50/50 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-gray-700 hover:text-amber-700 font-bold transition shadow-xs cursor-pointer"
              title={`Increase interest rate by ${step}%`}
              aria-label={`Increase interest rate by ${step} percentage points`}
            >
              <Plus className="w-5 h-5" />
            </button>

            {/* Reset Button */}
            <button
              type="button"
              onClick={handleReset}
              disabled={isDefaultRate}
              title={`Restore default rate (${defaultRate}% p.a.)`}
              className={`h-12 px-3.5 rounded-xl border-2 text-xs font-bold transition-all flex items-center gap-1.5 ${
                isDefaultRate
                  ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                  : 'border-amber-300 bg-white text-amber-800 hover:bg-amber-100 hover:border-amber-400 active:scale-[0.98] cursor-pointer shadow-xs'
              }`}
              aria-label="Restore default interest rate"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset ({defaultRate}%)</span>
            </button>

            <span className="text-xs text-gray-500 font-medium ml-1">
              Step: <strong>±{step}%</strong>
            </span>
          </div>

          {/* Quick Info text */}
          <div className="md:col-span-5 text-left md:text-right text-xs text-gray-500">
            <span>
              Configurable range: <strong>{minRate}%</strong> to <strong>{maxRate}%</strong> per annum.
            </span>
            <br />
            <span>Maturity and interest recalculate immediately.</span>
          </div>
        </div>

        {/* ERROR ALERT IF INVALID */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* PRESET CHIPS */}
        <div>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
            Common Interest Rates
          </span>
          <div className="flex flex-wrap gap-2">
            {PRESET_RATES.map((rate) => {
              const isSelected = Math.abs(selectedRate - rate) < 0.001;
              const isDefaultChip = Math.abs(defaultRate - rate) < 0.001;
              return (
                <button
                  key={rate}
                  type="button"
                  onClick={() => handlePresetClick(rate)}
                  className={`px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs ring-2 ring-amber-100'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-amber-300 hover:bg-amber-50/30'
                  }`}
                  aria-pressed={isSelected}
                >
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />}
                  <span>{rate}%</span>
                  {isDefaultChip && (
                    <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-50 px-1 rounded">
                      Default
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};