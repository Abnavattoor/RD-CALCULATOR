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

import { Header } from './components/Header';
import { UploadSection } from './components/UploadSection';
import { CustomerDetails } from './components/CustomerDetails';
import { LedgerPreview } from './components/LedgerPreview';
import { MaturityResult } from './components/MaturityResult';
import { ErrorAlert } from './components/ErrorAlert';

import {
  Calculator,
  CalendarDays,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';

type RDSelection = 'Daily RD' | 'Monthly RD';

export default function App() {
  const [accountData, setAccountData] =
    useState<RDAccountData | null>(null);

  const [isLoading, setIsLoading] =
    useState<boolean>(false);

  const [error, setError] =
    useState<RDParseError | null>(null);

  // Selected RD type
  const [selectedRDType, setSelectedRDType] =
    useState<RDSelection | null>(null);

  // ---------------------------------------------------------------------------
  // Handle selecting Daily RD / Monthly RD
  // ---------------------------------------------------------------------------

  const handleRDSelection = (type: RDSelection) => {
    setSelectedRDType(type);
    setError(null);
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

    // Make sure an RD type has been selected
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

        setAccountData(parsed);
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
    setIsLoading(false);
  };

  // ---------------------------------------------------------------------------
  // Back to RD Type Selection
  // ---------------------------------------------------------------------------

  const handleBackToRDSelection = () => {
    setSelectedRDType(null);
    setError(null);
    setAccountData(null);
    setIsLoading(false);
  };

  // ---------------------------------------------------------------------------
  // Opening / RD Selection Screen
  // ---------------------------------------------------------------------------

  const renderRDSelectionScreen = () => {
    return (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-5xl">

          {/* Hero Section */}
          <div className="text-center mb-10">

            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg mb-5">
              <Calculator className="w-8 h-8 text-white" />
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              RD Maturity Calculator
            </h1>

            <p className="mt-3 text-base sm:text-lg text-gray-500 max-w-2xl mx-auto">
              Calculate your Recurring Deposit maturity amount
              from your approved personal ledger.
            </p>

            <p className="mt-2 text-sm text-gray-400">
              Select your RD type to get started
            </p>
          </div>

          {/* RD Type Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">

            {/* ========================================================= */}
            {/* DAILY RD CARD */}
            {/* ========================================================= */}

            <button
              type="button"
              onClick={() => handleRDSelection('Daily RD')}
              className={`
                group relative text-left p-7 sm:p-8 rounded-2xl
                border-2 transition-all duration-200
                bg-white shadow-sm
                hover:shadow-xl hover:-translate-y-1
                ${
                  selectedRDType === 'Daily RD'
                    ? 'border-blue-600 ring-4 ring-blue-100'
                    : 'border-gray-200 hover:border-blue-400'
                }
              `}
            >

              {/* Selected Icon */}
              {selectedRDType === 'Daily RD' && (
                <div className="absolute top-5 right-5">
                  <CheckCircle2 className="w-6 h-6 text-blue-600" />
                </div>
              )}

              <div className="flex items-start gap-5">

                <div
                  className={`
                    shrink-0 w-14 h-14 rounded-xl
                    flex items-center justify-center
                    transition-colors
                    ${
                      selectedRDType === 'Daily RD'
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'
                    }
                  `}
                >
                  <CalendarDays className="w-7 h-7" />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Daily RD
                  </h2>

                  <p className="mt-2 text-sm leading-relaxed text-gray-500">
                    For recurring deposits where contributions
                    are recorded on a daily basis.
                  </p>
                </div>
              </div>

              <div className="mt-7 pt-5 border-t border-gray-100">
                <div className="flex items-center justify-between">

                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Daily Deposit Ledger
                  </span>

                  <ArrowRight
                    className={`
                      w-5 h-5 transition-transform
                      ${
                        selectedRDType === 'Daily RD'
                          ? 'text-blue-600 translate-x-1'
                          : 'text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1'
                      }
                    `}
                  />
                </div>
              </div>
            </button>

            {/* ========================================================= */}
            {/* MONTHLY RD CARD */}
            {/* ========================================================= */}

            <button
              type="button"
              onClick={() => handleRDSelection('Monthly RD')}
              className={`
                group relative text-left p-7 sm:p-8 rounded-2xl
                border-2 transition-all duration-200
                bg-white shadow-sm
                hover:shadow-xl hover:-translate-y-1
                ${
                  selectedRDType === 'Monthly RD'
                    ? 'border-emerald-600 ring-4 ring-emerald-100'
                    : 'border-gray-200 hover:border-emerald-400'
                }
              `}
            >

              {/* Selected Icon */}
              {selectedRDType === 'Monthly RD' && (
                <div className="absolute top-5 right-5">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
              )}

              <div className="flex items-start gap-5">

                <div
                  className={`
                    shrink-0 w-14 h-14 rounded-xl
                    flex items-center justify-center
                    transition-colors
                    ${
                      selectedRDType === 'Monthly RD'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100'
                    }
                  `}
                >
                  <CalendarDays className="w-7 h-7" />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Monthly RD
                  </h2>

                  <p className="mt-2 text-sm leading-relaxed text-gray-500">
                    For recurring deposits where a fixed
                    installment is made every month.
                  </p>
                </div>
              </div>

              <div className="mt-7 pt-5 border-t border-gray-100">
                <div className="flex items-center justify-between">

                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Monthly Installment Ledger
                  </span>

                  <ArrowRight
                    className={`
                      w-5 h-5 transition-transform
                      ${
                        selectedRDType === 'Monthly RD'
                          ? 'text-emerald-600 translate-x-1'
                          : 'text-gray-300 group-hover:text-emerald-500 group-hover:translate-x-1'
                      }
                    `}
                  />
                </div>
              </div>
            </button>

          </div>

          {/* ========================================================= */}
          {/* SELECTED RD + UPLOAD */}
          {/* ========================================================= */}

          {selectedRDType && (
            <div className="mt-8 max-w-4xl mx-auto">

              {/* Selected RD Indicator */}
              <div className="text-center mb-5">

                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-sm text-gray-600">
                  <CheckCircle2
                    className={`
                      w-4 h-4
                      ${
                        selectedRDType === 'Daily RD'
                          ? 'text-blue-600'
                          : 'text-emerald-600'
                      }
                    `}
                  />

                  <span>
                    {selectedRDType} selected
                  </span>
                </div>

              </div>

              {/* Upload Heading */}
              <div className="mb-4 flex items-center justify-center gap-2">

                <FileSpreadsheet
                  className={`
                    w-5 h-5
                    ${
                      selectedRDType === 'Daily RD'
                        ? 'text-blue-600'
                        : 'text-emerald-600'
                    }
                  `}
                />

                <span className="text-sm font-semibold text-gray-700">
                  Upload {selectedRDType} Ledger
                </span>

              </div>

              {/* Upload Component */}
              <UploadSection
                onFileLoaded={handleFile}
                isLoading={isLoading}
              />

              {/* BACK BUTTON */}
              <div className="mt-6 flex justify-center">

                <button
                  type="button"
                  onClick={handleBackToRDSelection}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50 shadow-sm transition-all duration-200 active:scale-[0.98] cursor-pointer"
                >
                  <span className="text-base">←</span>
                  <span>Back</span>
                </button>

              </div>

            </div>
          )}

          {/* No Selection Message */}
          {!selectedRDType && (
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-400">
                Choose an RD type above to continue
              </p>
            </div>
          )}

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

        {/* Error notification */}
        {error && (
          <ErrorAlert
            title={error.title}
            message={error.message}
            onClear={() => setError(null)}
            onRetry={handleReset}
          />
        )}

        {/* --------------------------------------------------------------- */}
        {/* OPENING / RD SELECTION SCREEN                                  */}
        {/* --------------------------------------------------------------- */}

        {!accountData && (
          renderRDSelectionScreen()
        )}

        {/* --------------------------------------------------------------- */}
        {/* VALID LEDGER SCREEN                                            */}
        {/* --------------------------------------------------------------- */}

        {accountData && (
          <div>

            {/* 1. Customer Details */}
            <CustomerDetails data={accountData} />

            {/* 2. Ledger Preview */}
            <LedgerPreview
              transactions={accountData.transactions}
            />

            {/* 3. Maturity Result */}
            <MaturityResult
              data={accountData}
              onReset={handleReset}
            />

          </div>
        )}

      </main>

      {/* ---------------------------------------------------------------- */}
      {/* FOOTER                                                          */}
      {/* ---------------------------------------------------------------- */}

      <footer className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-500 shrink-0">

        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">

          <span>
            <strong>RD MATURITY CALCULATOR</strong>
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