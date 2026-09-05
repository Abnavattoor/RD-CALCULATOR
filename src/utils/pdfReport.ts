import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RDAccountData } from '../types';
import { formatCurrency } from './excelParser';

export const generateRDReport = (data: RDAccountData) => {
  const doc = new jsPDF();

  const accountData = data as any;
  const transactions = accountData.transactions || [];

  const customerName =
    accountData.customerName || 'Not Specified';

  const accountNumber =
    accountData.accountNumber || 'Not Specified';

  const rdType =
    accountData.rdType || 'Recurring Deposit (RD)';

  const openingDate =
    accountData.openingDate || 'Not Specified';

  const maturityDate =
    accountData.maturityDate || 'Not Specified';

  const period =
    accountData.period || 'Not Specified';

  const interestRate =
    typeof accountData.annualRate === 'number'
      ? `${(accountData.annualRate * 100).toFixed(2)}%`
      : 'Not Specified';

  const totalDeposited =
    Number(accountData.totalDeposited || 0);

  const totalInterest =
    Number(accountData.totalInterest || 0);

  const maturityAmount =
    Number(accountData.maturityAmount || 0);

  const isMonthly = rdType === 'Monthly RD';

  // --------------------------------------------------
  // TITLE
  // --------------------------------------------------

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('RD Calculator Report', 105, 20, {
    align: 'center',
  });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Recurring Deposit Calculation Statement',
    105,
    27,
    { align: 'center' }
  );

  // --------------------------------------------------
  // CUSTOMER DETAILS
  // --------------------------------------------------

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Customer & RD Details', 14, 40);

  autoTable(doc, {
    startY: 45,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 55 },
      2: { cellWidth: 45 },
      3: { cellWidth: 45 },
    },
    head: [['Field', 'Value', 'Field', 'Value']],
    body: [
      ['Customer Name', customerName, 'Account Number', accountNumber],
      ['RD Type', rdType, 'Period', period],
      ['Opening Date', openingDate, 'Maturity Date', maturityDate],
      ['Interest Rate', interestRate, 'Transactions', String(accountData.validTransactionCount || transactions.length)],
    ],
  });

  // --------------------------------------------------
  // FINANCIAL SUMMARY
  // --------------------------------------------------

  const financialStartY =
    (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Financial Summary', 14, financialStartY);

  autoTable(doc, {
    startY: financialStartY + 5,
    theme: 'grid',
    styles: {
      fontSize: 10,
      cellPadding: 4,
    },
    headStyles: {
      fontStyle: 'bold',
    },
    head: [
      ['Total Deposited', 'Total Interest', 'Maturity Amount'],
    ],
    body: [
      [
        `Rs. ${formatCurrency(totalDeposited).replace('₹', '')}`,
        `Rs. ${formatCurrency(totalInterest).replace('₹', '')}`,
        `Rs. ${formatCurrency(maturityAmount).replace('₹', '')}`,
      ],
    ],
  });

  // --------------------------------------------------
  // CALCULATION METHODOLOGY
  // --------------------------------------------------

  const methodologyStartY =
    (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Calculation Methodology', 14, methodologyStartY);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const methodology = isMonthly
    ? [
        'RD Type: Monthly Recurring Deposit',
        'Monthly installments are evaluated according to their remaining tenure.',
        'Interest is calculated using the applicable annual interest rate converted to a monthly rate.',
        'Each monthly installment earns interest for the remaining months until maturity.',
      ]
    : [
        'RD Type: Daily Recurring Deposit',
        'The deposited amount is normalized across the calculation period.',
        'Interest is calculated progressively according to the number of days each amount remains invested.',
        'The applicable annual interest rate is used for the calculation.',
      ];

  let methodologyY = methodologyStartY + 7;

  methodology.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, 180);
    doc.text(wrapped, 16, methodologyY);
    methodologyY += wrapped.length * 5 + 2;
  });

  // --------------------------------------------------
  // LEDGER TRANSACTIONS
  // --------------------------------------------------

  let ledgerStartY = methodologyY + 5;

  if (ledgerStartY > 250) {
    doc.addPage();
    ledgerStartY = 20;
  }

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Ledger Transaction Summary', 14, ledgerStartY);

  const ledgerRows = transactions.map((transaction: any, index: number) => {
    return [
      String(transaction.rowNum || index + 1),
      String(transaction.date || ''),
      String(transaction.particulars || ''),
      transaction.debit != null
        ? `Rs. ${Number(transaction.debit).toFixed(2)}`
        : '',
      String(
        transaction.rawReceipt ||
        transaction.payment ||
        ''
      ),
      transaction.balance != null
        ? `Rs. ${Number(transaction.balance).toFixed(2)}`
        : '',
      transaction.intPaid != null
        ? `Rs. ${Number(transaction.intPaid).toFixed(2)}`
        : '',
    ];
  });

  if (ledgerRows.length === 0) {
    ledgerRows.push([
      '-',
      '-',
      'No transaction records available',
      '-',
      '-',
      '-',
      '-',
    ]);
  }

  autoTable(doc, {
    startY: ledgerStartY + 5,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 2,
      overflow: 'linebreak',
    },
    headStyles: {
      fontStyle: 'bold',
    },
    head: [
      [
        '#',
        'Date',
        'Particulars',
        'Debit',
        'Receipt/Credit',
        'Balance',
        'Interest Paid',
      ],
    ],
    body: ledgerRows,
    margin: {
      left: 10,
      right: 10,
    },
  });

  // --------------------------------------------------
  // FOOTER ON EVERY PAGE
  // --------------------------------------------------

  const pageCount = doc.getNumberOfPages();

  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    doc.text(
      `RD Calculator Report | Page ${page} of ${pageCount}`,
      105,
      290,
      { align: 'center' }
    );
  }

  // --------------------------------------------------
  // SAVE PDF
  // --------------------------------------------------

  const safeCustomerName = customerName
    .replace(/[^a-z0-9]/gi, '_')
    .substring(0, 30);

  doc.save(`RD_Report_${safeCustomerName}.pdf`);
};