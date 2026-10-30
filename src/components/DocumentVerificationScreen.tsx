/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  RDAccountData,
  LedgerTransactionRow,
  DaySheetCustomer,
} from '../types';
import {
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  Trash2,
  Plus,
  ArrowRight,
  RotateCcw,
  User,
  Hash,
  Calendar,
  Coins,
  ShieldCheck,
  Check,
  X,
  Users,
} from 'lucide-react';

interface DocumentVerificationScreenProps {
  data: RDAccountData;
  contractualDailyInstallment: number;
  onConfirmAndCalculate: (verifiedData: RDAccountData, updatedInstallment: number) => void;
  onSelectCustomer?: (customerKey: string) => void;
  onCancel: () => void;
}

export const DocumentVerificationScreen: React.FC<DocumentVerificationScreenProps> = ({
  data,
  contractualDailyInstallment,
  onConfirmAndCalculate,
  onSelectCustomer,
  onCancel,
}) => {
  // Top-level editable metadata
  const [customerName, setCustomerName] = useState(data.customerName || 'Not Specified');
  const [accountNumber, setAccountNumber] = useState(data.accountNumber || 'Not Specified');
  const [openingDate, setOpeningDate] = useState(data.openingDate || '');
  const [maturityDate, setMaturityDate] = useState(data.maturityDate || '');
  const [dailyInstallment, setDailyInstallment] = useState<number>(contractualDailyInstallment || 100);

  // Transactions state
  const [transactions, setTransactions] = useState<LedgerTransactionRow[]>(
    data.transactions ? [...data.transactions] : []
  );

  // Row inline edit state
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editAmount, setEditAmount] = useState<string>('');
  const [editParticulars, setEditParticulars] = useState<string>('');
  const [editReceiptNo, setEditReceiptNo] = useState<string>('');

  // Add Row modal/form state
  const [isAddingRow, setIsAddingRow] = useState<boolean>(false);
  const [newDate, setNewDate] = useState<string>('');
  const [newAmount, setNewAmount] = useState<string>('');
  const [newParticulars, setNewParticulars] = useState<string>('Daily RD Collection');
  const [newReceiptNo, setNewReceiptNo] = useState<string>('');

  // Compute live total deposits from transactions
  const totalDeposits = transactions
    .filter((t) => t.isValidPayment && !t.isSummaryRow && !t.isClosureRow && t.receiptCredit !== null)
    .reduce((sum, t) => sum + (Number(t.receiptCredit) || 0), 0);

  const roundedTotalDeposits = Math.round((totalDeposits + Number.EPSILON) * 100) / 100;
  const validTxnCount = transactions.filter((t) => t.isValidPayment && !t.isSummaryRow).length;

  const startEditRow = (index: number) => {
    const t = transactions[index];
    setEditingRowIndex(index);
    setEditDate(t.date || '');
    setEditAmount(String(t.receiptCredit || ''));
    setEditParticulars(t.particulars || '');
    setEditReceiptNo(t.receiptNumber || '');
  };

  const saveEditRow = () => {
    if (editingRowIndex === null) return;
    const numAmt = parseFloat(editAmount);
    const updated = [...transactions];
    const original = updated[editingRowIndex];

    updated[editingRowIndex] = {
      ...original,
      date: editDate.trim(),
      receiptCredit: !isNaN(numAmt) ? numAmt : original.receiptCredit,
      amount: !isNaN(numAmt) ? numAmt : original.amount,
      particulars: editParticulars.trim(),
      receiptNumber: editReceiptNo.trim(),
      validationStatus: !isNaN(numAmt) && numAmt > 0 ? 'Valid' : 'Uncertain',
    };

    setTransactions(updated);
    setEditingRowIndex(null);
  };

  const cancelEditRow = () => {
    setEditingRowIndex(null);
  };

  const toggleRowExcluded = (index: number) => {
    const updated = [...transactions];
    const t = updated[index];
    const newStatus = t.validationStatus === 'Excluded' ? 'Valid' : 'Excluded';
    updated[index] = {
      ...t,
      isValidPayment: newStatus === 'Valid',
      validationStatus: newStatus,
    };
    setTransactions(updated);
  };

  const handleDeleteRow = (index: number) => {
    const updated = transactions.filter((_, idx) => idx !== index);
    setTransactions(updated);
  };

  const handleAddRow = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(newAmount);
    if (isNaN(num) || num <= 0) return;

    const newTx: LedgerTransactionRow = {
      rowNum: transactions.length + 1,
      rowPageRef: `Manual #${transactions.length + 1}`,
      date: newDate.trim(),
      particulars: newParticulars.trim() || 'Manual Collection Entry',
      receiptCredit: num,
      rawReceiptCredit: num,
      amount: num,
      receiptNumber: newReceiptNo.trim(),
      isSummaryRow: false,
      isValidPayment: true,
      validationStatus: 'Valid',
      type: 'COLLECTION',
      transactionType: 'COLLECTION',
    };

    setTransactions([...transactions, newTx]);
    setIsAddingRow(false);
    setNewDate('');
    setNewAmount('');
    setNewParticulars('Daily RD Collection');
    setNewReceiptNo('');
  };

  const handleConfirm = () => {
    const verifiedData: RDAccountData = {
      ...data,
      customerName: customerName.trim(),
      accountNumber: accountNumber.trim(),
      openingDate: openingDate.trim(),
      maturityDate: maturityDate.trim(),
      transactions,
      totalDeposited: roundedTotalDeposits,
      validTransactionCount: validTxnCount,
      configuredDailyInstallment: dailyInstallment,
    };

    onConfirmAndCalculate(verifiedData, dailyInstallment);
  };

  // Determine format icon
  const formatIcon =
    data.documentFormat === 'PDF' ? (
      <FileText className="w-5 h-5 text-rose-600" />
    ) : data.documentFormat === 'Image' ? (
      <ImageIcon className="w-5 h-5 text-indigo-600" />
    ) : (
      <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
    );

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xs mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-xs font-bold text-blue-700 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Document Data Extracted • Review & Verify</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Verify Document Information
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Review extracted customer and transaction details before proceeding to the final calculation. You can correct any OCR typos or adjust values below.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-center shrink-0">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700">
              {formatIcon}
              <span>{data.documentCategory || 'Personal RD Ledger'}</span>
              <span className="text-gray-300">•</span>
              <span className="text-gray-500">{data.fileName}</span>
            </div>
          </div>
        </div>

        {/* Multi-Customer Day Sheet Selector */}
        {data.daySheetCustomers && data.daySheetCustomers.length > 1 && onSelectCustomer && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-700">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Branch Day Sheet: {data.daySheetCustomers.length} Customers Detected</span>
              </div>
              <span className="text-xs text-gray-500">Select target customer from sheet:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {data.daySheetCustomers.map((c: DaySheetCustomer) => {
                const isSelected =
                  c.customerName === customerName ||
                  c.bondNumber === accountNumber ||
                  c.customerName === data.customerName;
                return (
                  <button
                    key={`${c.customerName}-${c.bondNumber}`}
                    type="button"
                    onClick={() => onSelectCustomer(c.bondNumber || c.customerName)}
                    className={`text-left p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 font-bold text-blue-900 ring-2 ring-blue-100'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-bold text-sm truncate">{c.customerName}</div>
                    <div className="text-[11px] text-gray-500 flex items-center justify-between mt-1">
                      <span>Bond: {c.bondNumber || 'N/A'}</span>
                      <span className="font-semibold text-gray-700">₹{c.totalDeposited.toLocaleString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Warnings & Notices */}
      {data.extractionWarnings && data.extractionWarnings.length > 0 && (
        <div className="mb-8 rounded-2xl bg-amber-50 border border-amber-200 p-4.5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <h4 className="font-bold text-amber-950 text-sm mb-1">Extraction Notices</h4>
              <ul className="list-disc list-inside space-y-0.5">
                {data.extractionWarnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Customer & Account Details Card (Editable) */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xs mb-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            <span>Account & Scheme Details</span>
          </h2>
          <span className="text-xs text-gray-400 font-medium">Fields are editable before calculating</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Customer Name */}
          <div className="rounded-2xl border border-gray-200 p-3.5 bg-gray-50/50">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              Customer Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Account / Bond Number */}
          <div className="rounded-2xl border border-gray-200 p-3.5 bg-gray-50/50">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              Account / Bond Number
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* First Installment / Opening Date */}
          <div className="rounded-2xl border border-gray-200 p-3.5 bg-gray-50/50">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              Opening / First Deposit Date
            </label>
            <input
              type="text"
              value={openingDate}
              onChange={(e) => setOpeningDate(e.target.value)}
              placeholder="DD/MM/YYYY"
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Maturity Date */}
          <div className="rounded-2xl border border-gray-200 p-3.5 bg-gray-50/50">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              Maturity Date
            </label>
            <input
              type="text"
              value={maturityDate}
              onChange={(e) => setMaturityDate(e.target.value)}
              placeholder="DD/MM/YYYY"
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Daily RD Specific Contractual Installment Confirmation */}
        {data.rdType === 'Daily RD' && (
          <div className="mt-5 p-4 rounded-2xl bg-blue-50/60 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-600 text-white shrink-0">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-blue-900">Contractual Daily Installment</div>
                <div className="text-[11px] text-blue-700">
                  Required 90-day amount = ₹{dailyInstallment.toLocaleString()} × 90 ={' '}
                  <span className="font-extrabold text-blue-900">
                    ₹{(dailyInstallment * 90).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="text-xs font-bold text-blue-800">₹</span>
              <input
                type="number"
                min="1"
                step="1"
                value={dailyInstallment}
                onChange={(e) => setDailyInstallment(Math.max(1, parseFloat(e.target.value) || 100))}
                className="w-24 bg-white border border-blue-200 rounded-xl px-3 py-1.5 text-sm font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-blue-700">/ day</span>
            </div>
          </div>
        )}

        {/* Summary Metric Counters */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-gray-100">
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-400">Total Actual Deposits</div>
            <div className="text-lg font-extrabold text-gray-900">₹{roundedTotalDeposits.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-400">Valid Transactions</div>
            <div className="text-lg font-extrabold text-emerald-600">{validTxnCount} collections</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-400">RD Product</div>
            <div className="text-lg font-extrabold text-blue-600">{data.rdType || 'Daily RD'}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-400">Tenure Duration</div>
            <div className="text-lg font-extrabold text-gray-900">{data.period || `${data.tenureDays || 365} Days`}</div>
          </div>
        </div>
      </div>

      {/* Extracted Transactions Table */}
      <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-xs mb-8">
        <div className="p-6 sm:p-7 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Extracted Transactions ({transactions.length} rows)
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Every individual collection has been captured. Click &apos;Edit&apos; to correct any uncertain OCR values.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsAddingRow(!isAddingRow)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs font-bold text-gray-700 transition-colors self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600" />
            <span>Add Transaction</span>
          </button>
        </div>

        {/* Add Row Panel */}
        {isAddingRow && (
          <form onSubmit={handleAddRow} className="p-4 bg-blue-50/50 border-b border-blue-100">
            <div className="text-xs font-bold text-blue-900 mb-2">Add Missing Transaction</div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3">
              <input
                type="text"
                placeholder="Date (DD/MM/YYYY)"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                required
                className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Deposit Amount (₹)"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                required
                className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Particulars / Scheme"
                value={newParticulars}
                onChange={(e) => setNewParticulars(e.target.value)}
                className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Receipt / Voucher No"
                value={newReceiptNo}
                onChange={(e) => setNewReceiptNo(e.target.value)}
                className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddingRow(false)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
              >
                Add Row
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50/80 sticky top-0 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3 px-4">Ref</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Particulars</th>
                <th className="py-3 px-4">Receipt (₹)</th>
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {transactions.map((tx, idx) => {
                const isEditing = editingRowIndex === idx;
                const isExcluded = tx.validationStatus === 'Excluded' || !tx.isValidPayment;

                if (isEditing) {
                  return (
                    <tr key={idx} className="bg-blue-50/40">
                      <td className="py-2.5 px-4 font-mono text-gray-400">#{idx + 1}</td>
                      <td className="py-2.5 px-4">
                        <input
                          type="text"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="w-28 bg-white border border-blue-300 rounded-lg px-2 py-1 text-xs font-bold"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="text"
                          value={editParticulars}
                          onChange={(e) => setEditParticulars(e.target.value)}
                          className="w-full bg-white border border-blue-300 rounded-lg px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="number"
                          step="0.01"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-24 bg-white border border-blue-300 rounded-lg px-2 py-1 text-xs font-bold"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="text"
                          value={editReceiptNo}
                          onChange={(e) => setEditReceiptNo(e.target.value)}
                          className="w-20 bg-white border border-blue-300 rounded-lg px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">Editing</span>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={saveEditRow}
                          className="p-1 rounded text-emerald-600 hover:bg-emerald-50 mr-1"
                          title="Save changes"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditRow}
                          className="p-1 rounded text-gray-400 hover:bg-gray-100"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={idx}
                    className={`transition-colors hover:bg-gray-50/70 ${
                      isExcluded ? 'opacity-50 bg-gray-50/40 line-through' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 font-mono text-[11px] text-gray-400">
                      {tx.rowPageRef || `#${idx + 1}`}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-gray-900 whitespace-nowrap">
                      {tx.date || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 max-w-xs truncate" title={tx.particulars}>
                      {tx.particulars || 'Deposit'}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-gray-900">
                      ₹{(Number(tx.receiptCredit) || 0).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-gray-500 font-mono text-[11px]">
                      {tx.receiptNumber || '—'}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          tx.validationStatus === 'Valid' || (!tx.validationStatus && tx.isValidPayment)
                            ? 'bg-emerald-50 text-emerald-700'
                            : tx.validationStatus === 'Uncertain'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {tx.validationStatus || (tx.isValidPayment ? 'Valid' : 'Excluded')}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => startEditRow(idx)}
                        className="p-1 rounded text-blue-600 hover:bg-blue-50 mr-1"
                        title="Edit row values"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleRowExcluded(idx)}
                        className="p-1 rounded text-amber-600 hover:bg-amber-50 mr-1 text-[11px] font-semibold"
                        title={isExcluded ? 'Include in calculation' : 'Exclude from calculation'}
                      >
                        {isExcluded ? 'Include' : 'Exclude'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(idx)}
                        className="p-1 rounded text-red-500 hover:bg-red-50"
                        title="Delete row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 text-gray-400" />
          <span>Upload Different Document</span>
        </button>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-base font-extrabold shadow-lg shadow-blue-200 transition-all cursor-pointer"
          >
            <span>Confirm & Calculate Maturity</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
