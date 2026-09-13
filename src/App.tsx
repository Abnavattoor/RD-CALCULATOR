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

import { parseRDLedgerPDF } from './utils/pdfParser';

import { recalculateRDWithRate } from './utils/rdCalculator';

import { Header } from './components/Header';
import { UploadSection } from './components/UploadSection';
import { CustomerDetails } from './components/CustomerDetails';
import { LedgerPreview } from './components/LedgerPreview';
import { MaturityResult } from './components/MaturityResult';
import { ErrorAlert } from './components/ErrorAlert';
import { InterestRateSelection } from './components/InterestRateSelection';
import { PreClosureCalculator } from './components/PreClosureCalculator';

import {
  Calculator,
  CalendarDays,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  Upload,
  BarChart3,
  Sparkles,
} from 'lucide-react';

type RDSelection = 'Daily RD' | 'Monthly RD';

type CalculationMode = 'Maturity' | 'Pre-Closure';

export default function App() {
  const [accountData, setAccountData] =
    useState<RDAccountData | null>(null);

  const [isLoading, setIsLoading] =
    useState<boolean>(false);

  const [error, setError] =
    useState<RDParseError | null>(null);

  const [selectedRDType, setSelectedRDType] =
    useState<RDSelection | null>(null);

  const [selectedInterestRate, setSelectedInterestRate] =
    useState<number>(12);

  const [calculationMode, setCalculationMode] =
    useState<CalculationMode | null>(null);

  // ===========================================================================
  // CALCULATOR SELECTION
  // ===========================================================================

  const handleCalculationModeSelection = (
    mode: CalculationMode
  ) => {
    setCalculationMode(mode);
    setSelectedRDType(null);
    setAccountData(null);
    setError(null);
    setSelectedInterestRate(12);
  };

  // ===========================================================================
  // RD TYPE SELECTION
  // ===========================================================================

  const handleRDSelection = (
    type: RDSelection
  ) => {
    setSelectedRDType(type);
    setError(null);
  };

  // ===========================================================================
  // INTEREST RATE SELECTION
  // ===========================================================================

  const handleInterestRateChange = (rate: number) => {
    setSelectedInterestRate(rate);

    setAccountData((currentData) => {
      if (!currentData) {
        return null;
      }

      return recalculateRDWithRate(
        currentData,
        rate
      );
    });
  };

  // ===========================================================================
  // HANDLE FILE UPLOAD
  //
  // Supported:
  // .xlsx
  // .xls
  // .pdf
  // ===========================================================================

  const handleFile = (file: File) => {
    setIsLoading(true);
    setError(null);

    const lowerName = file.name.toLowerCase();

    const isExcel =
      lowerName.endsWith('.xlsx') ||
      lowerName.endsWith('.xls');

    const isPDF =
      lowerName.endsWith('.pdf');

    // -------------------------------------------------------------------------
    // Validate file
    // -------------------------------------------------------------------------

    if ((!isExcel && !isPDF) || file.size === 0) {
      setIsLoading(false);

      setError({
        title: 'Invalid Ledger Format',
        message:
          'Please upload a valid RD Personal Ledger file in Excel (.xlsx/.xls) or PDF (.pdf) format.',
      });

      setAccountData(null);
      return;
    }

    // -------------------------------------------------------------------------
    // Make sure RD type is selected
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

    // -------------------------------------------------------------------------
    // File Reader
    //
    // Excel requires ArrayBuffer.
    // PDF parser accepts the original File object.
    // -------------------------------------------------------------------------

    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const result = event.target?.result;

        // =====================================================================
        // EXCEL
        // =====================================================================

        if (isExcel) {
          if (!(result instanceof ArrayBuffer)) {
            throw new Error(
              'The Excel ledger could not be read.'
            );
          }

          if (result.byteLength === 0) {
            throw new Error(
              'The Excel ledger is empty or could not be read.'
            );
          }

          const parsed =
            parseRDLedgerWorkbook(
              result,
              file.name,
              file.size
            );

          // -------------------------------------------------------------------
          // Verify RD Type
          // -------------------------------------------------------------------

          if (
            parsed.rdType === 'Daily RD' ||
            parsed.rdType === 'Monthly RD'
          ) {
            if (parsed.rdType !== selectedRDType) {
              throw new Error(
                `You selected ${selectedRDType}, but the uploaded ledger appears to be ${parsed.rdType}. Please select the correct RD type and upload the matching ledger.`
              );
            }
          }

          // -------------------------------------------------------------------
          // Existing maturity calculation
          // -------------------------------------------------------------------

          const calculatedData =
            recalculateRDWithRate(
              parsed,
              12
            );

          setSelectedInterestRate(12);
          setAccountData(calculatedData);
          setError(null);

          return;
        }

        // =====================================================================
        // PDF
        //
        // IMPORTANT:
        // parseRDLedgerPDF() expects File.
        //
        // Therefore we pass `file`, NOT `result`.
        // =====================================================================

        if (isPDF) {
          const parsed =
            await parseRDLedgerPDF(file);

          // -------------------------------------------------------------------
          // Add file information if the PDF parser does not already provide it.
          // -------------------------------------------------------------------

          const parsedWithFileInfo: RDAccountData = {
            ...parsed,
            fileName:
              parsed.fileName || file.name,
            fileSize:
              parsed.fileSize || file.size,
          };

          // -------------------------------------------------------------------
          // Verify RD Type
          // -------------------------------------------------------------------

          if (
            parsedWithFileInfo.rdType === 'Daily RD' ||
            parsedWithFileInfo.rdType === 'Monthly RD'
          ) {
            if (
              parsedWithFileInfo.rdType !==
              selectedRDType
            ) {
              throw new Error(
                `You selected ${selectedRDType}, but the uploaded ledger appears to be ${parsedWithFileInfo.rdType}. Please select the correct RD type and upload the matching ledger.`
              );
            }
          }

          // -------------------------------------------------------------------
          // Existing maturity calculation
          // -------------------------------------------------------------------

          const calculatedData =
            recalculateRDWithRate(
              parsedWithFileInfo,
              12
            );

          setSelectedInterestRate(12);
          setAccountData(calculatedData);
          setError(null);

          return;
        }

      } catch (err: unknown) {
        setAccountData(null);

        // ---------------------------------------------------------------------
        // Existing Excel validation error
        // ---------------------------------------------------------------------

        if (err instanceof RDValidationError) {
          setError({
            title: 'Ledger Validation Error',
            message: err.message,
          });

          return;
        }

        // ---------------------------------------------------------------------
        // Normal JavaScript error
        // ---------------------------------------------------------------------

        if (err instanceof Error) {
          setError({
            title: isPDF
              ? 'Unable to Read PDF Ledger'
              : 'Unable to Read Ledger',

            message:
              err.message ||
              (
                isPDF
                  ? 'The PDF could not be read. Please make sure it is a valid text-based RD Personal Ledger PDF.'
                  : 'Please upload a valid RD Personal Ledger Excel file.'
              ),
          });

          return;
        }

        // ---------------------------------------------------------------------
        // Unknown error
        // ---------------------------------------------------------------------

        setError({
          title: isPDF
            ? 'Unable to Read PDF Ledger'
            : 'Unable to Read Ledger',

          message:
            isPDF
              ? 'The PDF could not be read. Please make sure it is a valid text-based RD Personal Ledger PDF. Scanned/image-only PDFs require OCR support.'
              : 'Please upload a valid RD Personal Ledger Excel file.',
        });
      } finally {
        setIsLoading(false);
      }
    };

    // -------------------------------------------------------------------------
    // File Reader Error
    // -------------------------------------------------------------------------

    reader.onerror = () => {
      setIsLoading(false);

      setError({
        title: 'Unable to Read Ledger',
        message:
          'The selected file could not be read. Please try uploading the ledger again.',
      });

      setAccountData(null);
    };

    // -------------------------------------------------------------------------
    // We only need FileReader for Excel.
    //
    // For PDF, we can still trigger the reader because the PDF parser receives
    // the original File object. This keeps the upload flow consistent.
    // -------------------------------------------------------------------------

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      // Trigger the same asynchronous flow for PDF.
      // The parser itself receives the File object.
      reader.onload({
        target: {
          result: file,
        },
      } as unknown as ProgressEvent<FileReader>);
    }
  };

  // ===========================================================================
  // RESET
  // ===========================================================================

  const handleReset = () => {
    setAccountData(null);
    setError(null);
    setSelectedRDType(null);
    setSelectedInterestRate(12);
    setCalculationMode(null);
    setIsLoading(false);
  };

  // ===========================================================================
  // SELECTION / UPLOAD SCREEN
  // ===========================================================================

  const renderRDSelectionScreen = () => {
    return (
      <div className="min-h-[calc(100vh-140px)] bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-8 sm:py-12">

        <div className="w-full max-w-6xl mx-auto">

          {/* HERO */}

          <div className="text-center max-w-3xl mx-auto">

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-blue-100 shadow-sm mb-5">

              <Sparkles className="w-4 h-4 text-blue-600" />

              <span className="text-xs sm:text-sm font-semibold text-blue-700">
                Simple • Secure • Accurate
              </span>

            </div>

            <div className="mx-auto mb-5 flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-xl shadow-blue-200">

              <Calculator className="w-8 h-8 sm:w-10 sm:h-10 text-white" />

            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-gray-900">
              RD Calculator
            </h1>

            <p className="mt-4 text-base sm:text-lg leading-relaxed text-gray-500 max-w-2xl mx-auto">
              Calculate your Recurring Deposit maturity or pre-closure amount using your personal ledger.
            </p>

            <p className="mt-3 text-sm font-medium text-gray-400">
              Choose the calculation you want to perform
            </p>

          </div>

          {/* FEATURES */}

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-4xl mx-auto">

            <div className="flex items-center justify-center gap-2 rounded-xl bg-white/80 border border-gray-100 px-4 py-3 shadow-sm">

              <FileSpreadsheet className="w-4 h-4 text-blue-600" />

              <span className="text-xs sm:text-sm text-gray-600">
                Excel & PDF Ledger Support
              </span>

            </div>

            <div className="flex items-center justify-center gap-2 rounded-xl bg-white/80 border border-gray-100 px-4 py-3 shadow-sm">

              <BarChart3 className="w-4 h-4 text-emerald-600" />

              <span className="text-xs sm:text-sm text-gray-600">
                Accurate Calculation
              </span>

            </div>

            <div className="flex items-center justify-center gap-2 rounded-xl bg-white/80 border border-gray-100 px-4 py-3 shadow-sm">

              <ShieldCheck className="w-4 h-4 text-violet-600" />

              <span className="text-xs sm:text-sm text-gray-600">
                Personal Ledger Processing
              </span>

            </div>

          </div>

          {/* CALCULATOR SELECTION */}

          {!calculationMode && (
            <div className="mt-10">

              <div className="text-center mb-6">

                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  Choose Calculator
                </h2>

                <p className="mt-2 text-sm text-gray-500">
                  Select the calculation you want to perform.
                </p>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">

                {/* MATURITY CALCULATOR */}

                <button
                  type="button"
                  onClick={() =>
                    handleCalculationModeSelection(
                      'Maturity'
                    )
                  }
                  className="group relative text-left p-6 sm:p-8 rounded-2xl border-2 border-gray-200 bg-white shadow-sm transition-all duration-200 hover:border-blue-400 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-blue-100"
                >

                  <div className="flex items-start gap-5">

                    <div className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-200">

                      <Calculator className="w-7 h-7" />

                    </div>

                    <div className="pr-4">

                      <h3 className="text-xl font-bold text-gray-900">
                        Maturity Calculator
                      </h3>

                      <p className="mt-2 text-sm leading-relaxed text-gray-500">
                        Calculate the maturity amount of your Recurring Deposit using the uploaded personal ledger.
                      </p>

                    </div>

                  </div>

                  <div className="mt-7 pt-5 border-t border-gray-100">

                    <div className="flex items-center justify-between">

                      <div>

                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                          Calculation
                        </p>

                        <p className="mt-1 text-sm font-semibold text-gray-700">
                          Maturity Amount
                        </p>

                      </div>

                      <div className="flex items-center gap-1 text-sm font-semibold text-blue-600">

                        Continue

                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />

                      </div>

                    </div>

                  </div>

                </button>

                {/* PRE-CLOSURE CALCULATOR */}

                <button
                  type="button"
                  onClick={() =>
                    handleCalculationModeSelection(
                      'Pre-Closure'
                    )
                  }
                  className="group relative text-left p-6 sm:p-8 rounded-2xl border-2 border-gray-200 bg-white shadow-sm transition-all duration-200 hover:border-amber-400 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-amber-100"
                >

                  <div className="flex items-start gap-5">

                    <div className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-all duration-200">

                      <CalendarDays className="w-7 h-7" />

                    </div>

                    <div className="pr-4">

                      <h3 className="text-xl font-bold text-gray-900">
                        Pre-Closure Calculator
                      </h3>

                      <p className="mt-2 text-sm leading-relaxed text-gray-500">
                        Calculate the amount payable when an RD is closed before its original maturity date.
                      </p>

                    </div>

                  </div>

                  <div className="mt-7 pt-5 border-t border-gray-100">

                    <div className="flex items-center justify-between">

                      <div>

                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                          Calculation
                        </p>

                        <p className="mt-1 text-sm font-semibold text-gray-700">
                          Pre-Closure Amount
                        </p>

                      </div>

                      <div className="flex items-center gap-1 text-sm font-semibold text-amber-600">

                        Continue

                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />

                      </div>

                    </div>

                  </div>

                </button>

              </div>

            </div>
          )}

          {/* RD TYPE SELECTION */}

          {calculationMode && !selectedRDType && (
            <div className="mt-10">

              <div className="text-center mb-6">

                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-xs font-semibold text-blue-700 mb-3">

                  {calculationMode === 'Maturity'
                    ? 'Maturity Calculator'
                    : 'Pre-Closure Calculator'}

                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  Select RD Type
                </h2>

                <p className="mt-2 text-sm text-gray-500">
                  Select the type that matches your uploaded ledger.
                </p>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">

                {/* DAILY RD */}

                <button
                  type="button"
                  onClick={() =>
                    handleRDSelection('Daily RD')
                  }
                  className="group relative text-left p-6 sm:p-8 rounded-2xl border-2 border-gray-200 bg-white shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-blue-100"
                >

                  <div className="flex items-start gap-5">

                    <div className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-all duration-200">

                      <CalendarDays className="w-7 h-7" />

                    </div>

                    <div className="pr-8">

                      <h3 className="text-xl font-bold text-gray-900">
                        Daily RD
                      </h3>

                      <p className="mt-2 text-sm leading-relaxed text-gray-500">
                        For recurring deposits where contributions are recorded on a daily basis.
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

                      <div className="flex items-center gap-1 text-sm font-semibold text-blue-600">

                        Continue

                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1" />

                      </div>

                    </div>

                  </div>

                </button>

                {/* MONTHLY RD */}

                <button
                  type="button"
                  onClick={() =>
                    handleRDSelection('Monthly RD')
                  }
                  className="group relative text-left p-6 sm:p-8 rounded-2xl border-2 border-gray-200 bg-white shadow-sm transition-all duration-200 hover:border-emerald-300 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                >

                  <div className="flex items-start gap-5">

                    <div className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-all duration-200">

                      <CalendarDays className="w-7 h-7" />

                    </div>

                    <div className="pr-8">

                      <h3 className="text-xl font-bold text-gray-900">
                        Monthly RD
                      </h3>

                      <p className="mt-2 text-sm leading-relaxed text-gray-500">
                        For recurring deposits where a fixed installment is made every month.
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

                      <div className="flex items-center gap-1 text-sm font-semibold text-emerald-600">

                        Continue

                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1" />

                      </div>

                    </div>

                  </div>

                </button>

              </div>

              <div className="mt-6 flex justify-center">

                <button
                  type="button"
                  onClick={() => {
                    setCalculationMode(null);
                    setSelectedRDType(null);
                    setAccountData(null);
                    setError(null);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50 shadow-sm transition-all"
                >
                  ← Back to Calculators
                </button>

              </div>

            </div>
          )}

          {/* UPLOAD */}

          {calculationMode && selectedRDType && (
            <div className="mt-10 max-w-4xl mx-auto">

              <div className="text-center mb-3">

                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-xs font-semibold text-blue-700">

                  {calculationMode === 'Maturity'
                    ? 'Maturity Calculator'
                    : 'Pre-Closure Calculator'}

                </div>

              </div>

              <div className="text-center mb-5">

                <div
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                    selectedRDType === 'Daily RD'
                      ? 'bg-blue-50 text-blue-700 border border-blue-100'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  }`}
                >

                  <CheckCircle2 className="w-4 h-4" />

                  <span>
                    {selectedRDType} selected
                  </span>

                </div>

              </div>

              <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5 sm:p-7">

                <div className="text-center mb-5">

                  <div
                    className={`mx-auto w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                      selectedRDType === 'Daily RD'
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >

                    <Upload className="w-6 h-6" />

                  </div>

                  <h3 className="text-lg font-bold text-gray-900">
                    Upload {selectedRDType} Ledger
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    {calculationMode === 'Maturity'
                      ? 'Upload your personal RD ledger to calculate maturity.'
                      : 'Upload your personal RD ledger to calculate the pre-closure amount.'}
                  </p>

                </div>

                <UploadSection
                  onFileLoaded={handleFile}
                  isLoading={isLoading}
                />

              </div>

              <div className="mt-6 flex justify-center gap-3">

                <button
                  type="button"
                  onClick={() => {
                    setSelectedRDType(null);
                    setAccountData(null);
                    setError(null);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50 shadow-sm transition-all duration-200 active:scale-[0.98] cursor-pointer"
                >
                  ← Back to RD Type
                </button>

              </div>

            </div>
          )}

          {/* BOTTOM INFORMATION */}

          {!calculationMode && (
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

                  <FileText className="w-3.5 h-3.5" />

                  .pdf supported

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
          )}

        </div>

      </div>
    );
  };

  // ===========================================================================
  // MAIN RENDER
  // ===========================================================================

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">

      <Header />

      <main className="flex-1 pb-16">

        {/* ERROR */}

        {error && (
          <ErrorAlert
            title={error.title}
            message={error.message}
            onClear={() => setError(null)}
            onRetry={handleReset}
          />
        )}

        {/* INITIAL SCREEN */}

        {!accountData && (
          renderRDSelectionScreen()
        )}

        {/* RESULT */}

        {accountData && (
          <div>

            {calculationMode === 'Maturity' ? (

              <div>

                <InterestRateSelection
                  selectedRate={selectedInterestRate}
                  onRateChange={handleInterestRateChange}
                />

                <CustomerDetails
                  data={accountData}
                />

                <LedgerPreview
                  transactions={accountData.transactions}
                />

                <MaturityResult
                  data={accountData}
                  onReset={handleReset}
                />

              </div>

            ) : (

              <PreClosureCalculator
                data={accountData}
                onReset={handleReset}
              />

            )}

          </div>
        )}

      </main>

      {/* FOOTER */}

      <footer className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-500 shrink-0">

        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">

          <span>

            <strong>
              RD CALCULATOR
            </strong>

            {' — '}

            Daily RD & Monthly RD Personal Ledger Processing

          </span>

          <span className="text-gray-400">
            Supported formats: .xlsx, .xls, .pdf
          </span>

        </div>

      </footer>

    </div>
  );
}