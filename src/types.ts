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
  isClosureRow?: boolean;
  isOverTenure?: boolean;
  installmentAllocationCount?: number;
  type?: string;
  transactionType?: string;
  amount?: number;
  receiptNumber?: string;
  rowPageRef?: string;
  validationStatus?: 'Valid' | 'Uncertain' | 'Excluded';
  originalValues?: Record<string, any>;
  uncertainFieldWarnings?: string[];
}

export interface MonthlyRDInstallmentPeriod {
  installmentNumber: number;
  monthIndex: number; // 1 to N
  dueDate: string;
  expectedAmount: number;
  allocatedAmount: number;
  paymentDate?: string;
  status: 'on-time' | 'overdue' | 'missed' | 'advance';
  openingBalance: number;
  periodInterest: number;
  closingBalance: number;
}

export interface MonthlyRDCalculationLog {
  tenureMonths: number;
  monthlyInstallment: number;
  annualRate: number;
  monthlyRate: number;
  totalDeposited: number;
  profitEligiblePrincipal: number;
  nonProfitPrincipal: number;
  installmentsDue: number;
  installmentsPaid: number;
  combinedPaymentsDetected: number;
  periods: MonthlyRDInstallmentPeriod[];
  rawFinalBalance: number;
  calculatedMaturityAmount: number;
  calculatedTotalInterest: number;
  recordedInterestInLedger?: number | null;
  interestVariance?: number;
  closureDate?: string;
  closureAmount?: number;
  diagnosticNotes: string[];
}

export interface MaturityRolloverDetails {
  originalPrincipal: number;
  originalInterest: number;
  originalMaturityAmount: number;
  subsequentTenureMonths: number;
  monthlyCalculationBase: number; // originalMaturityAmount / subsequentTenureMonths
  annualInterestRate: number;
  subsequentTotalInterest: number;
  subsequentMaturityAmount: number;
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

  // Monthly RD Actual Ledger analysis and tracking
  installmentsDue?: number;
  installmentsPaid?: number;
  onTimeInstallmentsCount?: number;
  overdueInstallmentsCount?: number;
  missedInstallmentsCount?: number;
  overTenureDepositsCount?: number;
  recordedInterestPaid?: number | null;
  closureDate?: string;
  closureAmount?: number;
  installmentSchedule?: MonthlyRDInstallmentPeriod[];
  intermediateCalculationLog?: MonthlyRDCalculationLog;
  rolloverCalculation?: MaturityRolloverDetails;

  // NITC Preclose/Premature template metadata
  isNitcTemplate?: boolean;
  schemeCode?: string;
  schemeAmount?: number;
  branch?: string;
  branchCode?: string;
  preClosureCharges?: number;
  netPayment?: number;
  missingFieldsWarning?: string;

  // Document classification & verification metadata
  documentCategory?:
    | 'Personal RD Ledger'
    | 'Branch Day Sheet'
    | 'Customer Transaction Statement'
    | 'Scanned Personal Ledger'
    | 'Scanned Day Sheet'
    | string;
  documentFormat?: 'Excel' | 'PDF' | 'Image';
  extractionWarnings?: string[];
  rawExtractionConfidence?: number;
  configuredDailyInstallment?: number;

  // Day Sheet fields
  isDaySheet?: boolean;
  daySheetCustomers?: DaySheetCustomer[];
  selectedCustomerKey?: string;
  rawDaySheetCustomersData?: Record<string, any>;

  // Daily RD 90-day non-profit adjustment breakdown
  dailyRDAdjustment?: DailyRD90DayAdjustmentDetails;
  final90DayCollectionCount?: number;
  actualFinal90DayDeposits?: number;
  required90DayAmount?: number;
  nonProfitAmountA?: number;
  adjustedPrincipalX?: number;
  calculationResultY?: number;
  roundedY?: number;
  postMaturityDeposits?: number;
}

export interface DailyRD90DayAdjustmentDetails {
  totalActualDeposits: number;
  depositsDuringRDPeriod?: number;
  postMaturityDeposits?: number;
  final90DayCollectionCount: number;
  actualFinal90DayDeposits: number;
  required90DayAmount: number;
  nonProfitAmountA: number; // A
  adjustedPrincipalX: number; // X
  calculationResultY: number; // unrounded Y (e.g. 31337.55)
  roundedY: number; // Rounded Y (e.g. 31338)
  finalMaturityAmount: number; // Rounded Y + A (e.g. 38338)
  totalInterest: number; // Interest portion (e.g. 1838)
  dailyInstallment: number;
  firstInstallmentDate?: string;
  maturityDate?: string;
  periodStartDate?: string;
}

export interface DaySheetCustomer {
  customerName: string;
  membershipId: string;
  bondNumber: string;
  transactionCount: number;
  totalDeposited: number;
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