import React, { useEffect, useMemo, useState } from 'react';
import { LedgerTransactionRow } from '../types';
import { formatCurrency } from '../utils/excelParser';
import {
  Table,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  CreditCard,
  Rows3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface LedgerPreviewProps {
  transactions: LedgerTransactionRow[];
}

export const LedgerPreview: React.FC<LedgerPreviewProps> = ({
  transactions,
}) => {
  // ========================================================================
  // STATE
  // ========================================================================

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<
    'all' | 'included' | 'excluded'
  >('all');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // ========================================================================
  // COUNTS
  // ========================================================================

  const includedCount = useMemo(
    () => transactions.filter((row) => row.isValidPayment).length,
    [transactions]
  );

  const excludedCount = useMemo(
    () => transactions.filter((row) => !row.isValidPayment).length,
    [transactions]
  );

  // ========================================================================
  // COLUMN DETECTION
  // ========================================================================

  const hasDebitColumn = useMemo(
    () =>
      transactions.some(
        (row) =>
          row.paymentDebit !== null &&
          row.paymentDebit !== undefined &&
          row.paymentDebit !== ''
      ),
    [transactions]
  );

  const hasBalanceColumn = useMemo(
    () =>
      transactions.some(
        (row) =>
          row.balance !== null &&
          row.balance !== undefined &&
          row.balance !== ''
      ),
    [transactions]
  );

  const hasIntPaidColumn = useMemo(
    () =>
      transactions.some(
        (row) =>
          row.intPaid !== null &&
          row.intPaid !== undefined &&
          row.intPaid !== ''
      ),
    [transactions]
  );

  // ========================================================================
  // FILTER + SEARCH
  // ========================================================================

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return transactions.filter((row) => {
      // ------------------------------------------------------------
      // STATUS FILTER
      // ------------------------------------------------------------

      if (filterType === 'included' && !row.isValidPayment) {
        return false;
      }

      if (filterType === 'excluded' && row.isValidPayment) {
        return false;
      }

      // ------------------------------------------------------------
      // SEARCH
      // ------------------------------------------------------------

      if (!query) {
        return true;
      }

      return (
        String(row.rowNum ?? '')
          .toLowerCase()
          .includes(query) ||
        String(row.date ?? '')
          .toLowerCase()
          .includes(query) ||
        String(row.particulars ?? '')
          .toLowerCase()
          .includes(query) ||
        String(row.receiptCredit ?? '')
          .toLowerCase()
          .includes(query) ||
        String(row.rawReceiptCredit ?? '')
          .toLowerCase()
          .includes(query) ||
        String(row.paymentDebit ?? '')
          .toLowerCase()
          .includes(query) ||
        String(row.balance ?? '')
          .toLowerCase()
          .includes(query) ||
        String(row.intPaid ?? '')
          .toLowerCase()
          .includes(query)
      );
    });
  }, [transactions, filterType, searchQuery]);

  // ========================================================================
  // PAGINATION
  // ========================================================================

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTransactions.length / pageSize)
  );

  // Keep current page valid when filters/search change.
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;

    return filteredTransactions.slice(
      start,
      start + pageSize
    );
  }, [filteredTransactions, currentPage, pageSize]);

  const firstVisibleRow =
    filteredTransactions.length === 0
      ? 0
      : (currentPage - 1) * pageSize + 1;

  const lastVisibleRow = Math.min(
    currentPage * pageSize,
    filteredTransactions.length
  );

  // ========================================================================
  // HELPERS
  // ========================================================================

  const formatValue = (
    value: string | number | null | undefined
  ) => {
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    if (typeof value === 'number') {
      return formatCurrency(value);
    }

    return String(value);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setFilterType('all');
    setCurrentPage(1);
  };

  // ========================================================================
  // TABLE COLUMN COUNT
  // ========================================================================

  const columnCount =
    4 +
    (hasDebitColumn ? 1 : 0) +
    (hasBalanceColumn ? 1 : 0) +
    (hasIntPaidColumn ? 1 : 0);

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="w-full max-w-6xl mx-auto px-4 mb-10">

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

        {/* ==================================================================
            HEADER
        ================================================================== */}

        <div className="px-5 sm:px-6 pt-6 pb-5 border-b border-gray-200">

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

            {/* TITLE */}

            <div>

              <div className="flex items-center gap-2.5">

                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Table className="w-5 h-5 text-blue-600" />
                </div>

                <div>

                  <div className="flex items-center gap-2 flex-wrap">

                    <h3 className="text-base sm:text-lg font-bold text-gray-900">
                      Ledger Preview
                    </h3>

                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                      <Rows3 className="w-3 h-3" />
                      {transactions.length} rows
                    </span>

                  </div>

                  <p className="text-xs text-gray-500 mt-0.5">
                    Review the transactions detected from your RD ledger.
                  </p>

                </div>

              </div>

            </div>

            {/* SEARCH */}

            <div className="relative w-full lg:w-64">

              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

              <input
                type="text"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search ledger..."
                className="w-full pl-9 pr-3 py-2.5 text-xs rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />

            </div>

          </div>

          {/* ==================================================================
              SUMMARY CARDS
          ================================================================== */}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">

            {/* TOTAL */}

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5">

              <div className="flex items-center justify-between">

                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Total Rows
                </span>

                <Rows3 className="w-4 h-4 text-gray-400" />

              </div>

              <div className="text-xl font-bold font-mono text-gray-900 mt-1">
                {transactions.length}
              </div>

              <p className="text-[11px] text-gray-500 mt-0.5">
                Ledger records detected
              </p>

            </div>

            {/* INCLUDED */}

            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5">

              <div className="flex items-center justify-between">

                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                  Included
                </span>

                <CheckCircle2 className="w-4 h-4 text-blue-600" />

              </div>

              <div className="text-xl font-bold font-mono text-blue-950 mt-1">
                {includedCount}
              </div>

              <p className="text-[11px] text-blue-700 mt-0.5">
                Valid deposit transactions
              </p>

            </div>

            {/* EXCLUDED */}

            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">

              <div className="flex items-center justify-between">

                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                  Excluded
                </span>

                <AlertTriangle className="w-4 h-4 text-amber-600" />

              </div>

              <div className="text-xl font-bold font-mono text-amber-950 mt-1">
                {excludedCount}
              </div>

              <p className="text-[11px] text-amber-700 mt-0.5">
                Summary or ignored rows
              </p>

            </div>

          </div>

          {/* ==================================================================
              FILTER TABS
          ================================================================== */}

          <div className="flex flex-wrap items-center gap-2 mt-5">

            <span className="text-xs font-semibold text-gray-500 mr-1">
              Show:
            </span>

            <button
              type="button"
              onClick={() => {
                setFilterType('all');
                setCurrentPage(1);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                filterType === 'all'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              All
              <span className="opacity-75">
                ({transactions.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFilterType('included');
                setCurrentPage(1);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                filterType === 'included'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Included
              <span className="opacity-75">
                ({includedCount})
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFilterType('excluded');
                setCurrentPage(1);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                filterType === 'excluded'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Excluded
              <span className="opacity-75">
                ({excludedCount})
              </span>
            </button>

            {(searchQuery || filterType !== 'all') && (
              <button
                type="button"
                onClick={resetFilters}
                className="ml-auto text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
              >
                Clear filters
              </button>
            )}

          </div>

        </div>

        {/* ==================================================================
            INFORMATION BAR
        ================================================================== */}

        <div className="px-5 sm:px-6 py-3 bg-blue-50/50 border-b border-blue-100">

          <div className="flex items-start gap-2">

            <FileSpreadsheet className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />

            <p className="text-[11px] sm:text-xs text-blue-800 leading-relaxed">
              <span className="font-semibold">
                Calculation note:
              </span>{' '}
              Only transactions marked as{' '}
              <span className="font-semibold">
                Included
              </span>{' '}
              are used for the RD calculation. Summary and ignored rows are
              excluded to prevent double counting.
            </p>

          </div>

        </div>

        {/* ==================================================================
            TABLE
        ================================================================== */}

        <div className="overflow-x-auto max-h-[520px]">

          <table className="min-w-full text-left text-xs border-collapse">

            {/* TABLE HEADER */}

            <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">

              <tr>

                <th className="py-3 px-3.5 font-bold text-gray-500 uppercase tracking-wider w-12 whitespace-nowrap">
                  #
                </th>

                <th className="py-3 px-3.5 font-bold text-gray-600 uppercase tracking-wider w-32 whitespace-nowrap">
                  Status
                </th>

                <th className="py-3 px-3.5 font-bold text-gray-700 uppercase tracking-wider w-32 whitespace-nowrap">
                  Date
                </th>

                <th className="py-3 px-3.5 font-bold text-gray-700 uppercase tracking-wider min-w-[260px]">
                  Particulars
                </th>

                {hasDebitColumn && (
                  <th className="py-3 px-3.5 font-bold text-gray-700 uppercase tracking-wider text-right w-32 whitespace-nowrap">
                    Payment / Debit
                  </th>
                )}

                <th className="py-3 px-3.5 font-bold uppercase tracking-wider text-right w-40 bg-blue-50 text-blue-900 border-x border-blue-100 whitespace-nowrap">

                  <div className="flex flex-col items-end">

                    <span>
                      Receipt / Credit
                    </span>

                    <span className="text-[9px] font-medium text-blue-600 normal-case tracking-normal mt-0.5">
                      Used for deposit total
                    </span>

                  </div>

                </th>

                {hasBalanceColumn && (
                  <th className="py-3 px-3.5 font-bold text-gray-700 uppercase tracking-wider text-right w-32 whitespace-nowrap">
                    Balance
                  </th>
                )}

                {hasIntPaidColumn && (
                  <th className="py-3 px-3.5 font-bold text-gray-700 uppercase tracking-wider text-right w-28 whitespace-nowrap">
                    Int. Paid
                  </th>
                )}

              </tr>

            </thead>

            {/* TABLE BODY */}

            <tbody className="divide-y divide-gray-100">

              {paginatedRows.length === 0 ? (

                <tr>

                  <td
                    colSpan={columnCount}
                    className="py-16 text-center"
                  >

                    <div className="flex flex-col items-center justify-center">

                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">

                        <Search className="w-5 h-5 text-gray-400" />

                      </div>

                      <p className="text-sm font-semibold text-gray-700">
                        No ledger records found
                      </p>

                      <p className="text-xs text-gray-500 mt-1">
                        Try changing the search text or filter.
                      </p>

                      {(searchQuery || filterType !== 'all') && (
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          Clear filters
                        </button>
                      )}

                    </div>

                  </td>

                </tr>

              ) : (

                paginatedRows.map((row) => (

                  <tr
                    key={row.rowNum}
                    className={`transition-colors ${
                      row.isSummaryRow
                        ? 'bg-amber-50/50 hover:bg-amber-50'
                        : !row.isValidPayment
                        ? 'bg-gray-50/50 hover:bg-gray-50'
                        : 'hover:bg-blue-50/30'
                    }`}
                  >

                    {/* ROW NUMBER */}

                    <td className="py-3 px-3.5 font-mono text-gray-400 whitespace-nowrap">
                      {row.rowNum}
                    </td>

                    {/* STATUS */}

                    <td className="py-3 px-3.5 whitespace-nowrap">

                      {row.isValidPayment ? (

                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">

                          <CheckCircle2 className="w-3 h-3" />

                          Included

                        </span>

                      ) : row.isSummaryRow ? (

                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">

                          <AlertTriangle className="w-3 h-3" />

                          Summary

                        </span>

                      ) : (

                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold bg-gray-100 text-gray-500 border border-gray-200">

                          <XCircle className="w-3 h-3" />

                          Ignored

                        </span>

                      )}

                    </td>

                    {/* DATE */}

                    <td className="py-3 px-3.5 whitespace-nowrap text-gray-700 font-medium">

                      {row.date || '-'}

                    </td>

                    {/* PARTICULARS */}

                    <td
                      className="py-3 px-3.5 text-gray-800 font-medium max-w-md truncate"
                      title={row.particulars || '-'}
                    >
                      {row.particulars || '-'}
                    </td>

                    {/* DEBIT */}

                    {hasDebitColumn && (

                      <td className="py-3 px-3.5 text-right font-mono text-gray-600 whitespace-nowrap">

                        {formatValue(row.paymentDebit)}

                      </td>

                    )}

                    {/* RECEIPT / CREDIT */}

                    <td className="py-3 px-3.5 text-right bg-blue-50/20 border-x border-blue-100/60 whitespace-nowrap">

                      {row.receiptCredit !== null &&
                      row.receiptCredit !== undefined ? (

                        <span
                          className={`inline-flex items-center gap-1 font-mono ${
                            row.isValidPayment
                              ? 'text-blue-700 font-bold'
                              : 'text-gray-500 font-semibold'
                          }`}
                        >
                          <CreditCard className="w-3 h-3 opacity-60" />
                          {formatCurrency(row.receiptCredit)}
                        </span>

                      ) : (

                        <span className="font-mono text-gray-400 italic">

                          {row.rawReceiptCredit !== undefined &&
                          row.rawReceiptCredit !== ''
                            ? String(row.rawReceiptCredit)
                            : '-'}

                        </span>

                      )}

                    </td>

                    {/* BALANCE */}

                    {hasBalanceColumn && (

                      <td className="py-3 px-3.5 text-right font-mono text-gray-700 whitespace-nowrap">

                        {formatValue(row.balance)}

                      </td>

                    )}

                    {/* INTEREST PAID */}

                    {hasIntPaidColumn && (

                      <td className="py-3 px-3.5 text-right font-mono text-gray-600 whitespace-nowrap">

                        {formatValue(row.intPaid)}

                      </td>

                    )}

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

        {/* ==================================================================
            PAGINATION FOOTER
        ================================================================== */}

        <div className="px-5 sm:px-6 py-4 border-t border-gray-200 bg-gray-50/70">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            {/* LEFT */}

            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">

              <span className="font-medium">
                Rows per page:
              </span>

              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>

              <span className="text-gray-500">
                Showing{' '}
                <span className="font-semibold text-gray-700">
                  {firstVisibleRow}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-gray-700">
                  {lastVisibleRow}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-gray-700">
                  {filteredTransactions.length}
                </span>
              </span>

            </div>

            {/* RIGHT */}

            <div className="flex items-center gap-2">

              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.max(1, page - 1)
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>

              <span className="px-2 text-xs font-semibold text-gray-600 whitespace-nowrap">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.min(totalPages, page + 1)
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
};