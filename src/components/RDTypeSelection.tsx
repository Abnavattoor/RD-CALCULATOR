import React from 'react';
import { CalendarDays, ArrowRight, Calculator, Upload, Sparkles } from 'lucide-react';

interface RDTypeSelectionProps {
  onSelect: (type: 'Daily RD' | 'Monthly RD') => void;
}

export const RDTypeSelection: React.FC<RDTypeSelectionProps> = ({
  onSelect,
}) => {
  return (
    <div className="min-h-[calc(100vh-140px)] bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-10 sm:py-16">
      <div className="max-w-6xl mx-auto">

        {/* Hero */}
        <div className="text-center mb-12">

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-sm font-semibold mb-5">
            <Sparkles className="w-4 h-4" />
            RD Maturity Processing System
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
            Choose Your RD Type
          </h1>

          <p className="max-w-2xl mx-auto mt-4 text-base sm:text-lg text-slate-500 leading-relaxed">
            Select the type of Recurring Deposit you want to calculate,
            then upload the corresponding personal ledger.
          </p>
        </div>

        {/* Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">

          {/* Daily RD */}
          <button
            type="button"
            onClick={() => onSelect('Daily RD')}
            className="group text-left bg-white rounded-2xl border-2 border-slate-200 hover:border-blue-500 shadow-sm hover:shadow-xl transition-all duration-300 p-7 sm:p-8 cursor-pointer"
          >
            <div className="flex items-start justify-between">

              <div className="w-14 h-14 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                <CalendarDays className="w-7 h-7 text-blue-600" />
              </div>

              <ArrowRight className="w-6 h-6 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </div>

            <div className="mt-7">

              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-slate-900">
                  Daily RD
                </h2>

                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  DAILY
                </span>
              </div>

              <p className="text-slate-500 leading-relaxed">
                Process a Daily Recurring Deposit ledger using the
                progressive daily interest calculation method.
              </p>

              <div className="mt-6 pt-5 border-t border-slate-100">

                <div className="flex items-center gap-3 text-sm text-slate-600 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Calculator className="w-4 h-4 text-slate-600" />
                  </div>
                  Progressive daily interest
                </div>

                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Upload className="w-4 h-4 text-slate-600" />
                  </div>
                  Upload Daily RD ledger
                </div>

              </div>

              <div className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-blue-600 group-hover:text-blue-700">
                Continue with Daily RD
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>

            </div>
          </button>

          {/* Monthly RD */}
          <button
            type="button"
            onClick={() => onSelect('Monthly RD')}
            className="group text-left bg-white rounded-2xl border-2 border-slate-200 hover:border-emerald-500 shadow-sm hover:shadow-xl transition-all duration-300 p-7 sm:p-8 cursor-pointer"
          >
            <div className="flex items-start justify-between">

              <div className="w-14 h-14 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <CalendarDays className="w-7 h-7 text-emerald-600" />
              </div>

              <ArrowRight className="w-6 h-6 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
            </div>

            <div className="mt-7">

              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-slate-900">
                  Monthly RD
                </h2>

                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  MONTHLY
                </span>
              </div>

              <p className="text-slate-500 leading-relaxed">
                Process a Monthly Recurring Deposit ledger using the
                progressive monthly installment interest calculation.
              </p>

              <div className="mt-6 pt-5 border-t border-slate-100">

                <div className="flex items-center gap-3 text-sm text-slate-600 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Calculator className="w-4 h-4 text-slate-600" />
                  </div>
                  Progressive monthly interest
                </div>

                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Upload className="w-4 h-4 text-slate-600" />
                  </div>
                  Upload Monthly RD ledger
                </div>

              </div>

              <div className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-emerald-600 group-hover:text-emerald-700">
                Continue with Monthly RD
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>

            </div>
          </button>

        </div>

        {/* Bottom information */}
        <div className="max-w-4xl mx-auto mt-10 text-center">

          <div className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-500 bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <Upload className="w-4 h-4 text-blue-500" />
            Supported files: .xlsx and .xls
          </div>

        </div>

      </div>
    </div>
  );
};