export type RDType =
  | 'Daily RD'
  | 'Monthly RD'
  | 'Recurring Deposit (RD)'
  | string;

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
  selectedInterestRate?: number;
  status?: string;
  period?: string;
  tenureDays?: number;
  transactions: LedgerTransactionRow[];

  totalDeposited: number;

  dailySchemeAmount: number;
  profitEligibleAmount: number;
  nonProfitAmount: number;

  normalizedDailyAmount: number;

  totalInterest: number;
  maturityAmount: number;

  validTransactionCount: number;
  hasSummaryRow: boolean;

  returnRate?: number;
  returnAmount?: number;
}


/*
 * Configuration used by the Daily RD calculation.
 */
export interface DailyRDCalculationConfig {
  dailySchemeAmount: number;

  /*
   * Annual interest rate.
   *
   * Example:
   * 0.12 = 12%
   */
  annualRate: number;

  /*
   * Number of days in the Daily RD scheme.
   */
  tenureDays: number;
}


/*
 * Result returned by the Daily RD calculation engine.
 */
export interface DailyRDCalculationResult {
  totalDeposited: number;

  dailySchemeAmount: number;

  profitEligibleAmount: number;

  nonProfitAmount: number;

  totalInterest: number;

  maturityAmount: number;

  normalizedDailyAmount: number;
}


/*
 * Standard parser error used by the application.
 */
export interface RDParseError {
  title: string;
  message: string;
}