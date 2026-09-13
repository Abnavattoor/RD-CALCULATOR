import React, {
  useMemo,
  useState,
} from 'react';

import {
  CalendarDays,
  Calculator,
  CheckCircle2,
  Clock3,
  IndianRupee,
  Percent,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

import { RDAccountData } from '../types';

import {
  calculatePreClosure,
  calculateAccurateLedgerInterest,
  PreClosureCalculationResult,
} from '../utils/preClosureCalculator';

import {
  PRE_CLOSURE_RATE_TABLE,
  PreClosureScheme,
  getApplicablePreClosureRate,
} from '../utils/preClosureRates';

interface PreClosureCalculatorProps {
  data: RDAccountData;
  onReset: () => void;
}

function formatCurrency(
  value: number
): string {
  return new Intl.NumberFormat(
    'en-IN',
    {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }
  ).format(
    Number.isFinite(value)
      ? value
      : 0
  );
}

function parseDateInput(
  value: string | undefined
): Date | null {
  if (!value) {
    return null;
  }

  const text =
    value.trim();

  if (!text) {
    return null;
  }

  let match =
    text.match(
      /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/
    );

  if (match) {
    const day =
      Number(match[1]);

    const month =
      Number(match[2]) - 1;

    const year =
      Number(match[3]);

    const date =
      new Date(
        year,
        month,
        day
      );

    if (
      date.getFullYear() === year &&
      date.getMonth() === month &&
      date.getDate() === day
    ) {
      return date;
    }
  }

  match =
    text.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    );

  if (match) {
    const year =
      Number(match[1]);

    const month =
      Number(match[2]) - 1;

    const day =
      Number(match[3]);

    const date =
      new Date(
        year,
        month,
        day
      );

    if (
      date.getFullYear() === year &&
      date.getMonth() === month &&
      date.getDate() === day
    ) {
      return date;
    }
  }

  const fallback =
    new Date(text);

  return Number.isNaN(
    fallback.getTime()
  )
    ? null
    : fallback;
}

function toInputDate(
  value: string | undefined
): string {
  const date =
    parseDateInput(value);

  if (!date) {
    return '';
  }

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      date.getDate()
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getDateFromTransaction(
  transaction: any
): Date | null {
  if (
    transaction.depositDateObj instanceof Date &&
    !Number.isNaN(
      transaction.depositDateObj.getTime()
    )
  ) {
    return new Date(
      transaction.depositDateObj
    );
  }

  return parseDateInput(
    transaction.date
  );
}

function getTotalDepositedTillDate(
  data: RDAccountData,
  closureDate: string
): number {
  const closure =
    parseDateInput(
      closureDate
    );

  if (!closure) {
    return 0;
  }

  return Number(
    (
      data.transactions || []
    )
      .filter(
        (transaction) => {
          const transactionDate =
            getDateFromTransaction(
              transaction
            );

          return (
            transactionDate !== null &&
            transactionDate.getTime() <=
              closure.getTime() &&
            transaction.isValidPayment
          );
        }
      )
      .reduce(
        (
          total,
          transaction
        ) => {
          const amount =
            typeof transaction.receiptCredit ===
            'number'
              ? transaction.receiptCredit
              : Number(
                  String(
                    transaction.receiptCredit ??
                      ''
                  )
                    .replace(/₹/g, '')
                    .replace(/,/g, '')
                );

          return (
            total +
            (
              Number.isFinite(amount)
                ? Math.max(
                    0,
                    amount
                  )
                : 0
            )
          );
        },
        0
      )
      .toFixed(2)
  );
}

export function PreClosureCalculator({
  data,
  onReset,
}: PreClosureCalculatorProps) {
  const [scheme, setScheme] =
    useState<PreClosureScheme>('RC');

  const [
    originalTenureYears,
    setOriginalTenureYears,
  ] = useState<number>(1);

  const [
    closureDate,
    setClosureDate,
  ] = useState<string>('');

  // ===========================================================================
  // AVAILABLE TENURES
  // ===========================================================================

  const availableTenures =
    useMemo(() => {
      if (scheme === 'RC') {
        return [1, 2, 3];
      }

      return [1, 2, 3, 4, 5];
    }, [scheme]);

  // ===========================================================================
  // CLOSURE MONTH
  // ===========================================================================

  const closureMonth =
    useMemo(() => {
      const openingDate =
        parseDateInput(
          data.openingDate
        );

      const selectedDate =
        parseDateInput(
          closureDate
        );

      if (
        !openingDate ||
        !selectedDate ||
        selectedDate.getTime() <=
          openingDate.getTime()
      ) {
        return null;
      }

      let completedMonths =
        (
          selectedDate.getFullYear() -
            openingDate.getFullYear()
        ) *
          12 +
        (
          selectedDate.getMonth() -
            openingDate.getMonth()
        );

      if (
        selectedDate.getDate() <
        openingDate.getDate()
      ) {
        completedMonths -= 1;
      }

      completedMonths =
        Math.max(
          0,
          completedMonths
        );

      return (
        completedMonths + 1
      );
    }, [
      data.openingDate,
      closureDate,
    ]);

  // ===========================================================================
  // APPLICABLE PRE-CLOSURE RATE
  //
  // THIS IS THE EXISTING RATE TABLE LOGIC.
  // ===========================================================================

  const applicableRate =
    useMemo(() => {
      if (!closureMonth) {
        return null;
      }

      try {
        return getApplicablePreClosureRate(
          scheme,
          originalTenureYears,
          closureMonth
        );
      } catch {
        return null;
      }
    }, [
      scheme,
      originalTenureYears,
      closureMonth,
    ]);

  // ===========================================================================
  // TOTAL DEPOSITED UP TO CLOSURE
  // ===========================================================================

  const totalDepositedTillClosure =
    useMemo(() => {
      return getTotalDepositedTillDate(
        data,
        closureDate
      );
    }, [
      data,
      closureDate,
    ]);

  // ===========================================================================
  // EXISTING PRE-CLOSURE RESULT
  //
  // DO NOT CHANGE THE EXISTING CALCULATION.
  // ===========================================================================

  const result =
    useMemo<
      PreClosureCalculationResult | null
    >(() => {
      if (!closureDate) {
        return null;
      }

      try {
        return calculatePreClosure(
          data,
          scheme,
          originalTenureYears,
          closureDate
        );
      } catch {
        return null;
      }
    }, [
      data,
      scheme,
      originalTenureYears,
      closureDate,
    ]);

  // ===========================================================================
  // NEW: ACCURATE LEDGER INTEREST
  //
  // This is completely separate from the existing pre-closure calculation.
  // ===========================================================================

  const accurateLedgerInterest =
    useMemo(() => {
      if (!closureDate) {
        return 0;
      }

      return calculateAccurateLedgerInterest(
        data,
        closureDate
      );
    }, [
      data,
      closureDate,
    ]);

  // ===========================================================================
  // LEDGER INTEREST RATE
  // ===========================================================================

  const ledgerInterestRate =
    useMemo(() => {
      if (
        typeof data.annualRate ===
          'number' &&
        Number.isFinite(
          data.annualRate
        )
      ) {
        return data.annualRate;
      }

      if (
        typeof data.selectedInterestRate ===
          'number' &&
        Number.isFinite(
          data.selectedInterestRate
        )
      ) {
        return data.selectedInterestRate;
      }

      const parsed =
        Number(
          String(
            data.interestRate || ''
          )
            .replace('%', '')
            .trim()
        );

      return Number.isFinite(
        parsed
      )
        ? parsed
        : 0;
    }, [
      data.annualRate,
      data.selectedInterestRate,
      data.interestRate,
    ]);

  // ===========================================================================
  // LEDGER VALUE
  // ===========================================================================

  const ledgerValue =
    Number(
      (
        totalDepositedTillClosure +
        accurateLedgerInterest
      ).toFixed(2)
    );

  // ===========================================================================
  // RESET
  // ===========================================================================

  const handleLocalReset = () => {
    setScheme('RC');
    setOriginalTenureYears(1);
    setClosureDate('');
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:py-10">

      <div className="max-w-6xl mx-auto">

        {/* =================================================================
            HEADER
        ================================================================== */}

        <div className="text-center max-w-3xl mx-auto mb-8">

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-xs font-bold uppercase tracking-wider">

            <CalendarDays className="w-4 h-4" />

            Pre-Closure Calculator

          </div>

          <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold text-gray-900">
            RD Pre-Closure Calculation
          </h1>

          <p className="mt-3 text-sm sm:text-base text-gray-500">
            Calculate the pre-closure amount using the applicable scheme rate and view the actual ledger interest separately.
          </p>

        </div>

        {/* =================================================================
            ACCOUNT SUMMARY
        ================================================================== */}

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 sm:p-6 mb-6">

          <div className="flex items-center gap-3 mb-5">

            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">

              <ShieldCheck className="w-5 h-5" />

            </div>

            <div>

              <h2 className="font-bold text-gray-900">
                Ledger Summary
              </h2>

              <p className="text-xs text-gray-500">
                Information extracted from your uploaded ledger
              </p>

            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">

              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Customer
              </p>

              <p className="mt-1 font-semibold text-gray-900">
                {data.customerName || '—'}
              </p>

            </div>

            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">

              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Account Number
              </p>

              <p className="mt-1 font-semibold text-gray-900">
                {data.accountNumber || '—'}
              </p>

            </div>

            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">

              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Opening Date
              </p>

              <p className="mt-1 font-semibold text-gray-900">
                {data.openingDate || '—'}
              </p>

            </div>

            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">

              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Original Maturity
              </p>

              <p className="mt-1 font-semibold text-gray-900">
                {data.maturityDate || '—'}
              </p>

            </div>

          </div>

        </div>

        {/* =================================================================
            INPUT CARD
        ================================================================== */}

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 sm:p-7 mb-6">

          <div className="flex items-center gap-3 mb-6">

            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">

              <Calculator className="w-5 h-5" />

            </div>

            <div>

              <h2 className="font-bold text-gray-900">
                Pre-Closure Details
              </h2>

              <p className="text-xs text-gray-500">
                Select the scheme, original tenure and closure date
              </p>

            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* SCHEME */}

            <div>

              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Scheme
              </label>

              <select
                value={scheme}
                onChange={(event) => {
                  const newScheme =
                    event.target.value as PreClosureScheme;

                  setScheme(
                    newScheme
                  );

                  const tenures =
                    newScheme === 'RC'
                      ? [1, 2, 3]
                      : [1, 2, 3, 4, 5];

                  if (
                    !tenures.includes(
                      originalTenureYears
                    )
                  ) {
                    setOriginalTenureYears(
                      tenures[0]
                    );
                  }
                }}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-900 focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-100"
              >

                <option value="RC">
                  RC
                </option>

                <option value="DS">
                  DS
                </option>

              </select>

            </div>

            {/* TENURE */}

            <div>

              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Original Tenure
              </label>

              <select
                value={originalTenureYears}
                onChange={(event) =>
                  setOriginalTenureYears(
                    Number(
                      event.target.value
                    )
                  )
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-900 focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-100"
              >

                {availableTenures.map(
                  (years) => (
                    <option
                      key={years}
                      value={years}
                    >
                      {years}{' '}
                      {years === 1
                        ? 'Year'
                        : 'Years'}
                    </option>
                  )
                )}

              </select>

            </div>

            {/* CLOSURE DATE */}

            <div>

              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Pre-Closure Date
              </label>

              <input
                type="date"
                value={closureDate}
                min={toInputDate(
                  data.openingDate
                )}
                max={toInputDate(
                  data.maturityDate
                )}
                onChange={(event) =>
                  setClosureDate(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-900 focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-100"
              />

            </div>

          </div>

          {/* RATE PREVIEW */}

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">

              <div className="flex items-center justify-between">

                <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  Closure Month
                </span>

                <Clock3 className="w-4 h-4 text-amber-600" />

              </div>

              <p className="mt-2 text-2xl font-bold text-amber-950">

                {closureMonth
                  ? `Month ${closureMonth}`
                  : '—'}

              </p>

            </div>

            <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">

              <div className="flex items-center justify-between">

                <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
                  Applicable Rate
                </span>

                <Percent className="w-4 h-4 text-blue-600" />

              </div>

              <p className="mt-2 text-2xl font-bold text-blue-950">

                {applicableRate !== null
                  ? `${applicableRate}%`
                  : '—'}

              </p>

            </div>

            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">

              <div className="flex items-center justify-between">

                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Deposited Till Closure
                </span>

                <IndianRupee className="w-4 h-4 text-emerald-600" />

              </div>

              <p className="mt-2 text-2xl font-bold text-emerald-950">

                {formatCurrency(
                  totalDepositedTillClosure
                )}

              </p>

            </div>

          </div>

        </div>

        {/* =================================================================
            RESULTS
        ================================================================== */}

        {result && (

          <>

            {/* =============================================================
                EXISTING PRE-CLOSURE RESULT
                ============================================================= */}

            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 sm:p-7 mb-6">

              <div className="flex items-center gap-3 mb-6">

                <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">

                  <Calculator className="w-5 h-5" />

                </div>

                <div>

                  <h2 className="font-bold text-gray-900">
                    Pre-Closure Amount
                  </h2>

                  <p className="text-xs text-gray-500">
                    Existing pre-closure calculation
                  </p>

                </div>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* TOTAL DEPOSITED */}

                <div className="rounded-xl bg-blue-50 border border-blue-200 p-5">

                  <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                    Total Deposited
                  </p>

                  <p className="mt-2 text-2xl font-bold font-mono text-blue-950">
                    {formatCurrency(
                      result.totalDeposited
                    )}
                  </p>

                  <p className="mt-2 text-xs text-blue-700">
                    Actual payments made up to pre-closure
                  </p>

                </div>

                {/* PRE-CLOSURE RETURN */}

                <div className="rounded-xl bg-amber-50 border border-amber-200 p-5">

                  <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
                    Interest for Pre-Closure Month
                  </p>

                  <p className="mt-2 text-2xl font-bold font-mono text-amber-950">
                    {formatCurrency(
                      result.returnAmount
                    )}
                  </p>

                  <p className="mt-2 text-xs text-amber-700">
                    {result.applicableRate}% of total deposited amount
                  </p>

                </div>

                {/* FINAL PAYABLE */}

                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5">

                  <div className="flex items-center justify-between">

                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                      Final Payable
                    </p>

                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />

                  </div>

                  <p className="mt-2 text-3xl font-bold font-mono text-emerald-950">
                    {formatCurrency(
                      result.finalPayable
                    )}
                  </p>

                  <p className="mt-2 text-xs text-emerald-700">
                    Total deposited + pre-closure interest
                  </p>

                </div>

              </div>

              {/* FORMULA */}

              <div className="mt-6 rounded-xl bg-gray-50 border border-gray-200 p-5">

                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                  Existing Pre-Closure Formula
                </p>

                <div className="space-y-2 text-sm text-gray-700">

                  <p>
                    <strong>
                      Pre-Closure Interest
                    </strong>{' '}
                    = Total Deposited × Applicable Rate ÷ 100
                  </p>

                  <p>
                    <strong>
                      Final Payable
                    </strong>{' '}
                    = Total Deposited + Pre-Closure Interest
                  </p>

                </div>

              </div>

            </div>

            {/* =============================================================
                NEW ACCURATE LEDGER INTEREST CARD
                ============================================================= */}

            <div className="bg-white border-2 border-blue-200 rounded-2xl shadow-sm p-5 sm:p-7 mb-6">

              <div className="flex items-start gap-4">

                <div className="shrink-0 w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">

                  <TrendingUp className="w-6 h-6" />

                </div>

                <div>

                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                    Accurate Interest Till Pre-Closure Date
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Actual interest calculated from the ledger's running balance up to the selected pre-closure date.
                  </p>

                </div>

              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">

                {/* LEDGER RATE */}

                <div className="rounded-xl bg-gray-50 border border-gray-200 p-5">

                  <div className="flex items-center justify-between">

                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Ledger Interest Rate
                    </span>

                    <Percent className="w-4 h-4 text-gray-500" />

                  </div>

                  <p className="mt-2 text-2xl font-bold font-mono text-gray-900">
                    {ledgerInterestRate.toFixed(2)}%
                  </p>

                  <p className="mt-2 text-xs text-gray-500">
                    Annual ledger rate
                  </p>

                </div>

                {/* ACTUAL INTEREST */}

                <div className="rounded-xl bg-blue-50 border border-blue-200 p-5">

                  <div className="flex items-center justify-between">

                    <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                      Accurate Interest Earned
                    </span>

                    <TrendingUp className="w-4 h-4 text-blue-600" />

                  </div>

                  <p className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-blue-950">
                    {formatCurrency(
                      accurateLedgerInterest
                    )}
                  </p>

                  <p className="mt-2 text-xs text-blue-700">
                    Calculated from actual daily running balances
                  </p>

                </div>

                {/* LEDGER VALUE */}

                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5">

                  <div className="flex items-center justify-between">

                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                      Deposit + Actual Interest
                    </span>

                    <IndianRupee className="w-4 h-4 text-emerald-600" />

                  </div>

                  <p className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-emerald-950">
                    {formatCurrency(
                      ledgerValue
                    )}
                  </p>

                  <p className="mt-2 text-xs text-emerald-700">
                    Informational ledger value
                  </p>

                </div>

              </div>

              {/* FORMULA */}

              <div className="mt-6 rounded-xl bg-blue-50/50 border border-blue-100 p-5">

                <p className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-3">
                  Actual Ledger Interest Formula
                </p>

                <p className="text-sm font-mono text-gray-800">
                  Daily Interest = Running Balance × Annual Rate × Days ÷ 36500
                </p>

                <p className="mt-3 text-xs leading-relaxed text-gray-500">
                  The calculation follows the actual running balance recorded in the ledger. If a deposit is missed, the balance remains lower and the accumulated interest reflects that difference.
                </p>

              </div>

            </div>

          </>

        )}

        {/* =================================================================
            EXISTING RATE TABLE
            THIS REMAINS INTACT
        ================================================================== */}

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 sm:p-7 mb-6">

          <div className="flex items-center justify-between gap-4 mb-6">

            <div>

              <h2 className="text-lg font-bold text-gray-900">
                Pre-Closure Rate Table
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Applicable rate based on scheme, original tenure and closure month
              </p>

            </div>

            <div className="px-3 py-1.5 rounded-lg bg-gray-100 text-xs font-bold text-gray-600">
              {scheme}
            </div>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full text-sm">

              <thead>

                <tr className="border-b border-gray-200">

                  <th className="text-left py-3 px-3 font-bold text-gray-600">
                    Closure Month
                  </th>

                  <th className="text-left py-3 px-3 font-bold text-gray-600">
                    Applicable Rate
                  </th>

                </tr>

              </thead>

              <tbody>

                {(
                  PRE_CLOSURE_RATE_TABLE[
                    scheme
                  ] || []
                ).map(
                  (
                    band: any,
                    index: number
                  ) => {

                    const active =
                      closureMonth !== null &&
                      closureMonth >=
                        band.minMonth &&
                      closureMonth <=
                        band.maxMonth &&
                      band.tenures.includes(
                        originalTenureYears
                      );

                    return (
                      <tr
                        key={`${scheme}-${index}`}
                        className={`border-b border-gray-100 last:border-0 ${
                          active
                            ? 'bg-amber-50'
                            : ''
                        }`}
                      >

                        <td className="py-3 px-3 text-gray-700">

                          {band.minMonth ===
                          band.maxMonth
                            ? `Month ${band.minMonth}`
                            : `Months ${band.minMonth}–${band.maxMonth}`}

                        </td>

                        <td className="py-3 px-3">

                          <span
                            className={`font-bold ${
                              active
                                ? 'text-amber-700'
                                : 'text-gray-700'
                            }`}
                          >
                            {band.rate}%
                          </span>

                          {active && (
                            <span className="ml-2 text-[10px] uppercase tracking-wider font-bold text-amber-600">
                              Selected
                            </span>
                          )}

                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>

          </div>

        </div>

        {/* =================================================================
            IMPORTANT NOTE
        ================================================================== */}

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-5 mb-6">

          <div className="flex gap-3">

            <ShieldCheck className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />

            <div>

              <p className="text-sm font-semibold text-slate-800">
                Two interest figures are shown separately
              </p>

              <p className="mt-1 text-xs leading-relaxed text-slate-500">

                The <strong>Pre-Closure Interest</strong> is used for the existing
                pre-closure payable calculation. The{' '}
                <strong>Accurate Interest Till Pre-Closure Date</strong> is
                calculated independently from the actual ledger's running
                balance and does not change the existing pre-closure result.

              </p>

            </div>

          </div>

        </div>

        {/* =================================================================
            ACTIONS
        ================================================================== */}

        <div className="flex flex-col sm:flex-row justify-center gap-3">

          <button
            type="button"
            onClick={handleLocalReset}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all"
          >

            <RotateCcw className="w-4 h-4" />

            Reset Calculation

          </button>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-all"
          >

            Upload Another Ledger

          </button>

        </div>

      </div>

    </div>
  );
}

export default PreClosureCalculator;