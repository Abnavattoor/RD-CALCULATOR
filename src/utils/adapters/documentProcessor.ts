/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RDAccountData } from '../../types';
import { DocumentAdapter, DocumentAdapterOptions } from './types';
import { excelAdapter } from './excelAdapter';
import { pdfAdapter } from './pdfAdapter';
import { imageAdapter } from './imageAdapter';
import { RDValidationError } from '../excelParser';

export { excelAdapter, pdfAdapter, imageAdapter };

const REGISTERED_ADAPTERS: DocumentAdapter[] = [
  excelAdapter,
  pdfAdapter,
  imageAdapter,
];

/**
 * Dispatcher to route any supported document (.xlsx, .xls, .pdf, .jpg, .jpeg, .png)
 * to its dedicated adapter and normalize the result.
 */
export async function processMultiFormatDocument(
  file: File,
  options?: DocumentAdapterOptions
): Promise<RDAccountData> {
  const adapter = REGISTERED_ADAPTERS.find((a) => a.canHandle(file));

  if (!adapter) {
    throw new RDValidationError(
      'Unsupported Document Format',
      'Please upload a supported RD document file: Excel (.xlsx, .xls), PDF (.pdf), or Image (.jpg, .jpeg, .png).'
    );
  }

  const result = await adapter.parse(file, options);
  return result;
}
