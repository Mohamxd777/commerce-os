import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { app } from '../src/app.js';
import { closeDatabase, pool } from '../src/config/database.js';
import { hashPassword } from '../src/utils/password.js';

const suffix = randomUUID().slice(0, 8);
const ownerEmails = [
  'inventory-owner-a-' + suffix + '@example.com',
  'inventory-owner-b-' + suffix + '@example.com',
];
const memberEmail = 'inventory-member-' + suffix + '@example.com';

let organizationA;
let organizationB;
let ownerCookieA;
let ownerCookieB;
let memberCookie;
let skuId;
let supplierId;
let supplierProductId;
let sourceLocationId;
let destinationLocationId;
let purchaseOrderId;
let purchaseOrderItemId;
let receiptId;
let transferId;
let reorderRuleId;

function headers(httpRequest, organizationId, cookie) {
  return httpRequest
    .set('x-organization-id', organizationId)
    .set('Cookie', cookie);
}

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

  const database = await pool.connect();
  try {
    await database.query('BEGIN');
    // Test/QA cleanup is an explicit maintenance operation. Production APIs never
    // expose this database setting or delete immutable movements.
    await database.query("SET LOCAL session_replication_role = 'replica'");
    for (const table of [
      'inventory_movements',
      'inventory_balances',
      'inventory_transfer_items',
      'inventory_transfers',
      'inventory_reorder_rules',
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
      await database.query(
        `DELETE FROM ${table} WHERE organization_id = ANY($1::uuid[])`,
        [organizationIds],
      );
    }
    await database.query('DELETE FROM user_sessions WHERE user_id = ANY($1::uuid[])', [userIds]);
    await database.query(
      `DELETE FROM membership_roles
       WHERE membership_id IN (
         SELECT id FROM organization_memberships
         WHERE organization_id = ANY($1::uuid[])
       )`,
      [organizationIds],
    );
    await database.query(
      'DELETE FROM organization_memberships WHERE organization_id = ANY($1::uuid[])',
      [organizationIds],
    );
    await database.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
    await database.query('DELETE FROM organizations WHERE id = ANY($1::uuid[])', [organizationIds]);
    await database.query('COMMIT');
  } catch (error) {
    await database.query('ROLLBACK');
    throw error;
  } finally {
    database.release();
  }
}

async function registerOwner(email, organizationName) {
  const response = await request(app).post('/api/auth/register').send({
    email,
    password: 'InventoryFoundation123',
    displayName: 'Inventory Test Owner',
    organizationName,
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return {
    organizationId: response.body.data.organization.id,
    cookie: response.headers['set-cookie'],
  };
}

async function createMember() {
  const user = await pool.query(
    `INSERT INTO users (email, display_name, password_hash)
     VALUES ($1, $2, $3) RETURNING id`,
    [memberEmail, 'Inventory Member', await hashPassword('InventoryMember123')],
  );
  const membership = await pool.query(
    `INSERT INTO organization_memberships (organization_id, user_id)
     VALUES ($1, $2) RETURNING id`,
    [organizationA, user.rows[0].id],
  );
  await pool.query(
    `INSERT INTO membership_roles (membership_id, role_id)
     SELECT $1, id FROM roles WHERE organization_id IS NULL AND slug = 'member'`,
    [membership.rows[0].id],
  );
  const login = await request(app).post('/api/auth/login').send({
    email: memberEmail,
    password: 'InventoryMember123',
  });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  return login.headers['set-cookie'];
}

before(async () => {
  await cleanup();
  const first = await registerOwner(ownerEmails[0], 'Inventory A ' + suffix);
  const second = await registerOwner(ownerEmails[1], 'Inventory B ' + suffix);
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

describe('Inventory ledger API', { concurrency: false }, () => {
  it('prepares a SKU, supplier, PO, partial receipt, and two locations', async () => {
    const category = await headers(
      request(app).post('/api/categories'), organizationA, ownerCookieA,
    ).send({ name: 'Inventory Category ' + suffix });
    assert.equal(category.status, 201, JSON.stringify(category.body));

    const product = await headers(
      request(app).post('/api/products'), organizationA, ownerCookieA,
    ).send({
      categoryId: category.body.data.id,
      name: 'Inventory Product ' + suffix,
      status: 'active',
      variants: [{
        name: 'Standard',
        skus: [{
          skuCode: 'INV-' + suffix.toUpperCase(),
          serialTrackingEnabled: true,
          isActive: true,
          barcodes: [],
        }],
      }],
    });
    assert.equal(product.status, 201, JSON.stringify(product.body));
    skuId = product.body.data.variants[0].skus[0].id;

    const locations = [];
    for (const [name, code] of [['Source', 'SRC'], ['Destination', 'DST']]) {
      const location = await headers(
        request(app).post('/api/locations'), organizationA, ownerCookieA,
      ).send({
        name: name + ' ' + suffix,
        code: code + '-' + suffix,
        locationType: 'warehouse',
        countryCode: 'EG',
        timezone: 'Africa/Cairo',
      });
      assert.equal(location.status, 201, JSON.stringify(location.body));
      locations.push(location.body.data.id);
    }
    [sourceLocationId, destinationLocationId] = locations;

    const supplier = await headers(
      request(app).post('/api/suppliers'), organizationA, ownerCookieA,
    ).send({ name: 'Inventory Supplier ' + suffix, preferredCurrency: 'EGP' });
    assert.equal(supplier.status, 201, JSON.stringify(supplier.body));
    supplierId = supplier.body.data.id;

    const linked = await headers(
      request(app).post('/api/supplier-products'), organizationA, ownerCookieA,
    ).send({
      supplierId,
      skuId,
      currentUnitCost: '25',
      currency: 'EGP',
      moq: '1',
      leadTimeDays: 5,
      preferred: true,
    });
    assert.equal(linked.status, 201, JSON.stringify(linked.body));
    supplierProductId = linked.body.data.id;

    const po = await headers(
      request(app).post('/api/purchase-orders'), organizationA, ownerCookieA,
    ).send({
      supplierId,
      poNumber: 'PO-INV-' + suffix,
      orderDate: '2026-08-08',
      expectedDeliveryDate: '2026-08-12',
      currency: 'EGP',
      items: [{
        skuId,
        supplierProductId,
        quantityOrdered: '10',
        unitCost: '25',
      }],
    });
    assert.equal(po.status, 201, JSON.stringify(po.body));
    purchaseOrderId = po.body.data.id;
    purchaseOrderItemId = po.body.data.items[0].id;

    const approved = await headers(
      request(app).post('/api/purchase-orders/' + purchaseOrderId + '/approve'),
      organizationA,
      ownerCookieA,
    );
    assert.equal(approved.status, 200);
    const ordered = await headers(
      request(app).post('/api/purchase-orders/' + purchaseOrderId + '/mark-ordered'),
      organizationA,
      ownerCookieA,
    );
    assert.equal(ordered.status, 200);

    const receipt = await headers(
      request(app).post('/api/purchase-orders/' + purchaseOrderId + '/receipts'),
      organizationA,
      ownerCookieA,
    ).send({
      receiptNumber: 'GR-INV-' + suffix,
      receivedDate: '2026-08-12',
      locationId: sourceLocationId,
      items: [{
        purchaseOrderItemId,
        quantityReceived: '6',
        quantityRejected: '1',
        conditionNotes: 'One rejected unit',
      }],
    });
    assert.equal(receipt.status, 201, JSON.stringify(receipt.body));
    receiptId = receipt.body.data.id;

    const prePostStock = await headers(
      request(app).get('/api/inventory?skuId=' + skuId), organizationA, ownerCookieA,
    );
    assert.equal(prePostStock.status, 200);
    assert.equal(prePostStock.body.data.length, 0, 'Receipt creation must not post implicitly.');
  });

  it('allows member reads but denies receipt posting and adjustments', async () => {
    const memberRead = await headers(
      request(app).get('/api/inventory'), organizationA, memberCookie,
    );
    assert.equal(memberRead.status, 200);

    const memberPost = await headers(
      request(app).post('/api/goods-receipts/' + receiptId + '/post-inventory'),
      organizationA,
      memberCookie,
    );
    assert.equal(memberPost.status, 403);

    const memberAdjustment = await headers(
      request(app).post('/api/inventory/adjustments'), organizationA, memberCookie,
    ).send({
      skuId,
      locationId: sourceLocationId,
      direction: 'in',
      stockBucket: 'available',
      quantity: '1',
      reason: 'Denied member correction',
    });
    assert.equal(memberAdjustment.status, 403);
  });

  it('posts only accepted receipt quantity and is idempotent on retry', async () => {
    const posted = await headers(
      request(app).post('/api/goods-receipts/' + receiptId + '/post-inventory'),
      organizationA,
      ownerCookieA,
    );
    assert.equal(posted.status, 200, JSON.stringify(posted.body));
    assert.equal(posted.body.data.alreadyPosted, false);
    assert.equal(posted.body.data.movements.length, 1);
    assert.equal(posted.body.data.movements[0].quantity, '6.0000');

    const retried = await headers(
      request(app).post('/api/goods-receipts/' + receiptId + '/post-inventory'),
      organizationA,
      ownerCookieA,
    );
    assert.equal(retried.status, 200, JSON.stringify(retried.body));
    assert.equal(retried.body.data.alreadyPosted, true);
    assert.equal(retried.body.data.movements.length, 0);

    const stock = await headers(
      request(app).get('/api/inventory?skuId=' + skuId), organizationA, ownerCookieA,
    );
    assert.equal(stock.status, 200, JSON.stringify(stock.body));
    assert.equal(stock.body.data[0].available, '6.0000');
    assert.equal(stock.body.data[0].total_physical, '6.0000');

    const ledger = await headers(
      request(app).get('/api/inventory/movements?skuId=' + skuId), organizationA, ownerCookieA,
    );
    assert.equal(ledger.body.meta.total, 1);
    assert.equal(ledger.body.data[0].movement_type, 'PURCHASE_RECEIPT');
    assert.equal(ledger.body.data[0].reference_type, 'goods_receipt');
  });

  it('records adjustment in/out and rolls back insufficient stock', async () => {
    const adjustmentIn = await headers(
      request(app).post('/api/inventory/adjustments'), organizationA, ownerCookieA,
    ).send({
      skuId,
      locationId: sourceLocationId,
      direction: 'in',
      stockBucket: 'available',
      quantity: '2',
      reason: 'Found during cycle count',
    });
    assert.equal(adjustmentIn.status, 201, JSON.stringify(adjustmentIn.body));
    assert.equal(adjustmentIn.body.data.movements[0].movement_type, 'ADJUSTMENT_IN');

    const adjustmentOut = await headers(
      request(app).post('/api/inventory/adjustments'), organizationA, ownerCookieA,
    ).send({
      skuId,
      locationId: sourceLocationId,
      direction: 'out',
      stockBucket: 'available',
      quantity: '1',
      reason: 'Cycle count correction',
    });
    assert.equal(adjustmentOut.status, 201, JSON.stringify(adjustmentOut.body));
    assert.equal(adjustmentOut.body.data.movements[0].quantity, '-1.0000');

    const beforeCount = await pool.query(
      `SELECT COUNT(*)::int AS total FROM inventory_movements
       WHERE organization_id = $1 AND sku_id = $2`,
      [organizationA, skuId],
    );
    const insufficient = await headers(
      request(app).post('/api/inventory/adjustments'), organizationA, ownerCookieA,
    ).send({
      skuId,
      locationId: sourceLocationId,
      direction: 'out',
      stockBucket: 'available',
      quantity: '99',
      reason: 'Must roll back cleanly',
    });
    assert.equal(insufficient.status, 409, JSON.stringify(insufficient.body));
    assert.equal(insufficient.body.error.code, 'INSUFFICIENT_AVAILABLE_STOCK');
    const afterCount = await pool.query(
      `SELECT COUNT(*)::int AS total FROM inventory_movements
       WHERE organization_id = $1 AND sku_id = $2`,
      [organizationA, skuId],
    );
    assert.equal(afterCount.rows[0].total, beforeCount.rows[0].total);
  });

  it('validates transfer locations, ships and receives exactly once', async () => {
    const sameLocation = await headers(
      request(app).post('/api/inventory/transfers'), organizationA, ownerCookieA,
    ).send({
      sourceLocationId,
      destinationLocationId: sourceLocationId,
      items: [{ skuId, quantity: '1' }],
    });
    assert.equal(sameLocation.status, 400);
    assert.equal(sameLocation.body.error.code, 'TRANSFER_SAME_LOCATION');

    const created = await headers(
      request(app).post('/api/inventory/transfers'), organizationA, ownerCookieA,
    ).send({
      transferNumber: 'TR-INV-' + suffix,
      sourceLocationId,
      destinationLocationId,
      notes: 'Integration transfer',
      items: [{ skuId, quantity: '2' }],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.data.status, 'draft');
    transferId = created.body.data.id;

    const shipped = await headers(
      request(app).post('/api/inventory/transfers/' + transferId + '/ship'),
      organizationA,
      ownerCookieA,
    );
    assert.equal(shipped.status, 200, JSON.stringify(shipped.body));
    assert.equal(shipped.body.data.status, 'in_transit');
    assert.equal(shipped.body.data.idempotent, false);

    const duplicateShip = await headers(
      request(app).post('/api/inventory/transfers/' + transferId + '/ship'),
      organizationA,
      ownerCookieA,
    );
    assert.equal(duplicateShip.status, 200);
    assert.equal(duplicateShip.body.data.idempotent, true);

    const inTransitSummary = await headers(
      request(app).get('/api/inventory/summary'), organizationA, ownerCookieA,
    );
    assert.equal(inTransitSummary.body.data.transfers_in_transit, 1);

    const received = await headers(
      request(app).post('/api/inventory/transfers/' + transferId + '/receive'),
      organizationA,
      ownerCookieA,
    );
    assert.equal(received.status, 200, JSON.stringify(received.body));
    assert.equal(received.body.data.status, 'received');
    assert.equal(received.body.data.idempotent, false);

    const duplicateReceive = await headers(
      request(app).post('/api/inventory/transfers/' + transferId + '/receive'),
      organizationA,
      ownerCookieA,
    );
    assert.equal(duplicateReceive.status, 200);
    assert.equal(duplicateReceive.body.data.idempotent, true);

    const stock = await headers(
      request(app).get('/api/inventory?skuId=' + skuId), organizationA, ownerCookieA,
    );
    const source = stock.body.data.find((row) => row.location_id === sourceLocationId);
    const destination = stock.body.data.find((row) => row.location_id === destinationLocationId);
    assert.equal(source.available, '5.0000');
    assert.equal(destination.available, '2.0000');

    const transferMovements = await pool.query(
      `SELECT movement_type, quantity FROM inventory_movements
       WHERE organization_id = $1 AND reference_type = 'inventory_transfer'
       AND reference_id = $2 ORDER BY movement_type`,
      [organizationA, transferId],
    );
    assert.deepEqual(transferMovements.rows, [
      { movement_type: 'TRANSFER_IN', quantity: '2.0000' },
      { movement_type: 'TRANSFER_OUT', quantity: '-2.0000' },
    ]);
  });

  it('moves stock to quarantine and damaged buckets without inflating physical stock', async () => {
    const quarantine = await headers(
      request(app).post('/api/inventory/adjustments'), organizationA, ownerCookieA,
    ).send({
      skuId,
      locationId: sourceLocationId,
      direction: 'move',
      stockBucket: 'available',
      destinationBucket: 'quarantine',
      quantity: '1',
      reason: 'Quality inspection required',
    });
    assert.equal(quarantine.status, 201, JSON.stringify(quarantine.body));
    assert.equal(quarantine.body.data.movements.length, 2);
    assert.equal(quarantine.body.data.movements[0].movement_type, 'QUARANTINE_IN');

    const damaged = await headers(
      request(app).post('/api/inventory/adjustments'), organizationA, ownerCookieA,
    ).send({
      skuId,
      locationId: sourceLocationId,
      direction: 'move',
      stockBucket: 'available',
      destinationBucket: 'damaged',
      quantity: '1',
      reason: 'Damage discovered during inspection',
    });
    assert.equal(damaged.status, 201, JSON.stringify(damaged.body));
    assert.equal(damaged.body.data.movements[0].movement_type, 'DAMAGE');

    const stock = await headers(
      request(app).get('/api/inventory?skuId=' + skuId + '&locationId=' + sourceLocationId),
      organizationA,
      ownerCookieA,
    );
    assert.equal(stock.body.data[0].available, '3.0000');
    assert.equal(stock.body.data[0].quarantine, '1.0000');
    assert.equal(stock.body.data[0].damaged, '1.0000');
    assert.equal(stock.body.data[0].total_physical, '5.0000');
  });

  it('creates a reorder rule and detects low stock from its configured threshold', async () => {
    const rule = await headers(
      request(app).post('/api/inventory/reorder-rules'), organizationA, ownerCookieA,
    ).send({
      skuId,
      locationId: sourceLocationId,
      reorderPoint: '3',
      safetyStock: '1',
      targetStock: '10',
      preferredSupplierProductId: supplierProductId,
      isActive: true,
    });
    assert.equal(rule.status, 201, JSON.stringify(rule.body));
    reorderRuleId = rule.body.data.id;

    const lowStock = await headers(
      request(app).get('/api/inventory?lowStock=true&skuId=' + skuId),
      organizationA,
      ownerCookieA,
    );
    assert.equal(lowStock.status, 200, JSON.stringify(lowStock.body));
    assert.equal(lowStock.body.data.length, 1);
    assert.equal(lowStock.body.data[0].stock_status, 'low_stock');

    const rules = await headers(
      request(app).get('/api/inventory/reorder-rules?skuId=' + skuId),
      organizationA,
      ownerCookieA,
    );
    assert.equal(rules.body.data[0].available, '3.0000');
    assert.equal(rules.body.data[0].preferred_supplier_name, 'Inventory Supplier ' + suffix);
    assert.equal(rules.body.data[0].supplier_lead_time_days, 5);

    const patched = await headers(
      request(app).patch('/api/inventory/reorder-rules/' + reorderRuleId),
      organizationA,
      ownerCookieA,
    ).send({ safetyStock: '2' });
    assert.equal(patched.status, 200, JSON.stringify(patched.body));
    assert.equal(patched.body.data.safety_stock, '2.0000');
  });

  it('protects against concurrent stock consumption', async () => {
    const transferIds = [];
    for (const label of ['A', 'B']) {
      const transfer = await headers(
        request(app).post('/api/inventory/transfers'), organizationA, ownerCookieA,
      ).send({
        transferNumber: 'TR-CONCURRENT-' + label + '-' + suffix,
        sourceLocationId,
        destinationLocationId,
        items: [{ skuId, quantity: '3' }],
      });
      assert.equal(transfer.status, 201, JSON.stringify(transfer.body));
      transferIds.push(transfer.body.data.id);
    }

    const results = await Promise.all(transferIds.map((id) => headers(
      request(app).post('/api/inventory/transfers/' + id + '/ship'),
      organizationA,
      ownerCookieA,
    )));
    const statuses = results.map((result) => result.status).sort();
    assert.deepEqual(statuses, [200, 409]);
    const rejected = results.find((result) => result.status === 409);
    assert.equal(rejected.body.error.code, 'INSUFFICIENT_AVAILABLE_STOCK');

    const sourceBalance = await pool.query(
      `SELECT quantity FROM inventory_balances
       WHERE organization_id = $1 AND sku_id = $2 AND location_id = $3
         AND stock_bucket = 'available'`,
      [organizationA, skuId, sourceLocationId],
    );
    assert.equal(sourceBalance.rows[0].quantity, '0.0000');
    const stateRows = await pool.query(
      `SELECT status, COUNT(*)::int AS total FROM inventory_transfers
       WHERE id = ANY($1::uuid[]) GROUP BY status ORDER BY status`,
      [transferIds],
    );
    assert.deepEqual(stateRows.rows, [
      { status: 'draft', total: 1 },
      { status: 'in_transit', total: 1 },
    ]);
  });

  it('returns SKU inventory history and preserves serial-tracking foundations', async () => {
    const detail = await headers(
      request(app).get('/api/skus/' + skuId + '/inventory'), organizationA, ownerCookieA,
    );
    assert.equal(detail.status, 200, JSON.stringify(detail.body));
    assert.equal(detail.body.data.sku_code, 'INV-' + suffix.toUpperCase());
    assert.equal(detail.body.data.serial_tracking_enabled, true);
    assert.ok(detail.body.data.serialTrackingNote.includes('deferred'));
    assert.ok(detail.body.data.movements.length >= 9);
    assert.equal(detail.body.data.reorderRules.length, 1);
    assert.ok(detail.body.data.suppliers.length >= 1);
    assert.ok(detail.body.data.transfers.length >= 3);
  });

  it('enforces organization isolation for every inventory resource', async () => {
    const crossMembership = await headers(
      request(app).get('/api/inventory'), organizationA, ownerCookieB,
    );
    assert.equal(crossMembership.status, 403);

    const hiddenStock = await headers(
      request(app).get('/api/inventory?skuId=' + skuId), organizationB, ownerCookieB,
    );
    assert.equal(hiddenStock.status, 200);
    assert.equal(hiddenStock.body.data.length, 0);

    const hiddenTransfer = await headers(
      request(app).get('/api/inventory/transfers/' + transferId), organizationB, ownerCookieB,
    );
    assert.equal(hiddenTransfer.status, 404);

    const hiddenReceipt = await headers(
      request(app).post('/api/goods-receipts/' + receiptId + '/post-inventory'),
      organizationB,
      ownerCookieB,
    );
    assert.equal(hiddenReceipt.status, 404);
  });

  it('reconciles projection to ledger and rejects direct balance mutation', async () => {
    const reconciliation = await headers(
      request(app).get('/api/inventory/reconciliation'), organizationA, ownerCookieA,
    );
    assert.equal(reconciliation.status, 200, JSON.stringify(reconciliation.body));
    assert.equal(reconciliation.body.data.reconciled, true);
    assert.equal(reconciliation.body.data.mismatchCount, 0);

    await assert.rejects(
      pool.query(
        `UPDATE inventory_balances SET quantity = quantity + 1
         WHERE organization_id = $1 AND sku_id = $2`,
        [organizationA, skuId],
      ),
      (error) => error.code === '42501' && error.message.includes('INVENTORY_BALANCE_DIRECT_WRITE'),
    );
    await assert.rejects(
      pool.query(
        `UPDATE inventory_movements SET notes = 'tampered'
         WHERE organization_id = $1 AND sku_id = $2`,
        [organizationA, skuId],
      ),
      (error) => error.code === '55000' && error.message.includes('INVENTORY_LEDGER_IMMUTABLE'),
    );
  });
});
