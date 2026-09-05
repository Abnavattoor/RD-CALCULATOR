export type RDType = 'Daily RD' | 'Monthly RD' | 'Recurring Deposit (RD)' | string;

export interface LedgerTransactionRow {
  rowNum: number;
  date: string;
  depositDateObj?: Date | null;
  particulars: string;
  paymentDebit?: string | number | null;
  receiptCredit: number | null;
  rawReceiptCredit: any;
  balance?: string | number | null;
  intPaid?: string | number | null;
  isSummaryRow: boolean;
  isValidPayment: boolean;
}

export interface RDAccountData {
  fileName: string;
  fileSize: number;
  sheetName: string;
  customerName: string;
  accountNumber: string;
  rdType: RDType;
  openingDate?: string;
  maturityDate?: string;
  interestRate?: string;
  annualRate: number;
  status?: string;
  period?: string;
  tenureDays?: number;
  transactions: LedgerTransactionRow[];
  totalDeposited: number;
  normalizedDailyAmount: number;
  totalInterest: number;
  maturityAmount: number;
  validTransactionCount: number;
  hasSummaryRow: boolean;
  // Aliases for compatibility
  returnRate?: number;
  returnAmount?: number;
}

export interface RDParseError {
  title: string;
  message: string;
}
