import React, {
  useRef,
  useState,
} from 'react';

import {
  Upload,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Loader2,
} from 'lucide-react';


interface UploadSectionProps {

  onFileLoaded: (
    file: File
  ) => void;

  isLoading: boolean;

  statusMessage?: string;
}


export const UploadSection: React.FC<
  UploadSectionProps
> = ({
  onFileLoaded,
  isLoading,
  statusMessage,
}) => {

  const [
    isDragOver,
    setIsDragOver,
  ] = useState(false);


  const fileInputRef =
    useRef<HTMLInputElement>(
      null
    );


  // ==========================================================================
  // VALID FILE TYPES
  // ==========================================================================

  const isSupportedFile =
    (file: File): boolean => {

      const fileName =
        file.name.toLowerCase();


      return (
        fileName.endsWith('.xlsx') ||
        fileName.endsWith('.xls') ||
        fileName.endsWith('.pdf') ||
        fileName.endsWith('.jpg') ||
        fileName.endsWith('.jpeg') ||
        fileName.endsWith('.png') ||
        file.type === 'application/pdf' ||
        file.type === 'application/vnd.ms-excel' ||
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'image/jpeg' ||
        file.type === 'image/jpg' ||
        file.type === 'image/png'
      );
    };


  // ==========================================================================
  // SUBMIT FILE
  // ==========================================================================

  const handleValidateAndSubmit =
    (
      file: File
    ) => {

      if (isLoading) {
        return;
      }

      if (
        !isSupportedFile(
          file
        )
      ) {

        alert(
          'Please upload a valid RD Ledger file: Excel (.xlsx/.xls), PDF (.pdf), or Image (.jpg/.jpeg/.png).'
        );

        return;
      }


      onFileLoaded(
        file
      );
    };


  // ==========================================================================
  // FILE INPUT
  // ==========================================================================

  const handleFileChange =
    (
      e: React.ChangeEvent<HTMLInputElement>
    ) => {

      if (isLoading) {
        return;
      }

      const files =
        e.target.files;


      if (
        files &&
        files.length > 0
      ) {

        handleValidateAndSubmit(
          files[0]
        );
      }


      if (
        fileInputRef.current
      ) {

        fileInputRef.current.value =
          '';
      }
    };


  // ==========================================================================
  // DRAG OVER
  // ==========================================================================

  const handleDragOver =
    (
      e: React.DragEvent<HTMLDivElement>
    ) => {

      e.preventDefault();

      e.stopPropagation();

      setIsDragOver(
        true
      );
    };


  // ==========================================================================
  // DRAG LEAVE
  // ==========================================================================

  const handleDragLeave =
    (
      e: React.DragEvent<HTMLDivElement>
    ) => {

      e.preventDefault();

      e.stopPropagation();

      setIsDragOver(
        false
      );
    };


  // ==========================================================================
  // DROP
  // ==========================================================================

  const handleDrop =
    (
      e: React.DragEvent<HTMLDivElement>
    ) => {

      e.preventDefault();

      e.stopPropagation();

      setIsDragOver(
        false
      );

      if (isLoading) {
        return;
      }

      const files =
        e.dataTransfer.files;


      if (
        files &&
        files.length > 0
      ) {

        handleValidateAndSubmit(
          files[0]
        );
      }
    };


  // ==========================================================================
  // UI
  // ==========================================================================

  return (

    <div className="w-full max-w-2xl mx-auto my-12 px-4">

      <div
        id="ledger-drop-zone"
        onDragOver={
          handleDragOver
        }
        onDragLeave={
          handleDragLeave
        }
        onDrop={
          handleDrop
        }
        className={`
          relative
          border-2
          border-dashed
          rounded-xl
          p-8
          sm:p-12
          text-center
          transition-all
          bg-white
          shadow-sm

          ${
            isDragOver
              ? 'border-blue-500 bg-blue-50/40 scale-[1.005]'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50/40'
          }

          ${
            isLoading
              ? 'pointer-events-none'
              : ''
          }
        `}
      >


        {/* ================================================================ */}
        {/* FILE INPUT                                                       */}
        {/* ================================================================ */}

        <input
          ref={
            fileInputRef
          }
          type="file"
          id="ledger-file-input"
          accept="
            .xlsx,
            .xls,
            .pdf,
            .jpg,
            .jpeg,
            .png,
            image/jpeg,
            image/png,
            image/jpg,
            application/pdf,
            application/vnd.ms-excel,
            application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
          "
          onChange={
            handleFileChange
          }
          className="hidden"
          disabled={
            isLoading
          }
        />


        <div className="flex flex-col items-center justify-center">


          {/* ============================================================ */}
          {/* ICON                                                          */}
          {/* ============================================================ */}

          <div className="w-16 h-16 mb-4 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">

            {isLoading ? (

              <div className="w-7 h-7 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />

            ) : (

              <div className="flex items-center gap-1.5">

                <FileSpreadsheet className="w-6 h-6" />

                <FileText className="w-5 h-5 text-red-500" />

                <ImageIcon className="w-5 h-5 text-indigo-500" />

              </div>

            )}

          </div>


          {/* ============================================================ */}
          {/* TITLE                                                         */}
          {/* ============================================================ */}

          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight mb-2">

            Upload RD Ledger or Document Image

          </h2>


          {/* ============================================================ */}
          {/* DESCRIPTION                                                   */}
          {/* ============================================================ */}

          <p className="text-sm text-gray-500 max-w-md mb-5 leading-relaxed">

            Upload your approved Daily RD or Monthly RD Personal Ledger
            in Excel, PDF, or Document Photo/Scan (NITC Preclosure template supported).

          </p>


          {/* ============================================================ */}
          {/* SUPPORTED FILE BADGES                                         */}
          {/* ============================================================ */}

          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">

            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-100 text-xs font-semibold text-green-700">

              <FileSpreadsheet className="w-3.5 h-3.5" />

              XLSX / XLS

            </span>


            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-100 text-xs font-semibold text-red-700">

              <FileText className="w-3.5 h-3.5" />

              PDF

            </span>


            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-semibold text-indigo-700">

              <ImageIcon className="w-3.5 h-3.5" />

              JPG / PNG

            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 text-xs font-semibold text-amber-700">

              NITC India Template

            </span>

          </div>


          {/* ============================================================ */}
          {/* BUTTON                                                        */}
          {/* ============================================================ */}

          <div className="flex flex-col items-center justify-center gap-2">

            <button
              type="button"
              id="btn-choose-ledger-file"
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={
                isLoading
              }
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-sm transition active:scale-[0.98] cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
            >

              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Upload className="w-4 h-4" />
              )}

              <span>

                {
                  isLoading
                    ? statusMessage || 'Reading RD document...'
                    : 'Choose Ledger or Document File'
                }

              </span>

            </button>

            {isLoading && statusMessage && (
              <span className="text-xs font-semibold text-blue-600 animate-pulse">
                {statusMessage}
              </span>
            )}

          </div>


          {/* ============================================================ */}
          {/* DROP TEXT                                                     */}
          {/* ============================================================ */}

          <p className="mt-4 text-xs text-gray-400">

            Or drag and drop your Excel, PDF or image file here

          </p>


          {/* ============================================================ */}
          {/* TEMPLATE & OCR NOTE                                           */}
          {/* ============================================================ */}

          <div className="mt-5 max-w-lg rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">

            <p className="text-xs leading-relaxed text-gray-500">

              <strong className="text-gray-700">
                Document & Image note:
              </strong>{' '}

              Directly import photos/scans of NITC INDIA LTD. Preclose / Premature templates.
              Daily RD (RCD) and Monthly RD (RCM) scheme installments and payment tables are automatically detected.

            </p>

          </div>

        </div>

      </div>

    </div>
  );
};