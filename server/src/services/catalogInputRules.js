import { AppError } from '../utils/AppError.js';

export function validateBarcodeSet(barcodes) {
  const identifiers = new Set();
  let activePrimaryCount = 0;

  for (const barcode of barcodes) {
    const key = barcode.type + ':' + barcode.value.trim().toUpperCase();
    if (identifiers.has(key)) {
      throw new AppError(
        400,
        'DUPLICATE_BARCODE_IN_REQUEST',
        'The same barcode identifier appears more than once.',
      );
    }
    identifiers.add(key);

    if (barcode.isPrimary && barcode.isActive) {
      activePrimaryCount += 1;
    }
  }

  if (activePrimaryCount > 1) {
    throw new AppError(
      400,
      'MULTIPLE_PRIMARY_BARCODES',
      'A SKU may have only one active primary barcode.',
    );
  }
}

export function validateProductIdentifiers(variants) {
  const skuCodes = new Set();
  const organizationIdentifiers = new Set();

  for (const variant of variants) {
    for (const sku of variant.skus) {
      if (skuCodes.has(sku.skuCode)) {
        throw new AppError(
          400,
          'DUPLICATE_SKU_IN_REQUEST',
          'Each SKU code in a product request must be unique.',
        );
      }
      skuCodes.add(sku.skuCode);
      validateBarcodeSet(sku.barcodes);

      for (const barcode of sku.barcodes) {
        const key = barcode.type + ':' + barcode.value.trim().toUpperCase();
        if (organizationIdentifiers.has(key)) {
          throw new AppError(
            400,
            'DUPLICATE_BARCODE_IN_REQUEST',
            'Barcode identifiers must be unique across the product request.',
          );
        }
        organizationIdentifiers.add(key);
      }
    }
  }
}
