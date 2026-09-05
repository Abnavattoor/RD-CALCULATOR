import React from 'react';
import { AlertOctagon, X, RotateCcw } from 'lucide-react';

interface ErrorAlertProps {
  title: string;
  message: string;
  onClear: () => void;
  onRetry?: () => void;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  title,
  message,
  onClear,
  onRetry,
}) => {
  return (
    <div className="w-full max-w-2xl mx-auto my-6 px-4">
      <div className="rounded-xl border border-red-200 bg-red-50/90 p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0 mt-0.5">
            <AlertOctagon className="w-5 h-5" />
          </div>

          <div className="flex-1">
            <h3 className="text-sm font-bold text-red-900 tracking-tight">
              {title}
            </h3>
            <p className="text-xs text-red-700 mt-1 leading-relaxed">
              {message}
            </p>

            <div className="flex items-center gap-3 mt-4">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white font-medium text-xs transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Try Another File</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClear}
                className="text-xs text-red-600 hover:text-red-800 font-medium cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClear}
            className="text-red-400 hover:text-red-600 p-1 transition cursor-pointer"
            aria-label="Close error message"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
