import * as pdfjsLib from 'pdfjs-dist';

import {
  RDAccountData,
  LedgerTransactionRow,
  RDType,
} from '../types';


// ============================================================================
// PDF.JS WORKER
// ============================================================================

pdfjsLib.GlobalWorkerOptions.workerSrc =
  new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();


// ============================================================================
// PDF TEXT ITEM
// ============================================================================

interface PDFTextItem {
  str: string;
  transform?: number[];
}


// ============================================================================
// ROUND MONEY
// ============================================================================

function roundMoney(
  value: number
): number {

  return Math.round(
    (value + Number.EPSILON) * 100
  ) / 100;
}


// ============================================================================
// PARSE MONEY
// ============================================================================

function parseMoney(
  value: string
): number | null {

  if (!value) {
    return null;
  }


  const cleaned =
    value
      .replace(/[₹$€£]/g, '')
      .replace(/Rs\.?/gi, '')
      .replace(/,/g, '')
      .replace(/\s+/g, ' ')
      .trim();


  const match =
    cleaned.match(
      /-?\d+(?:\.\d+)?/
    );


  if (!match) {
    return null;
  }


  const number =
    Number(match[0]);


  return Number.isFinite(number)
    ? number
    : null;
}


// ============================================================================
// PARSE DATE
// ============================================================================

function parsePDFDate(
  value: string
): Date | null {

  if (!value) {
    return null;
  }


  const text =
    value.trim();


  // --------------------------------------------------------------------------
  // DD/MM/YYYY
  // DD-MM-YYYY
  // DD.MM.YYYY
  // --------------------------------------------------------------------------

  let match =
    text.match(
      /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/
    );


  if (match) {

    const day =
      Number(match[1]);

    const month =
      Number(match[2]);

    let year =
      Number(match[3]);


    if (year < 100) {
      year += 2000;
    }


    const date =
      new Date(
        year,
        month - 1,
        day
      );


    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {

      return date;
    }
  }


  // --------------------------------------------------------------------------
  // YYYY-MM-DD
  // --------------------------------------------------------------------------

  match =
    text.match(
      /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/
    );


  if (match) {

    const year =
      Number(match[1]);

    const month =
      Number(match[2]);

    const day =
      Number(match[3]);


    const date =
      new Date(
        year,
        month - 1,
        day
      );


    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {

      return date;
    }
  }


  return null;
}


// ============================================================================
// FORMAT DATE
// ============================================================================

function formatDate(
  date: Date
): string {

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    );

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    );

  const year =
    date.getFullYear();


  return `${day}/${month}/${year}`;
}


// ============================================================================
// NORMALIZE TEXT
// ============================================================================

function normalizeText(
  text: string
): string {

  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}


// ============================================================================
// EXTRACT PDF TEXT
// ============================================================================

async function extractPDFText(
  file: File
): Promise<string[]> {

  const buffer =
    await file.arrayBuffer();


  const pdf =
    await pdfjsLib.getDocument({
      data: buffer,
    }).promise;


  const lines: string[] = [];


  for (
    let pageNumber = 1;
    pageNumber <= pdf.numPages;
    pageNumber++
  ) {

    const page =
      await pdf.getPage(
        pageNumber
      );


    const content =
      await page.getTextContent();


    const items =
      content.items as PDFTextItem[];


    const pageLines: string[] = [];


    let currentLine = '';

    let currentY: number | null = null;


    for (
      const item
      of items
    ) {

      const text =
        normalizeText(
          item.str || ''
        );


      if (!text) {
        continue;
      }


      const y =
        item.transform?.[5] ?? null;


      if (
        currentY !== null &&
        y !== null &&
        Math.abs(
          y - currentY
        ) > 3
      ) {

        if (
          currentLine.trim()
        ) {

          pageLines.push(
            currentLine.trim()
          );
        }


        currentLine = text;

      } else {

        if (currentLine) {
          currentLine += ' ';
        }

        currentLine += text;
      }


      if (y !== null) {
        currentY = y;
      }
    }


    if (
      currentLine.trim()
    ) {

      pageLines.push(
        currentLine.trim()
      );
    }


    lines.push(
      ...pageLines
    );
  }


  return lines;
}


// ============================================================================
// FIND VALUE AFTER LABEL
// ============================================================================

function findLabelValue(
  lines: string[],
  labels: string[]
): string {

  for (
    let index = 0;
    index < lines.length;
    index++
  ) {

    const line =
      lines[index];


    const lower =
      line.toLowerCase();


    for (
      const label
      of labels
    ) {

      const labelLower =
        label.toLowerCase();


      if (
        lower.includes(
          labelLower
        )
      ) {

        // ---------------------------------------------------------------
        // "Customer Name: John"
        // ---------------------------------------------------------------

        const sameLine =
          line
            .substring(
              lower.indexOf(
                labelLower
              ) +
              labelLower.length
            )
            .replace(
              /^[:\-=\s]+/,
              ''
            )
            .trim();


        if (
          sameLine
        ) {

          return sameLine;
        }


        // ---------------------------------------------------------------
        // Label on one line and value on next line
        // ---------------------------------------------------------------

        if (
          lines[index + 1]
        ) {

          return lines[
            index + 1
          ].trim();

        }
      }
    }
  }


  return '';
}


// ============================================================================
// DETECT RD TYPE
// ============================================================================

function detectRDType(
  lines: string[]
): RDType {

  const fullText =
    lines
      .join(' ')
      .toLowerCase();


  if (
    /monthly\s*rd/.test(
      fullText
    )
  ) {

    return 'Monthly RD';
  }


  if (
    /daily\s*rd/.test(
      fullText
    )
  ) {

    return 'Daily RD';
  }


  if (
    /recurring\s*deposit/.test(
      fullText
    )
  ) {

    return 'Recurring Deposit (RD)';
  }


  return 'Monthly RD';
}


// ============================================================================
// DETECT DATE FROM LABEL
// ============================================================================

function findDateValue(
  lines: string[],
  labels: string[]
): Date | null {

  for (
    let index = 0;
    index < lines.length;
    index++
  ) {

    const line =
      lines[index];


    const lower =
      line.toLowerCase();


    for (
      const label
      of labels
    ) {

      if (
        lower.includes(
          label.toLowerCase()
        )
      ) {

        // ---------------------------------------------------------------
        // Search same line
        // ---------------------------------------------------------------

        const dateMatches =
          line.match(
            /\b\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}\b/g
          );


        if (
          dateMatches &&
          dateMatches.length > 0
        ) {

          const parsed =
            parsePDFDate(
              dateMatches[
                dateMatches.length - 1
              ]
            );


          if (parsed) {
            return parsed;
          }
        }


        // ---------------------------------------------------------------
        // Search next few lines
        // ---------------------------------------------------------------

        for (
          let next = index + 1;
          next <= Math.min(
            index + 3,
            lines.length - 1
          );
          next++
        ) {

          const nextMatches =
            lines[next].match(
              /\b\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}\b/g
            );


          if (
            nextMatches
          ) {

            for (
              const candidate
              of nextMatches
            ) {

              const parsed =
                parsePDFDate(
                  candidate
                );


              if (parsed) {
                return parsed;
              }
            }
          }
        }
      }
    }
  }


  return null;
}


// ============================================================================
// EXTRACT ALL DATES
// ============================================================================

function extractAllDates(
  lines: string[]
): Date[] {

  const dates: Date[] = [];


  for (
    const line
    of lines
  ) {

    const matches =
      line.match(
        /\b\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}\b/g
      );


    if (!matches) {
      continue;
    }


    for (
      const candidate
      of matches
    ) {

      const date =
        parsePDFDate(
          candidate
        );


      if (date) {
        dates.push(date);
      }
    }
  }


  return dates;
}


// ============================================================================
// DETECT TRANSACTION LINE
// ============================================================================
//
// We intentionally use conservative matching here.
//
// Expected common format:
//
// 01/01/2026 Deposit 200 200
//
// 05/02/2026 RD Deposit 500 500
//
// ============================================================================

function parseTransactionLine(
  line: string,
  rowNum: number
): LedgerTransactionRow | null {

  const dateMatch =
    line.match(
      /\b\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}\b/
    );


  if (!dateMatch) {
    return null;
  }


  const date =
    parsePDFDate(
      dateMatch[0]
    );


  if (!date) {
    return null;
  }


  const afterDate =
    line
      .substring(
        dateMatch.index! +
        dateMatch[0].length
      )
      .trim();


  // --------------------------------------------------------------------------
  // Extract monetary values
  // --------------------------------------------------------------------------

  const moneyMatches =
    afterDate.match(
      /(?:₹|Rs\.?\s*)?-?\d[\d,]*(?:\.\d{1,2})?/gi
    );


  if (
    !moneyMatches ||
    moneyMatches.length === 0
  ) {

    return null;
  }


  const amounts =
    moneyMatches
      .map(
        (value) =>
          parseMoney(value)
      )
      .filter(
        (
          value
        ): value is number =>
          value !== null &&
          value > 0
      );


  if (
    amounts.length === 0
  ) {

    return null;
  }


  // --------------------------------------------------------------------------
  // Last monetary value is usually balance.
  //
  // Previous monetary value is usually receipt/credit.
  // --------------------------------------------------------------------------

  let receiptCredit:
    number | null = null;

  let balance:
    number | null = null;


  if (
    amounts.length >= 2
  ) {

    receiptCredit =
      amounts[
        amounts.length - 2
      ];

    balance =
      amounts[
        amounts.length - 1
      ];

  } else {

    receiptCredit =
      amounts[0];

  }


  // --------------------------------------------------------------------------
  // Avoid obvious non-payment lines
  // --------------------------------------------------------------------------

  const lower =
    line.toLowerCase();


  const invalidKeywords = [
    'opening balance',
    'closing balance',
    'total',
    'grand total',
    'maturity amount',
    'interest',
    'rate of interest',
    'period',
  ];


  if (
    invalidKeywords.some(
      (keyword) =>
        lower.includes(
          keyword
        )
    )
  ) {

    return null;
  }


  return {

    rowNum,

    date:
      formatDate(
        date
      ),

    depositDateObj:
      date,

    particulars:
      afterDate
        .replace(
          /(?:₹|Rs\.?\s*)?-?\d[\d,]*(?:\.\d{1,2})?/gi,
          ''
        )
        .trim(),

    paymentDebit:
      null,

    receiptCredit,

    rawReceiptCredit:
      receiptCredit,

    balance,

    intPaid:
      null,

    isSummaryRow:
      false,

    isValidPayment:
      receiptCredit !== null &&
      receiptCredit > 0,
  };
}


// ============================================================================
// REMOVE DUPLICATE TRANSACTIONS
// ============================================================================

function removeDuplicateTransactions(
  transactions: LedgerTransactionRow[]
): LedgerTransactionRow[] {

  const seen =
    new Set<string>();


  const result:
    LedgerTransactionRow[] = [];


  for (
    const transaction
    of transactions
  ) {

    const key =
      [
        transaction.date,
        transaction.particulars,
        transaction.receiptCredit,
        transaction.balance,
      ].join('|');


    if (
      seen.has(key)
    ) {

      continue;
    }


    seen.add(key);

    result.push(
      transaction
    );
  }


  return result;
}


// ============================================================================
// PARSE PDF LEDGER
// ============================================================================

export async function parseRDLedgerPDF(
  file: File
): Promise<RDAccountData> {

  const lines =
    await extractPDFText(
      file
    );


  if (
    lines.length === 0
  ) {

    throw new Error(
      'The PDF does not contain readable text. If this is a scanned/image-only ledger, OCR support is required.'
    );
  }


  const fullText =
    lines
      .join('\n');


  // ==========================================================================
  // BASIC INFORMATION
  // ==========================================================================

  const customerName =
    findLabelValue(
      lines,
      [
        'customer name',
        'customer',
        'name of customer',
        'depositor name',
        'depositor',
      ]
    );


  const accountNumber =
    findLabelValue(
      lines,
      [
        'account number',
        'account no',
        'account no.',
        'a/c no',
        'a/c number',
        'rd account number',
        'rd a/c',
      ]
    );


  const openingDate =
    findDateValue(
      lines,
      [
        'opening date',
        'date of opening',
        'rd opening',
        'start date',
        'commencement date',
      ]
    );


  const maturityDate =
    findDateValue(
      lines,
      [
        'maturity date',
        'date of maturity',
        'maturity',
        'closing date',
      ]
    );


  const period =
    findLabelValue(
      lines,
      [
        'period',
        'tenure',
        'term',
        'duration',
      ]
    );


  const interestRateText =
    findLabelValue(
      lines,
      [
        'interest rate',
        'rate of interest',
        'roi',
        'rate',
      ]
    );


  const interestRateMatch =
    interestRateText.match(
      /(\d+(?:\.\d+)?)\s*%/
    );


  const annualRate =
    interestRateMatch
      ? Number(
          interestRateMatch[1]
        )
      : 0;


  const rdType =
    detectRDType(
      lines
    );


  // ==========================================================================
  // TRANSACTIONS
  // ==========================================================================

  let transactions:
    LedgerTransactionRow[] = [];


  let rowNum = 1;


  for (
    const line
    of lines
  ) {

    const transaction =
      parseTransactionLine(
        line,
        rowNum
      );


    if (
      transaction
    ) {

      transactions.push(
        transaction
      );

      rowNum++;
    }
  }


  transactions =
    removeDuplicateTransactions(
      transactions
    );


  // ==========================================================================
  // SORT TRANSACTIONS
  // ==========================================================================

  transactions.sort(
    (
      a,
      b
    ) => {

      const dateA =
        a.depositDateObj
          ? a.depositDateObj.getTime()
          : 0;

      const dateB =
        b.depositDateObj
          ? b.depositDateObj.getTime()
          : 0;


      return dateA - dateB;
    }
  );


  // ==========================================================================
  // TOTAL DEPOSIT
  // ==========================================================================

  let totalDeposited =
    transactions
      .filter(
        (
          transaction
        ) =>
          transaction.isValidPayment
      )
      .reduce(
        (
          total,
          transaction
        ) =>
          total +
          Number(
            transaction.receiptCredit
          ),
        0
      );


  // ==========================================================================
  // FALLBACK: SEARCH TOTAL DEPOSITED
  // ==========================================================================

  if (
    totalDeposited <= 0
  ) {

    const totalRegex =
      /(?:total\s+(?:deposit(?:ed)?|received|paid|receipt|credit)|total\s+amount)[^\d₹Rs]*((?:₹|Rs\.?)?\s*[\d,]+(?:\.\d{1,2})?)/i;


    const totalMatch =
      fullText.match(
        totalRegex
      );


    if (
      totalMatch
    ) {

      const parsed =
        parseMoney(
          totalMatch[1]
        );


      if (
        parsed !== null &&
        parsed > 0
      ) {

        totalDeposited =
          parsed;
      }
    }
  }


  totalDeposited =
    roundMoney(
      totalDeposited
    );


  // ==========================================================================
  // TENURE DAYS
  // ==========================================================================

  let tenureDays =
    0;


  if (
    openingDate &&
    maturityDate
  ) {

    tenureDays =
      Math.max(
        1,
        Math.round(
          (
            maturityDate.getTime() -
            openingDate.getTime()
          ) /
          (
            1000 *
            60 *
            60 *
            24
          )
        )
      );
  }


  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  if (
    !openingDate
  ) {

    throw new Error(
      'The PDF ledger was read, but an opening date could not be identified.'
    );
  }


  if (
    !maturityDate
  ) {

    throw new Error(
      'The PDF ledger was read, but a maturity date could not be identified.'
    );
  }


  if (
    totalDeposited <= 0 &&
    transactions.length === 0
  ) {

    throw new Error(
      'The PDF was readable, but no RD payment transactions could be identified.'
    );
  }


  // ==========================================================================
  // DAILY SCHEME AMOUNT
  // ==========================================================================

  const validPayments =
    transactions.filter(
      (
        transaction
      ) =>
        transaction.isValidPayment &&
        transaction.receiptCredit !== null
    );


  const dailySchemeAmount =
    rdType === 'Daily RD' &&
    validPayments.length > 0
      ? roundMoney(
          Math.min(
            ...validPayments.map(
              (
                transaction
              ) =>
                Number(
                  transaction.receiptCredit
                )
            )
          )
        )
      : 0;


  // ==========================================================================
  // RETURN DATA
  // ==========================================================================

  const result:
    RDAccountData = {

    fileName:
      file.name,

    fileSize:
      file.size,

    sheetName:
      'PDF Ledger',

    customerName:
      customerName,

    accountNumber:
      accountNumber,

    rdType:
      rdType,

    openingDate:
      formatDate(
        openingDate
      ),

    maturityDate:
      formatDate(
        maturityDate
      ),

    interestRate:
      interestRateText,

    annualRate:
      annualRate,

    selectedInterestRate:
      annualRate,

    status:
      'Active',

    period:
      period,

    tenureDays:
      tenureDays,

    transactions:
      transactions,

    totalDeposited:
      totalDeposited,

    dailySchemeAmount:
      dailySchemeAmount,

    profitEligibleAmount:
      totalDeposited,

    nonProfitAmount:
      0,

    normalizedDailyAmount:
      dailySchemeAmount,

    totalInterest:
      0,

    maturityAmount:
      totalDeposited,

    validTransactionCount:
      validPayments.length,

    hasSummaryRow:
      false,

    returnRate:
      0,

    returnAmount:
      0,
  };


  return result;
}