import * as XLSX from 'xlsx';
import { RDAccountData } from '../types';
import { parseDateFlexible } from './imageParser';

/**
 * Creates a valid Excel File representing 56d9d7d1-6694-482c-a46f-f5ae59e7f371.xlsx
 * Uses worksheet named "DepositPersonalLedgerRD"
 * Columns: Date, Particulars, Payment/Debit, Receipt/Credit, Balance, Int Paid
 * Total Paid = ₹9,200
 */
export function create56d9d7d1LedgerFile(): File {
  const wsData = [
    ['PERSONAL LEDGER (RD)', '', '', '', '', ''],
    ['Customer Name:', 'Rahul Sharma', '', 'A/c No:', 'RD-2024-5691', ''],
    ['A/c Opening Date:', '01/01/2024', '', 'Period:', '12 Months', ''],
    ['Interest Rate:', '12%', '', 'Status:', 'Active', ''],
    ['', '', '', '', '', ''],
    ['Date', 'Particulars', 'Payment/Debit', 'Receipt/Credit', 'Balance', 'Int Paid'],
    ['05/01/2024', 'By Cash Deposit', '', 2000, 2000, ''],
    ['08/02/2024', 'By Cash Deposit', '', 2000, 4000, ''],
    ['12/03/2024', 'By Online Transfer', '', 2500, 6500, ''],
    ['15/04/2024', 'By Cash Deposit', '', 2700, 9200, ''],
    ['', 'Total / Closing Balance', '', 9200, 9200, ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DepositPersonalLedgerRD');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return new File([blob], '56d9d7d1-6694-482c-a46f-f5ae59e7f371.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    lastModified: Date.now(),
  });
}

/**
 * Creates a valid Excel File representing LEDGER DEMO(1).xlsx
 * Uses worksheet named "DepositPersonalLedgerRD"
 * Columns: Date, Particulars, Payment/Debit, Receipt/Credit, Balance, Int Paid
 * Total Paid = ₹9,200
 */
export function createLedgerDemo1File(): File {
  const wsData = [
    ['PERSONAL LEDGER (RD)', '', '', '', '', ''],
    ['Customer Name:', 'Demo Customer', '', 'A/c No:', 'RD-2024-9981', ''],
    ['A/c Opening Date:', '01/01/2024', '', 'Period:', '12 Months', ''],
    ['Interest Rate:', '12%', '', 'Status:', 'Active', ''],
    ['', '', '', '', '', ''],
    ['Date', 'Particulars', 'Payment/Debit', 'Receipt/Credit', 'Balance', 'Int Paid'],
    ['01/01/2024', 'By Cash Deposit', '', 2000, 2000, ''],
    ['01/02/2024', 'By Cash Deposit', '', 2000, 4000, ''],
    ['01/03/2024', 'By Cash Deposit', '', 2500, 6500, ''],
    ['01/04/2024', 'By Cash Deposit', '', 2700, 9200, ''],
    ['', 'Total / Closing Balance', '', 9200, 9200, ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DepositPersonalLedgerRD');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return new File([blob], 'LEDGER DEMO(1).xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    lastModified: Date.now(),
  });
}

/**
 * Creates a valid Excel File with an arbitrary/variable number of transaction rows
 * (e.g. 100, 500, 1000, 5000 transactions) to test unlimited row parsing.
 */
export function createVariableRowsLedgerFile(
  numTransactions: number = 500,
  depositPerTx: number = 100
): File {
  const wsData: any[][] = [
    ['PERSONAL LEDGER (RD)', '', '', '', '', ''],
    ['Customer Name:', `Customer with ${numTransactions} Txns`, '', 'A/c No:', `RD-VAR-${numTransactions}`, ''],
    ['A/c Opening Date:', '01/01/2023', '', 'Period:', '36 Months', ''],
    ['Interest Rate:', '12%', '', 'Status:', 'Active', ''],
    ['', '', '', '', '', ''],
    ['Date', 'Particulars', 'Payment/Debit', 'Receipt/Credit', 'Balance', 'Int Paid'],
  ];

  let runningBalance = 0;
  const startDate = new Date(2023, 0, 1);

  for (let i = 1; i <= numTransactions; i++) {
    const curDate = new Date(startDate.getTime() + (i - 1) * 24 * 60 * 60 * 1000);
    const dateStr = curDate.toLocaleDateString('en-GB'); // DD/MM/YYYY
    runningBalance += depositPerTx;
    wsData.push([
      dateStr,
      `Daily Deposit #${i}`,
      '',
      depositPerTx,
      runningBalance,
      '',
    ]);
  }

  // Add final summary row with cumulative total
  wsData.push([
    '',
    'Total / Closing Balance',
    '',
    runningBalance,
    runningBalance,
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DepositPersonalLedgerRD');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return new File([blob], `LEDGER_${numTransactions}_ROWS.xlsx`, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    lastModified: Date.now(),
  });
}

/**
 * Backward compatibility helper
 */
export function createLedgerDemoFile(): File {
  return createLedgerDemo1File();
}

/**
 * Creates Account Data matching Reference Document 1:
 * NITC INDIA LTD. Daily RD (RCD)
 * Member Name: TA DASAN
 * Scheme: RCD
 * Scheme amount: 100
 * Period: 365 DAYS
 * Bond Date: 19-09-2025
 * Date of Maturity: 19-09-2026
 * Total Amount: 19900
 * 13 payments
 */
export function createNitcDailyRCDAccountData(): RDAccountData {
  const paymentData = [
    { slNo: 1, date: '29-09-2025', amount: 1200, receiptNo: 'RCP-101' },
    { slNo: 2, date: '30-10-2025', amount: 2100, receiptNo: 'RCP-102' },
    { slNo: 3, date: '19-11-2025', amount: 2900, receiptNo: 'RCP-103' },
    { slNo: 4, date: '31-12-2025', amount: 2100, receiptNo: 'RCP-104' },
    { slNo: 5, date: '29-01-2026', amount: 1300, receiptNo: 'RCP-105' },
    { slNo: 6, date: '28-02-2026', amount: 2800, receiptNo: 'RCP-106' },
    { slNo: 7, date: '31-03-2026', amount: 2500, receiptNo: 'RCP-107' },
    { slNo: 8, date: '30-04-2026', amount: 1300, receiptNo: 'RCP-108' },
    { slNo: 9, date: '26-05-2026', amount: 1700, receiptNo: 'RCP-109' },
    { slNo: 10, date: '17-06-2026', amount: 500, receiptNo: 'RCP-110' },
    { slNo: 11, date: '18-07-2026', amount: 500, receiptNo: 'RCP-111' },
    { slNo: 12, date: '05-08-2026', amount: 500, receiptNo: 'RCP-112' },
    { slNo: 13, date: '02-09-2026', amount: 500, receiptNo: 'RCP-113' },
  ];

  let runningBalance = 0;
  const transactions = paymentData.map((p) => {
    runningBalance += p.amount;
    const dateObj = parseDateFlexible(p.date);
    return {
      rowNum: p.slNo,
      date: p.date.replace(/-/g, '/'),
      depositDateObj: dateObj,
      particulars: `Installment #${p.slNo} (Receipt: ${p.receiptNo})`,
      paymentDebit: null,
      receiptCredit: p.amount,
      rawReceiptCredit: p.amount,
      balance: runningBalance,
      intPaid: null,
      isSummaryRow: false,
      isValidPayment: true,
    };
  });

  return {
    fileName: 'NITC_RCD_Daily_RD_Sample.jpg',
    fileSize: 245000,
    sheetName: 'NITC INDIA LTD. Preclose Template',
    customerName: 'TA DASAN',
    accountNumber: 'NITC-RCD-7819',
    rdType: 'Daily RD',
    openingDate: '19/09/2025',
    maturityDate: '19/09/2026',
    interestRate: '12%',
    annualRate: 0.12,
    selectedInterestRate: 12,
    status: 'Active',
    period: '365 DAYS',
    tenureDays: 365,
    transactions,
    totalDeposited: 19900,
    dailySchemeAmount: 100, // CRITICAL: Scheme amount 100, NOT minimum transaction amount!
    profitEligibleAmount: 19900,
    nonProfitAmount: 0,
    normalizedDailyAmount: 19900 / 365,
    totalInterest: 0,
    maturityAmount: 19900,
    validTransactionCount: 13,
    hasSummaryRow: true,
    returnRate: 12,
    returnAmount: 0,
    isNitcTemplate: true,
    schemeCode: 'RCD',
    schemeAmount: 100,
    branch: 'MAIN BRANCH',
  };
}

/**
 * Creates Account Data matching Reference Document 2:
 * NITC INDIA LTD. Monthly RD (RCM)
 * Member Name: SRUTHI SREENIVASAN P
 * Scheme: RCM
 * Scheme amount: 3000
 * Period: 12 MONTHS
 * Bond Date: 22-09-2025
 * Date of Maturity: 22-09-2026
 * Total Amount: 36000
 * 12 payments
 */
export function createNitcMonthlyRCMAccountData(): RDAccountData {
  const paymentData = [
    { slNo: 1, date: '22-09-2025', amount: 3000, receiptNo: 'RCP-201' },
    { slNo: 2, date: '23-10-2025', amount: 3000, receiptNo: 'RCP-202' },
    { slNo: 3, date: '29-11-2025', amount: 3000, receiptNo: 'RCP-203' },
    { slNo: 4, date: '27-12-2025', amount: 3000, receiptNo: 'RCP-204' },
    { slNo: 5, date: '30-01-2026', amount: 3000, receiptNo: 'RCP-205' },
    { slNo: 6, date: '13-03-2026', amount: 3000, receiptNo: 'RCP-206' },
    { slNo: 7, date: '22-04-2026', amount: 3000, receiptNo: 'RCP-207' },
    { slNo: 8, date: '05-06-2026', amount: 3000, receiptNo: 'RCP-208' },
    { slNo: 9, date: '25-07-2026', amount: 3000, receiptNo: 'RCP-209' },
    { slNo: 10, date: '17-08-2026', amount: 3000, receiptNo: 'RCP-210' },
    { slNo: 11, date: '04-09-2026', amount: 3000, receiptNo: 'RCP-211' },
    { slNo: 12, date: '11-09-2026', amount: 3000, receiptNo: 'RCP-212' },
  ];

  let runningBalance = 0;
  const transactions = paymentData.map((p) => {
    runningBalance += p.amount;
    const dateObj = parseDateFlexible(p.date);
    return {
      rowNum: p.slNo,
      date: p.date.replace(/-/g, '/'),
      depositDateObj: dateObj,
      particulars: `Installment #${p.slNo} (Receipt: ${p.receiptNo})`,
      paymentDebit: null,
      receiptCredit: p.amount,
      rawReceiptCredit: p.amount,
      balance: runningBalance,
      intPaid: null,
      isSummaryRow: false,
      isValidPayment: true,
    };
  });

  return {
    fileName: 'NITC_RCM_Monthly_RD_Sample.jpg',
    fileSize: 260000,
    sheetName: 'NITC INDIA LTD. Preclose Template',
    customerName: 'SRUTHI SREENIVASAN P',
    accountNumber: 'NITC-RCM-9042',
    rdType: 'Monthly RD',
    openingDate: '22/09/2025',
    maturityDate: '22/09/2026',
    interestRate: '12%',
    annualRate: 0.12,
    selectedInterestRate: 12,
    status: 'Active',
    period: '12 MONTHS',
    tenureDays: 365,
    transactions,
    totalDeposited: 36000,
    dailySchemeAmount: 0,
    profitEligibleAmount: 36000,
    nonProfitAmount: 0,
    normalizedDailyAmount: 0,
    totalInterest: 0,
    maturityAmount: 36000,
    validTransactionCount: 12,
    hasSummaryRow: true,
    returnRate: 12,
    returnAmount: 0,
    isNitcTemplate: true,
    schemeCode: 'RCM',
    schemeAmount: 3000,
    branch: 'MAIN BRANCH',
  };
}
