import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { app } from '../src/app.js';
import { closeDatabase, pool } from '../src/config/database.js';
import { hashPassword } from '../src/utils/password.js';

const suffix = randomUUID().slice(0, 8);
const ownerEmails = [
  'purchasing-owner-a-' + suffix + '@example.com',
  'purchasing-owner-b-' + suffix + '@example.com',
];
const memberEmail = 'purchasing-member-' + suffix + '@example.com';

let organizationA;
let organizationB;
let ownerCookieA;
let ownerCookieB;
let memberCookie;
let supplierId;
let supplierProductId;
let skuId;
let locationId;
let purchaseOrderId;
let purchaseOrderItemId;
let firstReceiptId;

async function cleanup() {
  const identities = await pool.query(
    `SELECT DISTINCT membership.organization_id, membership.user_id
     FROM organization_memberships AS membership
     JOIN users ON users.id = membership.user_id
     WHERE users.email = ANY($1::text[])`,
    [[...ownerEmails, memberEmail]],
  );
  const organizationIds = [...new Set(identities.rows.map((row) => row.organization_id))];
  const userIds = [...new Set(identities.rows.map((row) => row.user_id))];
  if (organizationIds.length === 0) return;

  const organizationParameters = [organizationIds];
  for (const table of [
    'goods_receipt_items',
    'goods_receipts',
    'purchase_order_items',
    'purchase_orders',
    'supplier_price_history',
    'supplier_products',
    'suppliers',
    'product_images',
    'sku_barcodes',
    'skus',
    'product_variants',
    'products',
    'categories',
    'brands',
    'locations',
  ]) {
    await pool.query(
      `DELETE FROM ${table} WHERE organization_id = ANY($1::uuid[])`,
      organizationParameters,
    );
  }
  await pool.query('DELETE FROM user_sessions WHERE user_id = ANY($1::uuid[])', [userIds]);
  await pool.query(
    `DELETE FROM membership_roles
     WHERE membership_id IN (
       SELECT id FROM organization_memberships
       WHERE organization_id = ANY($1::uuid[])
     )`,
    organizationParameters,
  );
  await pool.query(
    'DELETE FROM organization_memberships WHERE organization_id = ANY($1::uuid[])',
    organizationParameters,
  );
  await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
  await pool.query('DELETE FROM organizations WHERE id = ANY($1::uuid[])', organizationParameters);
}

async function registerOwner(email, organizationName) {
  const response = await request(app).post('/api/auth/register').send({
    email,
    password: 'PurchasingFoundation123',
    displayName: 'Purchasing Test Owner',
    organizationName,
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return {
    organizationId: response.body.data.organization.id,
    cookie: response.headers['set-cookie'],
  };
}

function headers(httpRequest, organizationId, cookie) {
  return httpRequest
    .set('x-organization-id', organizationId)
    .set('Cookie', cookie);
}

async function createMember() {
  const userResult = await pool.query(
    `INSERT INTO users (email, display_name, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [memberEmail, 'Purchasing Member', await hashPassword('PurchasingMember123')],
  );
  const membershipResult = await pool.query(
    `INSERT INTO organization_memberships (organization_id, user_id)
     VALUES ($1, $2)
     RETURNING id`,
    [organizationA, userResult.rows[0].id],
  );
  await pool.query(
    `INSERT INTO membership_roles (membership_id, role_id)
     SELECT $1, id FROM roles
     WHERE organization_id IS NULL AND slug = 'member'`,
    [membershipResult.rows[0].id],
  );
  const login = await request(app).post('/api/auth/login').send({
    email: memberEmail,
    password: 'PurchasingMember123',
  });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  return login.headers['set-cookie'];
}

before(async () => {
  await cleanup();
  const first = await registerOwner(ownerEmails[0], 'Purchasing A ' + suffix);
  const second = await registerOwner(ownerEmails[1], 'Purchasing B ' + suffix);
  organizationA = first.organizationId;
  organizationB = second.organizationId;
  ownerCookieA = first.cookie;
  ownerCookieB = second.cookie;
  memberCookie = await createMember();
});

after(async () => {
  await cleanup();
  await closeDatabase();
});

describe('Purchasing API', { concurrency: false }, () => {
  it('creates suppliers and protects normalized duplicate names', async () => {
    const created = await headers(
      request(app).post('/api/suppliers'),
      organizationA,
      ownerCookieA,
    ).send({
      name: 'Nile Distribution ' + suffix,
      legalName: 'Nile Distribution LLC',
      contactPerson: 'Mona Saleh',
      phone: '+20 100 000 0000',
      email: 'orders-' + suffix + '@example.com',
      paymentTermsDays: 30,
      preferredCurrency: 'egp',
      isActive: true,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.data.preferred_currency, 'EGP');
    supplierId = created.body.data.id;

    const duplicate = await headers(
      request(app).post('/api/suppliers'),
      organizationA,
      ownerCookieA,
    ).send({
      name: '  NILE   DISTRIBUTION ' + suffix + '  ',
      preferredCurrency: 'EGP',
    });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, 'DUPLICATE_SUPPLIER');
  });

  it('creates the catalog SKU and receiving location used by purchasing', async () => {
    const category = await headers(
      request(app).post('/api/categories'),
      organizationA,
      ownerCookieA,
    ).send({ name: 'Purchasing Test Category ' + suffix });
    assert.equal(category.status, 201, JSON.stringify(category.body));

    const product = await headers(
      request(app).post('/api/products'),
      organizationA,
      ownerCookieA,
    ).send({
      categoryId: category.body.data.id,
      name: 'Receipt Test Product ' + suffix,
      status: 'active',
      variants: [{
        name: 'Standard',
        skus: [{
          skuCode: 'PUR-' + suffix.toUpperCase(),
          serialTrackingEnabled: false,
          isActive: true,
          barcodes: [],
        }],
      }],
    });
    assert.equal(product.status, 201, JSON.stringify(product.body));
    skuId = product.body.data.variants[0].skus[0].id;

    const location = await headers(
      request(app).post('/api/locations'),
      organizationA,
      ownerCookieA,
    ).send({
      name: 'Main Receiving ' + suffix,
      code: 'RCV-' + suffix,
      locationType: 'warehouse',
      countryCode: 'EG',
      timezone: 'Africa/Cairo',
    });
    assert.equal(location.status, 201, JSON.stringify(location.body));
    locationId = location.body.data.id;
  });

  it('links supplier and SKU, enforces MOQ validation, and prevents active duplicates', async () => {
    const invalid = await headers(
      request(app).post('/api/supplier-products'),
      organizationA,
      ownerCookieA,
    ).send({
      supplierId,
      skuId,
      currentUnitCost: '12.5000',
      currency: 'EGP',
      moq: '0',
      leadTimeDays: 7,
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');

    const linked = await headers(
      request(app).post('/api/supplier-products'),
      organizationA,
      ownerCookieA,
    ).send({
      supplierId,
      skuId,
      supplierSkuCode: 'NILE-' + suffix,
      currentUnitCost: '12.5000',
      currency: 'EGP',
      moq: '5',
      leadTimeDays: 7,
      preferred: true,
      isActive: true,
    });
    assert.equal(linked.status, 201, JSON.stringify(linked.body));
    assert.equal(linked.body.data.priceHistory.length, 1);
    supplierProductId = linked.body.data.id;

    const duplicate = await headers(
      request(app).post('/api/supplier-products'),
      organizationA,
      ownerCookieA,
    ).send({
      supplierId,
      skuId,
      currentUnitCost: '11.0000',
      currency: 'EGP',
      moq: '5',
      leadTimeDays: 5,
    });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, 'DUPLICATE_SUPPLIER_PRODUCT');
  });

  it('preserves supplier price history and exposes SKU comparison data', async () => {
    const updated = await headers(
      request(app).post('/api/supplier-products/' + supplierProductId + '/price'),
      organizationA,
      ownerCookieA,
    ).send({
      unitCost: '13.2500',
      currency: 'EGP',
      source: 'August quotation',
    });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.data.current_unit_cost, '13.2500');
    assert.equal(updated.body.data.priceHistory.length, 2);
    assert.equal(updated.body.data.priceHistory[0].effective_to, null);
    assert.ok(updated.body.data.priceHistory[1].effective_to);

    const comparison = await headers(
      request(app).get('/api/skus/' + skuId + '/suppliers?page=1&limit=25'),
      organizationA,
      ownerCookieA,
    );
    assert.equal(comparison.status, 200, JSON.stringify(comparison.body));
    assert.equal(comparison.body.meta.sku.id, skuId);
    assert.equal(comparison.body.data[0].supplier_name, 'Nile Distribution ' + suffix);
    assert.equal(comparison.body.data[0].moq, '5.0000');
    assert.equal(comparison.body.data[0].preferred, true);
    assert.ok(comparison.body.data[0].last_price_update);
  });

  it('creates a draft PO transactionally and calculates authoritative totals', async () => {
    const belowMoq = await headers(
      request(app).post('/api/purchase-orders'),
      organizationA,
      ownerCookieA,
    ).send({
      supplierId,
      poNumber: 'PO-BELOW-' + suffix,
      orderDate: '2026-08-08',
      expectedDeliveryDate: '2026-08-20',
      currency: 'EGP',
      shippingCost: '0',
      otherCost: '0',
      items: [{
        skuId,
        supplierProductId,
        quantityOrdered: '4',
        unitCost: '13.2500',
      }],
    });
    assert.equal(belowMoq.status, 400);
    assert.equal(belowMoq.body.error.code, 'MOQ_NOT_MET');

    const created = await headers(
      request(app).post('/api/purchase-orders'),
      organizationA,
      ownerCookieA,
    ).send({
      supplierId,
      poNumber: 'PO-' + suffix,
      orderDate: '2026-08-08',
      expectedDeliveryDate: '2026-08-20',
      currency: 'EGP',
      paymentTermsDays: 30,
      shippingCost: '5.0000',
      otherCost: '3.0000',
      notes: 'Purchasing integration test',
      items: [{
        skuId,
        supplierProductId,
        quantityOrdered: '10',
        unitCost: '13.2500',
        discountAmount: '2.0000',
        taxAmount: '1.0000',
      }],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.data.status, 'draft');
    assert.equal(created.body.data.order_date, '2026-08-08');
    assert.equal(created.body.data.expected_delivery_date, '2026-08-20');
    assert.equal(created.body.data.subtotal, '132.5000');
    assert.equal(created.body.data.discount_total, '2.0000');
    assert.equal(created.body.data.tax_total, '1.0000');
    assert.equal(created.body.data.grand_total, '139.5000');
    assert.equal(created.body.data.items[0].line_total, '131.5000');
    purchaseOrderId = created.body.data.id;
    purchaseOrderItemId = created.body.data.items[0].id;
  });

  it('retains the agreed PO item cost after the supplier price changes', async () => {
    const price = await headers(
      request(app).post('/api/supplier-products/' + supplierProductId + '/price'),
      organizationA,
      ownerCookieA,
    ).send({
      unitCost: '14.0000',
      currency: 'EGP',
      source: 'Post-order quotation',
    });
    assert.equal(price.status, 200, JSON.stringify(price.body));
    assert.equal(price.body.data.priceHistory.length, 3);

    const purchaseOrder = await headers(
      request(app).get('/api/purchase-orders/' + purchaseOrderId),
      organizationA,
      ownerCookieA,
    );
    assert.equal(purchaseOrder.status, 200);
    assert.equal(purchaseOrder.body.data.items[0].unit_cost, '13.2500');
  });

  it('prevents invalid status jumps and enforces role permissions', async () => {
    const invalid = await headers(
      request(app).post('/api/purchase-orders/' + purchaseOrderId + '/mark-ordered'),
      organizationA,
      ownerCookieA,
    );
    assert.equal(invalid.status, 409);
    assert.equal(invalid.body.error.code, 'INVALID_PO_STATUS_TRANSITION');

    const memberRead = await headers(
      request(app).get('/api/suppliers/' + supplierId),
      organizationA,
      memberCookie,
    );
    assert.equal(memberRead.status, 200);

    const memberManage = await headers(
      request(app).post('/api/suppliers'),
      organizationA,
      memberCookie,
    ).send({ name: 'Denied Supplier ' + suffix, preferredCurrency: 'EGP' });
    assert.equal(memberManage.status, 403);
    assert.equal(memberManage.body.error.code, 'PERMISSION_DENIED');

    const memberApprove = await headers(
      request(app).post('/api/purchase-orders/' + purchaseOrderId + '/approve'),
      organizationA,
      memberCookie,
    );
    assert.equal(memberApprove.status, 403);
  });

  it('moves a PO through approved and ordered states', async () => {
    const approved = await headers(
      request(app).post('/api/purchase-orders/' + purchaseOrderId + '/approve'),
      organizationA,
      ownerCookieA,
    );
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.data.status, 'approved');
    assert.ok(approved.body.data.approved_at);

    const ordered = await headers(
      request(app).post('/api/purchase-orders/' + purchaseOrderId + '/mark-ordered'),
      organizationA,
      ownerCookieA,
    );
    assert.equal(ordered.status, 200, JSON.stringify(ordered.body));
    assert.equal(ordered.body.data.status, 'ordered');
  });

  it('records partial receiving and rejected quantities without inventory posting', async () => {
    const receipt = await headers(
      request(app).post('/api/purchase-orders/' + purchaseOrderId + '/receipts'),
      organizationA,
      ownerCookieA,
    ).send({
      receiptNumber: 'GR-1-' + suffix,
      receivedDate: '2026-08-12',
      locationId,
      notes: 'First truck',
      items: [{
        purchaseOrderItemId,
        quantityReceived: '6',
        quantityRejected: '1',
        conditionNotes: 'One damaged carton',
      }],
    });
    assert.equal(receipt.status, 201, JSON.stringify(receipt.body));
    assert.equal(receipt.body.data.items[0].quantity_received, '6.0000');
    assert.equal(receipt.body.data.items[0].quantity_rejected, '1.0000');
    firstReceiptId = receipt.body.data.id;

    const purchaseOrder = await headers(
      request(app).get('/api/purchase-orders/' + purchaseOrderId),
      organizationA,
      ownerCookieA,
    );
    assert.equal(purchaseOrder.body.data.status, 'partially_received');
    assert.equal(purchaseOrder.body.data.items[0].quantity_received, '6.0000');
    assert.equal(purchaseOrder.body.data.items[0].remaining_quantity, '4.0000');
  });

  it('prevents over-receipt without leaving partial data', async () => {
    const overReceipt = await headers(
      request(app).post('/api/purchase-orders/' + purchaseOrderId + '/receipts'),
      organizationA,
      ownerCookieA,
    ).send({
      receiptNumber: 'GR-OVER-' + suffix,
      receivedDate: '2026-08-13',
      locationId,
      items: [{
        purchaseOrderItemId,
        quantityReceived: '5',
        quantityRejected: '0',
      }],
    });
    assert.equal(overReceipt.status, 409);
    assert.equal(overReceipt.body.error.code, 'OVER_RECEIPT_NOT_ALLOWED');

    const receipts = await headers(
      request(app).get('/api/goods-receipts?page=1&limit=25&purchaseOrderId=' + purchaseOrderId),
      organizationA,
      ownerCookieA,
    );
    assert.equal(receipts.status, 200);
    assert.equal(receipts.body.meta.total, 1);
  });

  it('supports multiple receipts and marks the PO received at exact completion', async () => {
    const receipt = await headers(
      request(app).post('/api/purchase-orders/' + purchaseOrderId + '/receipts'),
      organizationA,
      ownerCookieA,
    ).send({
      receiptNumber: 'GR-2-' + suffix,
      receivedDate: '2026-08-14',
      locationId,
      items: [{
        purchaseOrderItemId,
        quantityReceived: '4',
        quantityRejected: '0',
      }],
    });
    assert.equal(receipt.status, 201, JSON.stringify(receipt.body));

    const purchaseOrder = await headers(
      request(app).get('/api/purchase-orders/' + purchaseOrderId),
      organizationA,
      ownerCookieA,
    );
    assert.equal(purchaseOrder.body.data.status, 'received');
    assert.equal(purchaseOrder.body.data.items[0].quantity_received, '10.0000');
    assert.equal(purchaseOrder.body.data.items[0].remaining_quantity, '0.0000');
    assert.equal(purchaseOrder.body.data.receipts.length, 2);

    const firstReceipt = await headers(
      request(app).get('/api/goods-receipts/' + firstReceiptId),
      organizationA,
      ownerCookieA,
    );
    assert.equal(firstReceipt.status, 200);
    assert.equal(firstReceipt.body.data.items[0].condition_notes, 'One damaged carton');
  });

  it('supports server-side purchasing filters, pagination, and summary cards', async () => {
    const suppliers = await headers(
      request(app).get('/api/suppliers?page=1&limit=1&search=Nile&isActive=true'),
      organizationA,
      ownerCookieA,
    );
    assert.equal(suppliers.status, 200, JSON.stringify(suppliers.body));
    assert.equal(suppliers.body.meta.total, 1);

    const purchaseOrders = await headers(
      request(app).get('/api/purchase-orders?page=1&limit=1&status=received&dateFrom=2026-08-01&dateTo=2026-08-31'),
      organizationA,
      ownerCookieA,
    );
    assert.equal(purchaseOrders.status, 200, JSON.stringify(purchaseOrders.body));
    assert.equal(purchaseOrders.body.meta.total, 1);

    const summary = await headers(
      request(app).get('/api/purchasing-summary?dateFrom=2026-08-01&dateTo=2026-08-31'),
      organizationA,
      ownerCookieA,
    );
    assert.equal(summary.status, 200, JSON.stringify(summary.body));
    assert.equal(summary.body.data.active_suppliers, 1);
    assert.equal(summary.body.data.total_purchase_order_value, '139.5000');
  });

  it('enforces organization isolation for purchasing records', async () => {
    const crossMembership = await headers(
      request(app).get('/api/purchase-orders/' + purchaseOrderId),
      organizationA,
      ownerCookieB,
    );
    assert.equal(crossMembership.status, 403);
    assert.equal(crossMembership.body.error.code, 'PERMISSION_DENIED');

    const hiddenOrder = await headers(
      request(app).get('/api/purchase-orders/' + purchaseOrderId),
      organizationB,
      ownerCookieB,
    );
    assert.equal(hiddenOrder.status, 404);
    assert.equal(hiddenOrder.body.error.code, 'PURCHASE_ORDER_NOT_FOUND');

    const hiddenSupplier = await headers(
      request(app).get('/api/suppliers/' + supplierId),
      organizationB,
      ownerCookieB,
    );
    assert.equal(hiddenSupplier.status, 404);
  });

  it('archives referenced suppliers without deleting purchasing history', async () => {
    const archived = await headers(
      request(app).patch('/api/suppliers/' + supplierId),
      organizationA,
      ownerCookieA,
    ).send({ isActive: false });
    assert.equal(archived.status, 200, JSON.stringify(archived.body));
    assert.equal(archived.body.data.is_active, false);

    const purchaseOrder = await headers(
      request(app).get('/api/purchase-orders/' + purchaseOrderId),
      organizationA,
      ownerCookieA,
    );
    assert.equal(purchaseOrder.status, 200);
    assert.equal(purchaseOrder.body.data.supplier_id, supplierId);
  });
});
