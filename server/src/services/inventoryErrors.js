import { AppError } from '../utils/AppError.js';

const duplicateErrors = {
  inventory_movements_idempotency_unique: [
    'INVENTORY_OPERATION_ALREADY_POSTED',
    'This inventory operation has already been posted.',
  ],
  inventory_transfers_organization_number_unique: [
    'DUPLICATE_TRANSFER_NUMBER',
    'This transfer number already exists in the organization.',
  ],
  inventory_transfer_items_one_sku_unique: [
    'DUPLICATE_TRANSFER_SKU',
    'A SKU may appear only once on a transfer.',
  ],
  inventory_reorder_rules_dimension_unique: [
    'DUPLICATE_REORDER_RULE',
    'A reorder rule already exists for this SKU and location.',
  ],
};

export function translateInventoryError(error) {
  if (error instanceof AppError) return error;

  if (
    error.code === '23514'
    && error.constraint === 'inventory_balances_nonnegative'
  ) {
    return new AppError(
      409,
      'INSUFFICIENT_AVAILABLE_STOCK',
      'This operation would make the selected stock bucket negative.',
    );
  }

  if (error.code === '23505') {
    const mapped = duplicateErrors[error.constraint] ?? [
      'DUPLICATE_INVENTORY_RECORD',
      'An inventory record with these details already exists.',
    ];
    return new AppError(409, mapped[0], mapped[1]);
  }

  if (error.code === '23503') {
    return new AppError(
      400,
      'INVALID_INVENTORY_REFERENCE',
      'A referenced inventory record does not exist in this organization.',
    );
  }

  if (error.code === '23514' || error.code === '22P02' || error.code === '22003') {
    return new AppError(
      400,
      'INVENTORY_CONSTRAINT_VIOLATION',
      'The inventory data violates a required amount, state, or relationship.',
    );
  }

  return error;
}
