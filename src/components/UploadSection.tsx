import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';

interface UploadSectionProps {
  onFileLoaded: (file: File) => void;
  isLoading: boolean;
}

export const UploadSection: React.FC<UploadSectionProps> = ({
  onFileLoaded,
  isLoading,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleValidateAndSubmit = (file: File) => {
    onFileLoaded(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleValidateAndSubmit(files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleValidateAndSubmit(files[0]);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto my-12 px-4">
      {/* Upload card */}
      <div
        id="excel-drop-zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all bg-white shadow-sm ${
          isDragOver
            ? 'border-blue-500 bg-blue-50/40 scale-[1.005]'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          id="excel-file-input"
          accept=".xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
          onChange={handleFileChange}
          className="hidden"
          disabled={isLoading}
        />

        <div className="flex flex-col items-center justify-center">
          <div className="w-14 h-14 mb-4 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
            {isLoading ? (
              <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileSpreadsheet className="w-8 h-8 text-blue-600" />
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight mb-2">
            Upload RD Ledger
          </h2>

          <p className="text-sm text-gray-500 max-w-md mb-6 leading-relaxed">
            Upload the approved Daily RD or Monthly RD Personal Ledger file (<span className="font-medium text-gray-700">.xlsx</span> or <span className="font-medium text-gray-700">.xls</span>) to calculate maturity.
          </p>

          <div className="flex justify-center">
            <button
              type="button"
              id="btn-choose-excel-file"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-sm transition active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>{isLoading ? 'Processing Ledger...' : 'Choose Excel File'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

