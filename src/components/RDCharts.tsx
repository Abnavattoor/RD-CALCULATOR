import React from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { RDAccountData } from '../types';
import { formatCurrency } from '../utils/excelParser';

interface RDChartsProps {
  data: RDAccountData;
}

export const RDCharts: React.FC<RDChartsProps> = ({ data }) => {
  const isMonthly = data.rdType === 'Monthly RD';

  // ========================================================================
  // CHART 1 - DEPOSITED VS INTEREST
  // ========================================================================

  const comparisonData = [
    {
      name: 'Deposited',
      amount: Number(data.totalDeposited.toFixed(2)),
    },
    {
      name: 'Interest',
      amount: Number(data.totalInterest.toFixed(2)),
    },
  ];

  // ========================================================================
  // CHART 2 - PROGRESSIVE INTEREST
  // ========================================================================

  const progressiveData: {
    period: string;
    interest: number;
  }[] = [];

  if (isMonthly) {
    // ------------------------------------------------------------
    // MONTHLY RD
    // ------------------------------------------------------------

    const periodText = data.period || '';

    const monthMatch = periodText.match(
      /(\d+)\s*(?:month|months|m\b)/i
    );

    const yearMatch = periodText.match(
      /(\d+)\s*(?:year|years|y\b)/i
    );

    let tenureMonths = 0;

    if (monthMatch) {
      tenureMonths = parseInt(monthMatch[1], 10);
    } else if (yearMatch) {
      tenureMonths = parseInt(yearMatch[1], 10) * 12;
    } else {
      tenureMonths = Math.max(
        1,
        Math.round((data.tenureDays || 0) / (365 / 12))
      );
    }

    const numberOfDeposits = Math.max(
      1,
      data.validTransactionCount
    );

    const monthlyInstallment =
      data.totalDeposited / numberOfDeposits;

    const monthlyRate = data.annualRate / 12;

    let accumulatedInterest = 0;

    // Show maximum 12 points for readability.
    const chartPoints = Math.min(tenureMonths, 12);

    for (let month = 1; month <= chartPoints; month++) {
      const monthsRemaining = Math.max(
        1,
        tenureMonths - month + 1
      );

      const installmentInterest =
        monthlyInstallment *
        monthlyRate *
        monthsRemaining;

      accumulatedInterest += installmentInterest;

      progressiveData.push({
        period: `Month ${month}`,
        interest: Number(accumulatedInterest.toFixed(2)),
      });
    }

    // If tenure is greater than 12 months,
    // add the actual final calculated interest.
    if (tenureMonths > 12) {
      progressiveData.push({
        period: `Month ${tenureMonths}`,
        interest: Number(data.totalInterest.toFixed(2)),
      });
    }
  } else {
    // ------------------------------------------------------------
    // DAILY RD
    // ------------------------------------------------------------

    const tenureDays = data.tenureDays || 365;
    const normalizedDailyAmount = data.normalizedDailyAmount;
    const annualRate = data.annualRate;

    const points = [
      1,
      Math.min(30, tenureDays),
      Math.min(60, tenureDays),
      Math.min(90, tenureDays),
      Math.min(180, tenureDays),
      Math.min(270, tenureDays),
      tenureDays,
    ];

    const uniquePoints = [...new Set(points)].sort(
      (a, b) => a - b
    );

    for (const day of uniquePoints) {
      let accumulatedInterest = 0;

      for (let currentDay = 1; currentDay <= day; currentDay++) {
        accumulatedInterest +=
          normalizedDailyAmount *
          annualRate *
          (currentDay / 365);
      }

      progressiveData.push({
        period: `Day ${day}`,
        interest: Number(accumulatedInterest.toFixed(2)),
      });
    }
  }

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="space-y-6">

      {/* ==================================================================
          CHART 1
      ================================================================== */}

      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">

        <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">

          <h3 className="text-sm font-bold text-gray-900">
            Deposited Amount vs Interest
          </h3>

          <p className="text-xs text-gray-500 mt-1">
            Comparison of the total amount deposited and interest earned.
          </p>

        </div>

        <div className="p-5">

          <div className="w-full h-[280px]">

            <ResponsiveContainer width="100%" height="100%">

              <BarChart
                data={comparisonData}
                margin={{
                  top: 10,
                  right: 20,
                  left: 10,
                  bottom: 10,
                }}
              >

                <CartesianGrid strokeDasharray="3 3" />

                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                />

                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) =>
                    `₹${Number(value).toLocaleString('en-IN')}`
                  }
                />

                <Tooltip />

                <Bar
                  dataKey="amount"
                  name="Amount"
                  radius={[6, 6, 0, 0]}
                />

              </BarChart>

            </ResponsiveContainer>

          </div>

        </div>

      </div>

      {/* ==================================================================
          CHART 2
      ================================================================== */}

      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">

        <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">

          <h3 className="text-sm font-bold text-gray-900">
            Progressive Interest Growth
          </h3>

          <p className="text-xs text-gray-500 mt-1">
            {isMonthly
              ? 'Accumulated interest across the monthly RD tenure.'
              : 'Accumulated interest across the Daily RD calculation period.'}
          </p>

        </div>

        <div className="p-5">

          <div className="w-full h-[300px]">

            <ResponsiveContainer width="100%" height="100%">

              <LineChart
                data={progressiveData}
                margin={{
                  top: 10,
                  right: 20,
                  left: 10,
                  bottom: 10,
                }}
              >

                <CartesianGrid strokeDasharray="3 3" />

                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11 }}
                />

                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) =>
                    `₹${Number(value).toLocaleString('en-IN')}`
                  }
                />

                <Tooltip />

                <Line
                  type="monotone"
                  dataKey="interest"
                  name="Accumulated Interest"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />

              </LineChart>

            </ResponsiveContainer>

          </div>

        </div>

      </div>

    </div>
  );
};

// IMPORTANT:
// Export default as well so the component can be imported safely
// from MaturityResult.tsx.
export default RDCharts;