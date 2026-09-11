/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { RDAccountData, RDParseError } from './types';
import {
  parseRDLedgerWorkbook,
  RDValidationError,
} from './utils/excelParser';

import { recalculateRDWithRate } from './utils/rdCalculator';

import { Header } from './components/Header';
import { UploadSection } from './components/UploadSection';
import { CustomerDetails } from './components/CustomerDetails';
import { LedgerPreview } from './components/LedgerPreview';
import { MaturityResult } from './components/MaturityResult';
import { ErrorAlert } from './components/ErrorAlert';
import { InterestRateSelection } from './components/InterestRateSelection';

import {
  Calculator,
  CalendarDays,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  ShieldCheck,
  Upload,
  BarChart3,
  Sparkles,
} from 'lucide-react';

type RDSelection = 'Daily RD' | 'Monthly RD';

export default function App() {
  const [accountData, setAccountData] =
    useState<RDAccountData | null>(null);

  const [isLoading, setIsLoading] =
    useState<boolean>(false);

  const [error, setError] =
    useState<RDParseError | null>(null);

  // ---------------------------------------------------------------------------
  // Selected RD type
  // ---------------------------------------------------------------------------

  const [selectedRDType, setSelectedRDType] =
    useState<RDSelection | null>(null);

  // ---------------------------------------------------------------------------
  // Selected Interest Rate
  //
  // Default rate = 12%
  // ---------------------------------------------------------------------------

  const [selectedInterestRate, setSelectedInterestRate] =
    useState<number>(12);

  // ---------------------------------------------------------------------------
  // Handle selecting Daily RD / Monthly RD
  // ---------------------------------------------------------------------------

  const handleRDSelection = (type: RDSelection) => {
    setSelectedRDType(type);
    setError(null);
  };

  // ---------------------------------------------------------------------------
  // Handle Interest Rate Selection
  // ---------------------------------------------------------------------------

  const handleInterestRateChange = (rate: number) => {
    setSelectedInterestRate(rate);

    setAccountData((currentData) => {
      if (!currentData) {
        return currentData;
      }

      return recalculateRDWithRate(
        currentData,
        rate
      );
    });
  };

  // ---------------------------------------------------------------------------
  // Handle uploading and parsing an RD Personal Ledger Excel file
  // ---------------------------------------------------------------------------

  const handleFile = (file: File) => {
    setIsLoading(true);
    setError(null);

    const validExtensions = ['.xlsx', '.xls'];
    const lowerName = file.name.toLowerCase();

    const hasValidExt = validExtensions.some((ext) =>
      lowerName.endsWith(ext)
    );

    if (!hasValidExt || file.size === 0) {
      setIsLoading(false);

      setError({
        title: 'Invalid Ledger Format',
        message:
          'Please upload a valid RD Personal Ledger Excel file.',
      });

      setAccountData(null);
      return;
    }

    // -------------------------------------------------------------------------
    // Make sure an RD type has been selected
    // -------------------------------------------------------------------------

    if (!selectedRDType) {
      setIsLoading(false);

      setError({
        title: 'Select RD Type',
        message:
          'Please select Daily RD or Monthly RD before uploading the ledger.',
      });

      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;

        if (!buffer || buffer.byteLength === 0) {
          throw new RDValidationError(
            'Invalid Ledger Format',
            'Please upload a valid RD Personal Ledger Excel file.'
          );
        }

        // ---------------------------------------------------------------------
        // Parse Excel ledger
        // ---------------------------------------------------------------------

        const parsed = parseRDLedgerWorkbook(
          buffer,
          file.name,
          file.size
        );

        // ---------------------------------------------------------------------
        // Verify selected RD type against uploaded ledger
        // ---------------------------------------------------------------------

        if (
          parsed.rdType === 'Daily RD' ||
          parsed.rdType === 'Monthly RD'
        ) {
          if (parsed.rdType !== selectedRDType) {
            throw new RDValidationError(
              'RD Type Mismatch',
              `You selected ${selectedRDType}, but the uploaded ledger appears to be ${parsed.rdType}. Please select the correct RD type and upload the matching ledger.`
            );
          }
        }

        // ---------------------------------------------------------------------
        // Always start a newly uploaded ledger at 12%
        // ---------------------------------------------------------------------

        const calculatedData =
          recalculateRDWithRate(
            parsed,
            12
          );

        setSelectedInterestRate(12);

        setAccountData(calculatedData);

      } catch (err: any) {
        setAccountData(null);

        if (err instanceof RDValidationError) {
          setError({
            title: err.title,
            message: err.message,
          });
        } else {
          setError({
            title: 'Invalid Ledger Format',
            message:
              'Please upload a valid RD Personal Ledger Excel file.',
          });
        }
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setIsLoading(false);

      setError({
        title: 'Unable to Read Ledger',
        message:
          'Please upload a valid RD Personal Ledger Excel file.',
      });

      setAccountData(null);
    };

    reader.readAsArrayBuffer(file);
  };

  // ---------------------------------------------------------------------------
  // Reset / Upload Another Ledger
  // ---------------------------------------------------------------------------

  const handleReset = () => {
    setAccountData(null);
    setError(null);
    setSelectedRDType(null);
    setSelectedInterestRate(12);
    setIsLoading(false);
  };

  // ---------------------------------------------------------------------------
  // Back to RD Type Selection
  // ---------------------------------------------------------------------------

  const handleBackToRDSelection = () => {
    setSelectedRDType(null);
    setError(null);
    setAccountData(null);
    setSelectedInterestRate(12);
    setIsLoading(false);
  };

  // ---------------------------------------------------------------------------
  // Opening / RD Selection Screen
  // ---------------------------------------------------------------------------

  const renderRDSelectionScreen = () => {
    return (
      <div className="min-h-[calc(100vh-140px)] bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-8 sm:py-12">

        <div className="w-full max-w-6xl mx-auto">

          {/* ============================================================= */}
          {/* HERO SECTION                                                  */}
          {/* ============================================================= */}

          <div className="text-center max-w-3xl mx-auto">

            {/* Small badge */}

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-blue-100 shadow-sm mb-5">

              <Sparkles className="w-4 h-4 text-blue-600" />

              <span className="text-xs sm:text-sm font-semibold text-blue-700">
                Simple • Secure • Accurate
              </span>

            </div>

            {/* Main icon */}

            <div className="mx-auto mb-5 flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-xl shadow-blue-200">

              <Calculator className="w-8 h-8 sm:w-10 sm:h-10 text-white" />

            </div>

            {/* Heading */}

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-gray-900">
              RD Maturity Calculator
            </h1>

            {/* Subtitle */}

            <p className="mt-4 text-base sm:text-lg leading-relaxed text-gray-500 max-w-2xl mx-auto">
              Calculate your Recurring Deposit maturity amount
              quickly and accurately using your personal ledger.
            </p>

            <p className="mt-3 text-sm font-medium text-gray-400">
              Choose your RD type to get started
            </p>

          </div>

          {/* ============================================================= */}
          {/* FEATURE STRIP                                                 */}
          {/* ============================================================= */}

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-4xl mx-auto">

            <div className="flex items-center justify-center gap-2 rounded-xl bg-white/80 border border-gray-100 px-4 py-3 shadow-sm">

              <FileSpreadsheet className="w-4 h-4 text-blue-600" />

              <span className="text-xs sm:text-sm text-gray-600">
                Excel Ledger Support
              </span>

            </div>

            <div className="flex items-center justify-center gap-2 rounded-xl bg-white/80 border border-gray-100 px-4 py-3 shadow-sm">

              <BarChart3 className="w-4 h-4 text-emerald-600" />

              <span className="text-xs sm:text-sm text-gray-600">
                Detailed Calculation
              </span>

            </div>

            <div className="flex items-center justify-center gap-2 rounded-xl bg-white/80 border border-gray-100 px-4 py-3 shadow-sm">

              <ShieldCheck className="w-4 h-4 text-violet-600" />

              <span className="text-xs sm:text-sm text-gray-600">
                Personal Ledger Processing
              </span>

            </div>

          </div>

          {/* ============================================================= */}
          {/* RD TYPE SELECTION                                             */}
          {/* ============================================================= */}

          <div className="mt-10">

            <div className="text-center mb-6">

              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                Select RD Type
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Select the type that matches your uploaded ledger.
              </p>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">

              {/* ========================================================= */}
              {/* DAILY RD CARD                                             */}
              {/* ========================================================= */}

              <button
                type="button"
                onClick={() => handleRDSelection('Daily RD')}
                className={`
                  group relative text-left p-6 sm:p-8 rounded-2xl
                  border-2 bg-white
                  transition-all duration-200
                  focus:outline-none
                  focus:ring-4 focus:ring-blue-100
                  ${
                    selectedRDType === 'Daily RD'
                      ? 'border-blue-600 shadow-xl shadow-blue-100 ring-4 ring-blue-50'
                      : 'border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-xl hover:-translate-y-1'
                  }
                `}
              >

                {/* Selected badge */}

                {selectedRDType === 'Daily RD' && (
                  <div className="absolute top-5 right-5">
                    <CheckCircle2 className="w-6 h-6 text-blue-600" />
                  </div>
                )}

                <div className="flex items-start gap-5">

                  <div
                    className={`
                      shrink-0 w-14 h-14 rounded-2xl
                      flex items-center justify-center
                      transition-all duration-200
                      ${
                        selectedRDType === 'Daily RD'
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                          : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'
                      }
                    `}
                  >
                    <CalendarDays className="w-7 h-7" />
                  </div>

                  <div className="pr-8">

                    <div className="flex items-center gap-2">

                      <h3 className="text-xl font-bold text-gray-900">
                        Daily RD
                      </h3>

                      {selectedRDType === 'Daily RD' && (
                        <span className="text-[10px] uppercase tracking-wider font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                          Selected
                        </span>
                      )}

                    </div>

                    <p className="mt-2 text-sm leading-relaxed text-gray-500">
                      For recurring deposits where contributions
                      are recorded on a daily basis.
                    </p>

                  </div>

                </div>

                <div className="mt-7 pt-5 border-t border-gray-100">

                  <div className="flex items-center justify-between">

                    <div>

                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Deposit Frequency
                      </p>

                      <p className="mt-1 text-sm font-semibold text-gray-700">
                        Daily
                      </p>

                    </div>

                    <div
                      className={`
                        flex items-center gap-1 text-sm font-semibold
                        ${
                          selectedRDType === 'Daily RD'
                            ? 'text-blue-600'
                            : 'text-gray-400 group-hover:text-blue-600'
                        }
                      `}
                    >
                      Continue

                      <ArrowRight
                        className={`
                          w-4 h-4 transition-transform
                          ${
                            selectedRDType === 'Daily RD'
                              ? 'translate-x-1'
                              : 'group-hover:translate-x-1'
                          }
                        `}
                      />

                    </div>

                  </div>

                </div>

              </button>

              {/* ========================================================= */}
              {/* MONTHLY RD CARD                                           */}
              {/* ========================================================= */}

              <button
                type="button"
                onClick={() => handleRDSelection('Monthly RD')}
                className={`
                  group relative text-left p-6 sm:p-8 rounded-2xl
                  border-2 bg-white
                  transition-all duration-200
                  focus:outline-none
                  focus:ring-4 focus:ring-emerald-100
                  ${
                    selectedRDType === 'Monthly RD'
                      ? 'border-emerald-600 shadow-xl shadow-emerald-100 ring-4 ring-emerald-50'
                      : 'border-gray-200 shadow-sm hover:border-emerald-300 hover:shadow-xl hover:-translate-y-1'
                  }
                `}
              >

                {/* Selected badge */}

                {selectedRDType === 'Monthly RD' && (
                  <div className="absolute top-5 right-5">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  </div>
                )}

                <div className="flex items-start gap-5">

                  <div
                    className={`
                      shrink-0 w-14 h-14 rounded-2xl
                      flex items-center justify-center
                      transition-all duration-200
                      ${
                        selectedRDType === 'Monthly RD'
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                          : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100'
                      }
                    `}
                  >
                    <CalendarDays className="w-7 h-7" />
                  </div>

                  <div className="pr-8">

                    <div className="flex items-center gap-2">

                      <h3 className="text-xl font-bold text-gray-900">
                        Monthly RD
                      </h3>

                      {selectedRDType === 'Monthly RD' && (
                        <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                          Selected
                        </span>
                      )}

                    </div>

                    <p className="mt-2 text-sm leading-relaxed text-gray-500">
                      For recurring deposits where a fixed
                      installment is made every month.
                    </p>

                  </div>

                </div>

                <div className="mt-7 pt-5 border-t border-gray-100">

                  <div className="flex items-center justify-between">

                    <div>

                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Deposit Frequency
                      </p>

                      <p className="mt-1 text-sm font-semibold text-gray-700">
                        Monthly
                      </p>

                    </div>

                    <div
                      className={`
                        flex items-center gap-1 text-sm font-semibold
                        ${
                          selectedRDType === 'Monthly RD'
                            ? 'text-emerald-600'
                            : 'text-gray-400 group-hover:text-emerald-600'
                        }
                      `}
                    >
                      Continue

                      <ArrowRight
                        className={`
                          w-4 h-4 transition-transform
                          ${
                            selectedRDType === 'Monthly RD'
                              ? 'translate-x-1'
                              : 'group-hover:translate-x-1'
                          }
                        `}
                      />

                    </div>

                  </div>

                </div>

              </button>

            </div>

          </div>

          {/* ============================================================= */}
          {/* HOW IT WORKS                                                  */}
          {/* ============================================================= */}

          {!selectedRDType && (
            <div className="mt-10 max-w-4xl mx-auto">

              <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6 sm:p-7">

                <div className="text-center mb-6">

                  <h3 className="text-lg font-bold text-gray-900">
                    How it works
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    Calculate your RD maturity amount in three simple steps.
                  </p>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

                  {/* Step 1 */}

                  <div className="text-center">

                    <div className="mx-auto w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                      1
                    </div>

                    <h4 className="mt-3 text-sm font-semibold text-gray-800">
                      Select RD Type
                    </h4>

                    <p className="mt-1 text-xs leading-relaxed text-gray-500">
                      Choose Daily RD or Monthly RD.
                    </p>

                  </div>

                  {/* Step 2 */}

                  <div className="text-center">

                    <div className="mx-auto w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                      2
                    </div>

                    <h4 className="mt-3 text-sm font-semibold text-gray-800">
                      Upload Ledger
                    </h4>

                    <p className="mt-1 text-xs leading-relaxed text-gray-500">
                      Upload your .xlsx or .xls personal ledger.
                    </p>

                  </div>

                  {/* Step 3 */}

                  <div className="text-center">

                    <div className="mx-auto w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                      3
                    </div>

                    <h4 className="mt-3 text-sm font-semibold text-gray-800">
                      View Result
                    </h4>

                    <p className="mt-1 text-xs leading-relaxed text-gray-500">
                      Review your deposits, interest and maturity amount.
                    </p>

                  </div>

                </div>

              </div>

            </div>
          )}

          {/* ============================================================= */}
          {/* SELECTED RD + UPLOAD                                          */}
          {/* ============================================================= */}

          {selectedRDType && (
            <div className="mt-10 max-w-4xl mx-auto">

              {/* Selected RD indicator */}

              <div className="text-center mb-5">

                <div
                  className={`
                    inline-flex items-center gap-2 px-4 py-2
                    rounded-full text-sm font-medium
                    ${
                      selectedRDType === 'Daily RD'
                        ? 'bg-blue-50 text-blue-700 border border-blue-100'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    }
                  `}
                >

                  <CheckCircle2 className="w-4 h-4" />

                  <span>
                    {selectedRDType} selected
                  </span>

                </div>

              </div>

              {/* Upload panel */}

              <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5 sm:p-7">

                <div className="text-center mb-5">

                  <div
                    className={`
                      mx-auto w-12 h-12 rounded-xl
                      flex items-center justify-center mb-3
                      ${
                        selectedRDType === 'Daily RD'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-emerald-50 text-emerald-600'
                      }
                    `}
                  >
                    <Upload className="w-6 h-6" />
                  </div>

                  <h3 className="text-lg font-bold text-gray-900">
                    Upload {selectedRDType} Ledger
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    Upload your personal RD ledger to calculate maturity.
                  </p>

                </div>

                {/* Upload Component */}

                <UploadSection
                  onFileLoaded={handleFile}
                  isLoading={isLoading}
                />

              </div>

              {/* BACK BUTTON */}

              <div className="mt-6 flex justify-center">

                <button
                  type="button"
                  onClick={handleBackToRDSelection}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50 shadow-sm transition-all duration-200 active:scale-[0.98] cursor-pointer"
                >

                  <span className="text-base">
                    ←
                  </span>

                  <span>
                    Back
                  </span>

                </button>

              </div>

            </div>
          )}

          {/* ============================================================= */}
          {/* BOTTOM INFORMATION                                            */}
          {/* ============================================================= */}

          <div className="mt-10 text-center">

            <div className="inline-flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-gray-400">

              <span className="inline-flex items-center gap-1.5">

                <FileSpreadsheet className="w-3.5 h-3.5" />

                .xlsx / .xls supported

              </span>

              <span className="hidden sm:inline text-gray-300">
                •
              </span>

              <span className="inline-flex items-center gap-1.5">

                <ShieldCheck className="w-3.5 h-3.5" />

                Local ledger processing

              </span>

            </div>

          </div>

        </div>

      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">

      <Header />

      <main className="flex-1 pb-16">

        {/* =============================================================== */}
        {/* ERROR NOTIFICATION                                             */}
        {/* =============================================================== */}

        {error && (
          <ErrorAlert
            title={error.title}
            message={error.message}
            onClear={() => setError(null)}
            onRetry={handleReset}
          />
        )}

        {/* =============================================================== */}
        {/* OPENING / RD SELECTION SCREEN                                  */}
        {/* =============================================================== */}

        {!accountData && (
          renderRDSelectionScreen()
        )}

        {/* =============================================================== */}
        {/* VALID LEDGER SCREEN                                            */}
        {/* =============================================================== */}

        {accountData && (
          <div>

            {/* ========================================================= */}
            {/* 1. INTEREST RATE SELECTION                                */}
            {/* ========================================================= */}

            <InterestRateSelection
              selectedRate={selectedInterestRate}
              onRateChange={handleInterestRateChange}
            />

            {/* ========================================================= */}
            {/* 2. CUSTOMER DETAILS                                       */}
            {/* ========================================================= */}

            <CustomerDetails
              data={accountData}
            />

            {/* ========================================================= */}
            {/* 3. LEDGER PREVIEW                                          */}
            {/* ========================================================= */}

            <LedgerPreview
              transactions={accountData.transactions}
            />

            {/* ========================================================= */}
            {/* 4. MATURITY RESULT                                         */}
            {/* ========================================================= */}

            <MaturityResult
              data={accountData}
              onReset={handleReset}
            />

          </div>
        )}

      </main>

      {/* ================================================================ */}
      {/* FOOTER                                                           */}
      {/* ================================================================ */}

      <footer className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-500 shrink-0">

        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">

          <span>
            <strong>
              RD MATURITY CALCULATOR
            </strong>

            {' — '}

            Daily RD & Monthly RD Personal Ledger Processing
          </span>

          <span className="text-gray-400">
            Supported formats: .xlsx, .xls
          </span>

        </div>

      </footer>

    </div>
  );
}