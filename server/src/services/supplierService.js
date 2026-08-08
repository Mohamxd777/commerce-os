import { pool } from '../config/database.js';
import { paginationMetadata } from '../models/catalogModelHelpers.js';
import * as supplierModel from '../models/supplierModel.js';
import * as supplierProductModel from '../models/supplierProductModel.js';
import { AppError } from '../utils/AppError.js';
import { translatePurchasingError } from './purchasingErrors.js';

export async function listSuppliers(organizationId, query) {
  const result = await supplierModel.listSuppliers(pool, { organizationId, ...query });
  return {
    items: result.rows,
    pagination: paginationMetadata(result.total, query.page, query.limit),
  };
}

export async function getSupplier(organizationId, id) {
  const supplier = await supplierModel.findSupplierById(pool, { organizationId, id });
  if (!supplier) {
    throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found.');
  }

  const [linkedSkus, purchaseOrders, priceHistory] = await Promise.all([
    supplierProductModel.listSupplierProducts(pool, {
      organizationId,
      supplierId: id,
      search: undefined,
      skuId: undefined,
      isActive: undefined,
      preferred: undefined,
      page: 1,
      limit: 100,
    }),
    supplierModel.listSupplierPurchaseOrders(pool, { organizationId, supplierId: id }),
    supplierModel.listSupplierPriceHistory(pool, { organizationId, supplierId: id }),
  ]);

  return {
    ...supplier,
    linkedSkus: linkedSkus.rows,
    purchaseOrders,
    priceHistory,
  };
}

export async function createSupplier(organizationId, input) {
  try {
    return await supplierModel.createSupplier(pool, { organizationId, ...input });
  } catch (error) {
    throw translatePurchasingError(error);
  }
}

export async function patchSupplier(organizationId, id, input) {
  const fieldMap = {
    name: 'name',
    legalName: 'legal_name',
    contactPerson: 'contact_person',
    phone: 'phone',
    email: 'email',
    websiteUrl: 'website_url',
    address: 'address',
    taxNumber: 'tax_number',
    notes: 'notes',
    paymentTermsDays: 'payment_terms_days',
    preferredCurrency: 'preferred_currency',
    isActive: 'is_active',
  };
  const changes = {};
  for (const [inputField, column] of Object.entries(fieldMap)) {
    if (input[inputField] !== undefined) changes[column] = input[inputField];
  }

  try {
    const supplier = await supplierModel.updateSupplier(pool, {
      organizationId,
      id,
      changes,
    });
    if (!supplier) {
      throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found.');
    }
    return getSupplier(organizationId, id);
  } catch (error) {
    throw translatePurchasingError(error);
  }
}
