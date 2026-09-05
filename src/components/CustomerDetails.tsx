import React from 'react';
import { RDAccountData } from '../types';
import { User, Hash, Tag, Calendar, CheckCircle2 } from 'lucide-react';

interface CustomerDetailsProps {
  data: RDAccountData;
}

export const CustomerDetails: React.FC<CustomerDetailsProps> = ({ data }) => {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 mt-8 mb-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 uppercase tracking-wider">
            Customer Details
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Validated RD Ledger</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Customer Name */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center shrink-0 mt-0.5">
              <User className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 block">
                Customer Name
              </span>
              <span className="text-base font-bold text-gray-900 mt-0.5 block">
                {data.customerName}
              </span>
            </div>
          </div>

          {/* Account Number */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center shrink-0 mt-0.5">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 block">
                A/c No
              </span>
              <span className="text-base font-bold text-gray-900 mt-0.5 block font-mono">
                {data.accountNumber}
              </span>
            </div>
          </div>

          {/* RD Type */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 block">
                RD Type
              </span>
              <span className="inline-flex items-center text-sm font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded mt-1">
                {data.rdType}
              </span>
            </div>
          </div>
        </div>

        {/* Additional ledger details if available */}
        {(data.openingDate || data.maturityDate || data.status || data.period || data.interestRate) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 mt-5 border-t border-gray-100 text-xs text-gray-600">
            {data.openingDate && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span>Opening Date: <strong className="text-gray-900">{data.openingDate}</strong></span>
              </div>
            )}
            {data.maturityDate && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Maturity Date: <strong className="text-blue-950 font-bold">{data.maturityDate}</strong></span>
              </div>
            )}
            {data.period && (
              <div>
                <span>Period / Tenure: <strong className="text-gray-900">{data.period}</strong></span>
              </div>
            )}
            {data.interestRate && (
              <div>
                <span>Interest Rate: <strong className="text-gray-900">{data.interestRate} p.a. (12% ÷ 365/day)</strong></span>
              </div>
            )}
            {data.status && (
              <div>
                <span>Status: <strong className="text-gray-900">{data.status}</strong></span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
