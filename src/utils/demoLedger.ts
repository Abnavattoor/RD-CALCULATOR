import * as XLSX from 'xlsx';

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
