import React from 'react';
import { Calculator } from 'lucide-react';

interface HeaderProps {
  hasData?: boolean;
}

export const Header: React.FC<HeaderProps> = () => {
  return (
    <header className="bg-white border-b border-gray-200 px-6 sm:px-8 py-5 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
          <Calculator className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
            RD MATURITY CALCULATOR
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Personal Ledger (RD) Processing System
          </p>
        </div>
      </div>
    </header>
  );
};
