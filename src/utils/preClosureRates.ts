// ============================================================================
// PRE-CLOSURE RATE TABLE
// ============================================================================

export type PreClosureScheme = 'RC' | 'DS';

export interface PreClosureRateBand {
  minMonth: number;
  maxMonth: number;
  rate: number;
  tenures: number[];
}

// ============================================================================
// RC RATE TABLE
// ============================================================================
//
// RC:
// 1Y, 2Y, 3Y
//
// Months 1–3   = 0%
// Months 4–6   = 2%
// Months 7–8   = 4%
// Months 9–10  = 5%
// Months 11–12 = 6%
// Months 13–24 = 7.5% for 2Y/3Y
// Months 25–36 = 8% for 3Y
//
// ============================================================================

export const RC_PRE_CLOSURE_RATES: PreClosureRateBand[] = [

  {
    minMonth: 1,
    maxMonth: 3,
    rate: 0,
    tenures: [1, 2, 3],
  },

  {
    minMonth: 4,
    maxMonth: 6,
    rate: 2,
    tenures: [1, 2, 3],
  },

  {
    minMonth: 7,
    maxMonth: 8,
    rate: 4,
    tenures: [1, 2, 3],
  },

  {
    minMonth: 9,
    maxMonth: 10,
    rate: 5,
    tenures: [1, 2, 3],
  },

  {
    minMonth: 11,
    maxMonth: 12,
    rate: 6,
    tenures: [1, 2, 3],
  },

  {
    minMonth: 13,
    maxMonth: 24,
    rate: 7.5,
    tenures: [2, 3],
  },

  {
    minMonth: 25,
    maxMonth: 36,
    rate: 8,
    tenures: [3],
  },

];

// ============================================================================
// DS RATE TABLE
// ============================================================================
//
// DS:
// 1Y, 2Y, 3Y, 4Y, 5Y
//
// Month 1       = 0%
// Months 2–3    = 1%
// Month 4       = 2%
// Months 5–6    = 3%
// Month 7       = 5%
// Month 8       = 6%
// Month 9       = 7%
// Month 10      = 8%
// Months 11–12  = 10%
// Months 13–24  = 10% for 2Y+
// Months 25–36  = 10.5% for 3Y+
// Months 37–48  = 11% for 4Y+
// Months 49–60  = 11.5% for 5Y
//
// ============================================================================

export const DS_PRE_CLOSURE_RATES: PreClosureRateBand[] = [

  {
    minMonth: 1,
    maxMonth: 1,
    rate: 0,
    tenures: [1, 2, 3, 4, 5],
  },

  {
    minMonth: 2,
    maxMonth: 3,
    rate: 1,
    tenures: [1, 2, 3, 4, 5],
  },

  {
    minMonth: 4,
    maxMonth: 4,
    rate: 2,
    tenures: [1, 2, 3, 4, 5],
  },

  {
    minMonth: 5,
    maxMonth: 6,
    rate: 3,
    tenures: [1, 2, 3, 4, 5],
  },

  {
    minMonth: 7,
    maxMonth: 7,
    rate: 5,
    tenures: [1, 2, 3, 4, 5],
  },

  {
    minMonth: 8,
    maxMonth: 8,
    rate: 6,
    tenures: [1, 2, 3, 4, 5],
  },

  {
    minMonth: 9,
    maxMonth: 9,
    rate: 7,
    tenures: [1, 2, 3, 4, 5],
  },

  {
    minMonth: 10,
    maxMonth: 10,
    rate: 8,
    tenures: [1, 2, 3, 4, 5],
  },

  {
    minMonth: 11,
    maxMonth: 12,
    rate: 10,
    tenures: [1, 2, 3, 4, 5],
  },

  {
    minMonth: 13,
    maxMonth: 24,
    rate: 10,
    tenures: [2, 3, 4, 5],
  },

  {
    minMonth: 25,
    maxMonth: 36,
    rate: 10.5,
    tenures: [3, 4, 5],
  },

  {
    minMonth: 37,
    maxMonth: 48,
    rate: 11,
    tenures: [4, 5],
  },

  {
    minMonth: 49,
    maxMonth: 60,
    rate: 11.5,
    tenures: [5],
  },

];

// ============================================================================
// COMBINED RATE TABLE
// ============================================================================

export const PRE_CLOSURE_RATES: Record<
  PreClosureScheme,
  PreClosureRateBand[]
> = {
  RC: RC_PRE_CLOSURE_RATES,
  DS: DS_PRE_CLOSURE_RATES,
};

// ============================================================================
// COMPATIBILITY ALIAS
//
// PreClosureCalculator.tsx expects PRE_CLOSURE_RATE_TABLE.
// Keep both names so existing code does not break.
// ============================================================================

export const PRE_CLOSURE_RATE_TABLE =
  PRE_CLOSURE_RATES;

// ============================================================================
// GET APPLICABLE RATE
// ============================================================================

export function getApplicablePreClosureRate(
  scheme: PreClosureScheme,
  originalTenureYears: number,
  closureMonth: number
): number {

  if (
    !Number.isFinite(
      originalTenureYears
    ) ||
    originalTenureYears <= 0
  ) {
    throw new Error(
      'Invalid original RD tenure.'
    );
  }

  if (
    !Number.isFinite(
      closureMonth
    ) ||
    closureMonth <= 0
  ) {
    throw new Error(
      'Invalid pre-closure month.'
    );
  }

  const rates =
    PRE_CLOSURE_RATES[scheme];

  if (!rates) {
    throw new Error(
      `Unsupported pre-closure scheme: ${scheme}`
    );
  }

  const matchingBand =
    rates.find(
      (band) =>
        closureMonth >=
          band.minMonth &&
        closureMonth <=
          band.maxMonth &&
        band.tenures.includes(
          originalTenureYears
        )
    );

  if (!matchingBand) {
    throw new Error(
      `No pre-closure rate is defined for ${scheme}, ${originalTenureYears}-year tenure, month ${closureMonth}.`
    );
  }

  return matchingBand.rate;
}