/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';

import { RDAccountData, RDParseError } from './types';

import { selectDaySheetCustomer, RDValidationError } from './utils/excelParser';
import { recalculateRDWithRate } from './utils/rdCalculator';
import { getDefaultRateForDuration } from './utils/rdInterestCalculator';
import { processMultiFormatDocument } from './utils/adapters/documentProcessor';

import { Header } from './components/Header';
import { UploadSection } from './components/UploadSection';
import { CustomerDetails } from './components/CustomerDetails';
import { LedgerPreview } from './components/LedgerPreview';
import { MaturityResult } from './components/MaturityResult';
import { ErrorAlert } from './components/ErrorAlert';
import { InterestRateSelection } from './components/InterestRateSelection';
import { PreClosureCalculator } from './components/PreClosureCalculator';
import { DailyRDInterestCalculator } from './components/DailyRDInterestCalculator';
import { DailyInstallmentInput } from './components/DailyInstallmentInput';
import { DocumentVerificationScreen } from './components/DocumentVerificationScreen';
import { RDDocumentProcessingError } from './utils/imageParser';

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
  Coins,
  ImageIcon,
} from 'lucide-react';

type RDSelection = 'Daily RD' | 'Monthly RD';
type CalculationMode = 'Maturity' | 'Pre-Closure' | 'Daily-Interest';

export default function App() {
  const [accountData, setAccountData] = useState<RDAccountData | null>(null);
  const [extractedAccountData, setExtractedAccountData] = useState<RDAccountData | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const isProcessingRef = useRef<boolean>(false);

  const [error, setError] = useState<RDParseError | null>(null);
  const [selectedRDType, setSelectedRDType] = useState<RDSelection | null>(null);
  const [contractualDailyInstallment, setContractualDailyInstallment] = useState<number>(100);
  const [isConfiguringDailyInstallment, setIsConfiguringDailyInstallment] = useState<boolean>(false);

  const [selectedInterestRate, setSelectedInterestRate] = useState<number>(12);
  const [calculationMode, setCalculationMode] = useState<CalculationMode | null>(null);

  // ===========================================================================
  // CALCULATOR SELECTION
  // ===========================================================================

  const handleCalculationModeSelection = (mode: CalculationMode) => {
    setCalculationMode(mode);
    setSelectedRDType(null);
    setAccountData(null);
    setExtractedAccountData(null);
    setIsVerifying(false);
    setIsConfiguringDailyInstallment(false);
    setContractualDailyInstallment(100);
    setError(null);
    setSelectedInterestRate(12);
  };

  // ===========================================================================
  // RD TYPE SELECTION
  // ===========================================================================

  const handleRDSelection = (type: RDSelection) => {
    setSelectedRDType(type);
    setError(null);
    if (type === 'Daily RD') {
      setIsConfiguringDailyInstallment(true);
    } else {
      setIsConfiguringDailyInstallment(false);
    }
  };

  const handleDailyInstallmentContinue = (installmentAmount: number) => {
    setContractualDailyInstallment(installmentAmount);
    setIsConfiguringDailyInstallment(false);
  };

  // ===========================================================================
  // INTEREST RATE SELECTION
  // ===========================================================================

  const handleInterestRateChange = (rate: number) => {
    setSelectedInterestRate(rate);

    setAccountData((currentData) => {
      if (!currentData) return null;
      return recalculateRDWithRate(currentData, rate);
    });
  };

  const handleSelectCustomer = (customerKey: string) => {
    if (isVerifying && extractedAccountData) {
      const switched = selectDaySheetCustomer(extractedAccountData, customerKey);
      setExtractedAccountData(switched);
      return;
    }

    if (!accountData) return;
    const switched = selectDaySheetCustomer(accountData, customerKey);
    const activeRate = selectedInterestRate || switched.annualRate * 100;
    const recalculated = recalculateRDWithRate(
      {
        ...switched,
        configuredDailyInstallment: contractualDailyInstallment,
      },
      activeRate
    );
    setAccountData(recalculated);
  };

  // ===========================================================================
  // HANDLE MULTI-FORMAT FILE UPLOAD
  // Supported: .xlsx, .xls, .pdf, .jpg, .jpeg, .png
  // ===========================================================================

  const handleFile = async (file: File) => {
    if (isProcessingRef.current) return;

    isProcessingRef.current = true;
    setIsLoading(true);
    setProcessingStatus('Inspecting document format...');
    setError(null);

    try {
      if (!selectedRDType) {
        throw new Error('Please select Daily RD or Monthly RD before uploading the ledger.');
      }

      const parsedData = await processMultiFormatDocument(file, {
        rdType: selectedRDType,
        contractualDailyInstallment,
        onStatusUpdate: (msg) => setProcessingStatus(msg),
      });

      // Verify RD Type compatibility if the document explicitly specifies it
      if (
        parsedData.rdType &&
        (parsedData.rdType === 'Daily RD' || parsedData.rdType === 'Monthly RD') &&
        parsedData.rdType !== selectedRDType
      ) {
        throw new Error(
          `You selected ${selectedRDType}, but the uploaded document appears to be ${parsedData.rdType}. Please select the matching RD type or upload the matching document.`
        );
      }

      // Store extracted data and move to verification screen
      setExtractedAccountData(parsedData);
      setIsVerifying(true);
      setError(null);
    } catch (err: unknown) {
      setAccountData(null);
      setExtractedAccountData(null);
      setIsVerifying(false);

      if (err instanceof RDDocumentProcessingError) {
        let title = 'Unable to Process Document Image';
        if (err.errorType === 'UNAVAILABLE') {
          title = 'AI Service Busy';
        } else if (err.errorType === 'RATE_LIMIT') {
          title = 'Rate Limit Reached';
        } else if (err.errorType === 'AUTH_ERROR') {
          title = 'AI Service Configuration Error';
        } else if (err.errorType === 'INVALID_IMAGE') {
          title = 'Invalid Image';
        } else if (err.errorType === 'UNRECOGNIZED_DOCUMENT') {
          title = 'Unsupported Document';
        }

        setError({
          title,
          message: err.message,
        });
      } else if (err instanceof RDValidationError) {
        setError({
          title: 'Ledger Validation Error',
          message: err.message,
        });
      } else if (err instanceof Error) {
        setError({
          title: 'Unable to Read Document',
          message: err.message,
        });
      } else {
        setError({
          title: 'Processing Error',
          message: 'An unexpected error occurred while processing the document. Please try again.',
        });
      }
    } finally {
      setIsLoading(false);
      setProcessingStatus('');
      isProcessingRef.current = false;
    }
  };

  // ===========================================================================
  // CONFIRM VERIFICATION & CALCULATE MATURITY
  // ===========================================================================

  const handleConfirmVerification = (
    verifiedData: RDAccountData,
    confirmedInstallment: number
  ) => {
    setContractualDailyInstallment(confirmedInstallment);

    const initialRate = getDefaultRateForDuration(
      verifiedData.rdType as any,
      verifiedData.rdType === 'Daily RD' ? verifiedData.tenureDays || 365 : 12
    );

    const preparedData: RDAccountData = {
      ...verifiedData,
      configuredDailyInstallment: confirmedInstallment,
      dailySchemeAmount:
        verifiedData.rdType === 'Daily RD'
          ? confirmedInstallment
          : verifiedData.dailySchemeAmount,
    };

    const calculated = recalculateRDWithRate(preparedData, initialRate);
    setSelectedInterestRate(initialRate);
    setAccountData(calculated);
    setIsVerifying(false);
    setError(null);
  };

  const handleCancelVerification = () => {
    setIsVerifying(false);
    setExtractedAccountData(null);
  };

  // ===========================================================================
  // RESET
  // ===========================================================================

  const handleReset = () => {
    setAccountData(null);
    setExtractedAccountData(null);
    setIsVerifying(false);
    setIsConfiguringDailyInstallment(false);
    setContractualDailyInstallment(100);
    setError(null);
    setSelectedRDType(null);
    setSelectedInterestRate(12);
    setCalculationMode(null);
    setIsLoading(false);
    setProcessingStatus('');
    isProcessingRef.current = false;
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
                Simple • Secure • Multi-Format Supported
              </span>
            </div>

            <div className="mx-auto mb-5 flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-xl shadow-blue-200">
              <Calculator className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-gray-900">
              RD Calculator
            </h1>

            <p className="mt-4 text-base sm:text-lg leading-relaxed text-gray-500 max-w-2xl mx-auto">
              Calculate Recurring Deposit maturity or pre-closure amounts from Excel workbooks, PDF ledgers, or document photos & scans.
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
                Excel, PDF & Images (.jpg/.png)
              </span>
            </div>

            <div className="flex items-center justify-center gap-2 rounded-xl bg-white/80 border border-gray-100 px-4 py-3 shadow-sm">
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs sm:text-sm text-gray-600">
                Data Verification Screen
              </span>
            </div>

            <div className="flex items-center justify-center gap-2 rounded-xl bg-white/80 border border-gray-100 px-4 py-3 shadow-sm">
              <ShieldCheck className="w-4 h-4 text-violet-600" />
              <span className="text-xs sm:text-sm text-gray-600">
                Personal Ledgers & Day Sheets
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                {/* MATURITY CALCULATOR */}
                <button
                  type="button"
                  onClick={() => handleCalculationModeSelection('Maturity')}
                  className="group relative text-left p-6 sm:p-8 rounded-2xl border-2 border-gray-200 bg-white shadow-sm transition-all duration-200 hover:border-blue-400 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-blue-100 cursor-pointer"
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
                        Calculate the maturity amount of your Recurring Deposit with contractual installment rules and multi-format ledger processing.
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
                  onClick={() => handleCalculationModeSelection('Pre-Closure')}
                  className="group relative text-left p-6 sm:p-8 rounded-2xl border-2 border-gray-200 bg-white shadow-sm transition-all duration-200 hover:border-amber-400 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-amber-100 cursor-pointer"
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
                        Calculate the amount payable when an RD is closed before its original maturity date with applicable slab rates.
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

                {/* RD INTEREST CALCULATOR */}
                <button
                  type="button"
                  onClick={() => handleCalculationModeSelection('Daily-Interest')}
                  className="group relative text-left p-6 sm:p-8 rounded-2xl border-2 border-gray-200 bg-white shadow-sm transition-all duration-200 hover:border-indigo-400 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-indigo-100 cursor-pointer"
                >
                  <div className="flex items-start gap-5">
                    <div className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-200">
                      <Coins className="w-7 h-7" />
                    </div>

                    <div className="pr-4">
                      <h3 className="text-xl font-bold text-gray-900">
                        RD Interest Calculator
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-gray-500">
                        Interactive deposit and interest projection for Daily and Monthly recurring deposits with rate adjustment controls.
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
                          Deposit & Interest
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-semibold text-indigo-600">
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
          {calculationMode && calculationMode !== 'Daily-Interest' && !selectedRDType && (
            <div className="mt-10">
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-xs font-semibold text-blue-700 mb-3">
                  {calculationMode === 'Maturity' ? 'Maturity Calculator' : 'Pre-Closure Calculator'}
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  Select RD Type
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                  Select the deposit frequency that matches your account ledger.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {/* DAILY RD */}
                <button
                  type="button"
                  onClick={() => handleRDSelection('Daily RD')}
                  className="group relative text-left p-6 sm:p-8 rounded-2xl border-2 border-gray-200 bg-white shadow-sm transition-all duration-200 hover:border-blue-400 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-blue-100 cursor-pointer"
                >
                  <div className="flex items-start gap-5">
                    <div className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-200">
                      <CalendarDays className="w-7 h-7" />
                    </div>

                    <div className="pr-4">
                      <h3 className="text-xl font-bold text-gray-900">Daily RD</h3>
                      <p className="mt-2 text-sm leading-relaxed text-gray-500">
                        For recurring deposits where contributions are collected on a daily basis (includes 90-day contractual installment rules).
                      </p>
                    </div>
                  </div>

                  <div className="mt-7 pt-5 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                          Deposit Frequency
                        </p>
                        <p className="mt-1 text-sm font-semibold text-gray-700">Daily</p>
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
                  onClick={() => handleRDSelection('Monthly RD')}
                  className="group relative text-left p-6 sm:p-8 rounded-2xl border-2 border-gray-200 bg-white shadow-sm transition-all duration-200 hover:border-emerald-400 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-emerald-100 cursor-pointer"
                >
                  <div className="flex items-start gap-5">
                    <div className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-200">
                      <CalendarDays className="w-7 h-7" />
                    </div>

                    <div className="pr-4">
                      <h3 className="text-xl font-bold text-gray-900">Monthly RD</h3>
                      <p className="mt-2 text-sm leading-relaxed text-gray-500">
                        For recurring deposits where a fixed installment is deposited monthly with schedule and missed installment tracking.
                      </p>
                    </div>
                  </div>

                  <div className="mt-7 pt-5 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                          Deposit Frequency
                        </p>
                        <p className="mt-1 text-sm font-semibold text-gray-700">Monthly</p>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
                        Continue
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1" />
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setCalculationMode(null);
                    setSelectedRDType(null);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition-all cursor-pointer"
                >
                  ← Back to Calculators
                </button>
              </div>
            </div>
          )}

          {/* DAILY RD INSTALLMENT INPUT SCREEN (Step 2 of Daily RD Maturity workflow) */}
          {calculationMode &&
            calculationMode !== 'Daily-Interest' &&
            selectedRDType === 'Daily RD' &&
            isConfiguringDailyInstallment && (
              <DailyInstallmentInput
                initialAmount={contractualDailyInstallment}
                onContinue={handleDailyInstallmentContinue}
                onBack={() => {
                  setSelectedRDType(null);
                  setIsConfiguringDailyInstallment(false);
                }}
              />
            )}

          {/* DOCUMENT UPLOAD SCREEN */}
          {calculationMode &&
            calculationMode !== 'Daily-Interest' &&
            selectedRDType &&
            !isConfiguringDailyInstallment &&
            !isVerifying &&
            !accountData && (
              <div className="mt-8 max-w-4xl mx-auto">
                <div className="text-center mb-5">
                  <div
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${
                      selectedRDType === 'Daily RD'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {selectedRDType}
                      {selectedRDType === 'Daily RD' &&
                        ` (₹${contractualDailyInstallment.toLocaleString()} / day)`}
                    </span>
                  </div>
                </div>

                <div className="rounded-3xl bg-white border border-gray-200 shadow-sm p-5 sm:p-7">
                  <div className="text-center mb-5">
                    <div
                      className={`mx-auto w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${
                        selectedRDType === 'Daily RD'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-emerald-50 text-emerald-600'
                      }`}
                    >
                      <Upload className="w-6 h-6" />
                    </div>

                    <h3 className="text-xl font-extrabold text-gray-900">
                      Upload {selectedRDType} Document
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
                      Supports Excel workbooks, PDF files, and clear document photos or scans.
                    </p>
                  </div>

                  <UploadSection
                    onFileLoaded={handleFile}
                    isLoading={isLoading}
                    statusMessage={processingStatus}
                  />
                </div>

                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedRDType === 'Daily RD') {
                        setIsConfiguringDailyInstallment(true);
                      } else {
                        setSelectedRDType(null);
                      }
                      setAccountData(null);
                      setExtractedAccountData(null);
                      setError(null);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition-all cursor-pointer"
                  >
                    {selectedRDType === 'Daily RD'
                      ? '← Back to Daily Installment'
                      : '← Back to RD Type'}
                  </button>
                </div>
              </div>
            )}

          {/* BOTTOM FORMAT SUMMARY */}
          {!calculationMode && (
            <div className="mt-12 text-center">
              <div className="inline-flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-gray-400">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel (.xlsx, .xls)
                </span>
                <span className="hidden sm:inline text-gray-300">•</span>
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <FileText className="w-3.5 h-3.5" />
                  PDF Documents (.pdf)
                </span>
                <span className="hidden sm:inline text-gray-300">•</span>
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Images (.jpg, .jpeg, .png)
                </span>
                <span className="hidden sm:inline text-gray-300">•</span>
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Secure Multi-Format Processing
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
        {/* ERROR ALERT */}
        {error && (
          <ErrorAlert
            title={error.title}
            message={error.message}
            onClear={() => setError(null)}
            onRetry={handleReset}
          />
        )}

        {/* TOP CALCULATOR SWITCHER TABS */}
        {calculationMode && (
          <div className="w-full max-w-6xl mx-auto px-4 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-gray-200 p-1.5 sm:p-2 rounded-2xl shadow-xs">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => handleCalculationModeSelection('Maturity')}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    calculationMode === 'Maturity'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Calculator className="w-4 h-4" />
                  Maturity Calculator
                </button>

                <button
                  type="button"
                  onClick={() => handleCalculationModeSelection('Pre-Closure')}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    calculationMode === 'Pre-Closure'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <CalendarDays className="w-4 h-4" />
                  Pre-Closure Calculator
                </button>

                <button
                  type="button"
                  onClick={() => handleCalculationModeSelection('Daily-Interest')}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    calculationMode === 'Daily-Interest'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Coins className="w-4 h-4" />
                  RD Interest Calculator
                </button>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-semibold text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                ← Back to Home
              </button>
            </div>
          </div>
        )}

        {/* DAILY RD INTEREST CALCULATOR MODE */}
        {calculationMode === 'Daily-Interest' && (
          <DailyRDInterestCalculator onBackToCalculators={handleReset} />
        )}

        {/* VERIFICATION SCREEN (Before final maturity / pre-closure calculation) */}
        {calculationMode !== 'Daily-Interest' && isVerifying && extractedAccountData && (
          <DocumentVerificationScreen
            data={extractedAccountData}
            contractualDailyInstallment={contractualDailyInstallment}
            onConfirmAndCalculate={handleConfirmVerification}
            onSelectCustomer={handleSelectCustomer}
            onCancel={handleCancelVerification}
          />
        )}

        {/* INITIAL SETUP SCREENS (When not Daily-Interest, not verifying, and no calculated data) */}
        {calculationMode !== 'Daily-Interest' && !isVerifying && !accountData && (
          renderRDSelectionScreen()
        )}

        {/* CALCULATION RESULTS SCREEN */}
        {calculationMode !== 'Daily-Interest' && !isVerifying && accountData && (
          <div>
            {calculationMode === 'Maturity' ? (
              <div>
                <InterestRateSelection
                  selectedRate={selectedInterestRate}
                  onRateChange={handleInterestRateChange}
                  defaultRate={getDefaultRateForDuration(
                    accountData.rdType as any,
                    accountData.rdType === 'Daily RD' ? accountData.tenureDays || 365 : 12
                  )}
                  tenureLabel={
                    accountData.period || `${accountData.tenureDays || 365} Days`
                  }
                />

                <CustomerDetails
                  data={accountData}
                  onSelectCustomer={handleSelectCustomer}
                />

                <LedgerPreview transactions={accountData.transactions} />

                <MaturityResult data={accountData} onReset={handleReset} />
              </div>
            ) : (
              <PreClosureCalculator data={accountData} onReset={handleReset} />
            )}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-500 shrink-0">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            <strong>RD CALCULATOR</strong> — Multi-Format Document Processing (.xlsx, .xls, .pdf, .jpg, .png)
          </span>

          <span className="text-gray-400">
            Personal RD Ledgers, Branch Day Sheets & Statements
          </span>
        </div>
      </footer>
    </div>
  );
}