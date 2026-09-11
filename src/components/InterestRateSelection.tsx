import React, { useState } from 'react';
import { Percent, Check } from 'lucide-react';

interface InterestRateSelectionProps {
  selectedRate: number;
  onRateChange: (rate: number) => void;
}

const PRESET_RATES = [8, 10, 12, 14, 15, 18];

export const InterestRateSelection: React.FC<InterestRateSelectionProps> = ({
  selectedRate,
  onRateChange,
}) => {
  const isPresetRate = PRESET_RATES.includes(selectedRate);

  const [customRate, setCustomRate] = useState(
    isPresetRate ? '' : String(selectedRate)
  );

  const handlePresetChange = (rate: number) => {
    setCustomRate('');
    onRateChange(rate);
  };

  const handleCustomChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;

    setCustomRate(value);

    if (value === '') {
      return;
    }

    const numericValue = Number(value);

    if (
      !Number.isNaN(numericValue) &&
      numericValue > 0 &&
      numericValue <= 100
    ) {
      onRateChange(numericValue);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pt-6">

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">

        {/* HEADER */}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">

          <div className="flex items-start gap-3">

            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
              <Percent className="w-5 h-5 text-amber-600" />
            </div>

            <div>

              <h3 className="text-base sm:text-lg font-bold text-gray-900">
                Interest Rate
              </h3>

              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Select the annual interest rate for this calculation.
              </p>

            </div>

          </div>

          <div className="text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg">
            Selected: {selectedRate.toFixed(2)}%
          </div>

        </div>

        {/* PRESET RATES */}

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">

          {PRESET_RATES.map((rate) => {
            const isSelected = selectedRate === rate;

            return (
              <button
                key={rate}
                type="button"
                onClick={() => handlePresetChange(rate)}
                className={`
                  relative min-h-[48px] rounded-xl border-2
                  text-sm sm:text-base font-bold
                  transition-all duration-200
                  focus:outline-none
                  focus:ring-4 focus:ring-amber-100
                  ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50 text-amber-800 shadow-sm'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-amber-300 hover:bg-amber-50/50'
                  }
                `}
              >

                {isSelected && (
                  <span className="absolute top-1.5 right-1.5">
                    <Check className="w-3.5 h-3.5 text-amber-600" />
                  </span>
                )}

                {rate}%

              </button>
            );
          })}

        </div>

        {/* CUSTOM RATE */}

        <div className="mt-4 pt-4 border-t border-gray-100">

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">

            <button
              type="button"
              onClick={() => {
                if (customRate === '') {
                  setCustomRate(String(selectedRate));
                }

                if (PRESET_RATES.includes(selectedRate)) {
                  onRateChange(selectedRate);
                }
              }}
              className={`
                min-h-[48px] px-5 rounded-xl border-2
                text-sm font-bold transition-all
                ${
                  !isPresetRate
                    ? 'border-amber-500 bg-amber-50 text-amber-800'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-amber-300'
                }
              `}
            >
              Custom Rate
            </button>

            <div className="relative flex-1 max-w-sm">

              <input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={customRate}
                onChange={handleCustomChange}
                placeholder="Enter custom rate"
                className="w-full h-12 rounded-xl border border-gray-300 bg-white px-4 pr-10 text-sm font-semibold text-gray-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-50"
              />

              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">
                %
              </span>

            </div>

          </div>

          <p className="text-xs text-gray-400 mt-2">
            Custom rate can be between 0.01% and 100%.
          </p>

        </div>

      </div>

    </div>
  );
};