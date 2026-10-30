/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RDAccountData, RDType } from '../../types';

export type DocumentFormat = 'Excel' | 'PDF' | 'Image';

export type DocumentCategory =
  | 'Personal RD Ledger'
  | 'Branch Day Sheet'
  | 'Customer Transaction Statement'
  | 'Scanned Personal Ledger'
  | 'Scanned Day Sheet';

export interface DocumentAdapterOptions {
  rdType?: RDType;
  contractualDailyInstallment?: number;
  onStatusUpdate?: (status: string) => void;
}

export interface DocumentProcessingResult {
  data: RDAccountData;
  documentFormat: DocumentFormat;
  documentCategory: DocumentCategory;
  warnings: string[];
}

export interface DocumentAdapter {
  id: string;
  name: string;
  supportedFormats: DocumentFormat[];
  canHandle: (file: File) => boolean;
  parse: (file: File, options?: DocumentAdapterOptions) => Promise<RDAccountData>;
}
