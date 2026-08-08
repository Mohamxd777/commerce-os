import { AppError } from '../utils/AppError.js';

const duplicateErrors = {
  suppliers_organization_name_unique: [
    'DUPLICATE_SUPPLIER',
    'A supplier with this name already exists in the organization.',
  ],
  supplier_products_active_relationship_unique: [
    'DUPLICATE_SUPPLIER_PRODUCT',
    'This supplier already has an active relationship with the SKU.',
  ],
  supplier_products_one_preferred_per_sku: [
    'MULTIPLE_PREFERRED_SUPPLIERS',
    'Only one active supplier relationship may be preferred for a SKU.',
  ],
  supplier_price_history_one_current_price: [
    'MULTIPLE_CURRENT_PRICES',
    'A supplier product may have only one current price-history entry.',
  ],
  purchase_orders_organization_number_unique: [
    'DUPLICATE_PO_NUMBER',
    'This purchase-order number already exists in the organization.',
  ],
  purchase_order_items_one_sku_per_order: [
    'DUPLICATE_PO_SKU',
    'A SKU may appear only once on a purchase order.',
  ],
  goods_receipts_organization_number_unique: [
    'DUPLICATE_RECEIPT_NUMBER',
    'This goods-receipt number already exists in the organization.',
  ],
  locations_organization_id_code_key: [
    'DUPLICATE_LOCATION_CODE',
    'This location code already exists in the organization.',
  ],
};

export function translatePurchasingError(error) {
  if (error instanceof AppError) return error;

  if (error.code === '23505') {
    const mapped = duplicateErrors[error.constraint] ?? [
      'DUPLICATE_PURCHASING_RECORD',
      'A purchasing record with these details already exists.',
    ];
    return new AppError(409, mapped[0], mapped[1]);
  }

  if (error.code === '23503') {
    return new AppError(
      400,
      'INVALID_PURCHASING_REFERENCE',
      'A referenced purchasing record does not exist in this organization.',
    );
  }

  if (error.code === '23514' || error.code === '22P02' || error.code === '22003') {
    return new AppError(
      400,
      'PURCHASING_CONSTRAINT_VIOLATION',
      'The purchasing data violates a required amount, format, or relationship.',
    );
  }

  return error;
}
