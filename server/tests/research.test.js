import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { app } from '../src/app.js';
import { closeDatabase, pool } from '../src/config/database.js';
import { hashPassword } from '../src/utils/password.js';

const suffix = randomUUID().slice(0, 8);
const ownerEmails = [
  'research-owner-a-' + suffix + '@example.com',
  'research-owner-b-' + suffix + '@example.com',
];
const memberEmail = 'research-member-' + suffix + '@example.com';

let organizationA;
let organizationB;
let ownerCookieA;
let ownerCookieB;
let memberCookie;
let categoryId;
let supplierId;
let candidateId;
let comparisonCandidateId;
let supplierOptionId;
let economicsId;

function headers(httpRequest, organizationId, cookie) {
  return httpRequest.set('x-organization-id', organizationId).set('Cookie', cookie);
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

  for (const table of [
    'product_candidate_evidence',
    'candidate_launch_evaluations',
    'candidate_unit_economics',
    'candidate_fee_assumptions',
    'product_samples',
    'candidate_supplier_options',
    'product_candidate_market_snapshots',
    'research_settings',
    'product_candidates',
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
  ]) {
    await pool.query(`DELETE FROM ${table} WHERE organization_id = ANY($1::uuid[])`, [organizationIds]);
  }
  await pool.query('DELETE FROM user_sessions WHERE user_id = ANY($1::uuid[])', [userIds]);
  await pool.query(
    `DELETE FROM membership_roles WHERE membership_id IN (
       SELECT id FROM organization_memberships WHERE organization_id = ANY($1::uuid[])
     )`,
    [organizationIds],
  );
  await pool.query('DELETE FROM organization_memberships WHERE organization_id = ANY($1::uuid[])', [organizationIds]);
  await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
  await pool.query('DELETE FROM organizations WHERE id = ANY($1::uuid[])', [organizationIds]);
}

async function registerOwner(email, organizationName) {
  const response = await request(app).post('/api/auth/register').send({
    email,
    password: 'ResearchFoundation123',
    displayName: 'Research Test Owner',
    organizationName,
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return { organizationId: response.body.data.organization.id, cookie: response.headers['set-cookie'] };
}

async function createMember() {
  const user = await pool.query(
    `INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id`,
    [memberEmail, 'Research Member', await hashPassword('ResearchMember123')],
  );
  const membership = await pool.query(
    `INSERT INTO organization_memberships (organization_id, user_id) VALUES ($1, $2) RETURNING id`,
    [organizationA, user.rows[0].id],
  );
  await pool.query(
    `INSERT INTO membership_roles (membership_id, role_id)
     SELECT $1, id FROM roles WHERE organization_id IS NULL AND slug = 'member'`,
    [membership.rows[0].id],
  );
  const login = await request(app).post('/api/auth/login').send({
    email: memberEmail, password: 'ResearchMember123',
  });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  return login.headers['set-cookie'];
}

before(async () => {
  await cleanup();
  const first = await registerOwner(ownerEmails[0], 'Research A ' + suffix);
  const second = await registerOwner(ownerEmails[1], 'Research B ' + suffix);
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

describe('Product research API', { concurrency: false }, () => {
  it('creates candidates, snapshots, supplier leads, and flexible samples', async () => {
    const category = await headers(
      request(app).post('/api/categories'), organizationA, ownerCookieA,
    ).send({ name: 'Research Accessories ' + suffix });
    assert.equal(category.status, 201, JSON.stringify(category.body));
    categoryId = category.body.data.id;

    const supplier = await headers(
      request(app).post('/api/suppliers'), organizationA, ownerCookieA,
    ).send({ name: 'Research Supplier ' + suffix, preferredCurrency: 'EGP' });
    assert.equal(supplier.status, 201, JSON.stringify(supplier.body));
    supplierId = supplier.body.data.id;

    const candidate = await headers(
      request(app).post('/api/research/candidates'), organizationA, ownerCookieA,
    ).send({
      categoryId,
      name: 'USB-C Hub ' + suffix,
      brandName: 'Candidate Brand',
      marketplaceUrl: 'https://example.com/usb-c-hub',
      status: 'research',
      notes: 'Seven-port aluminum hub under consideration',
    });
    assert.equal(candidate.status, 201, JSON.stringify(candidate.body));
    candidateId = candidate.body.data.id;

    const snapshot = await headers(
      request(app).post('/api/research/candidates/' + candidateId + '/snapshots'),
      organizationA, ownerCookieA,
    ).send({
      marketplace: 'Example Marketplace',
      listingUrl: 'https://example.com/usb-c-hub/listing',
      sellingPrice: '1000', currency: 'EGP', rating: 4.4,
      reviewCount: 880, demandScore: 4, competitionScore: 3,
      evidenceNotes: 'Strong review velocity',
    });
    assert.equal(snapshot.status, 201, JSON.stringify(snapshot.body));
    assert.equal(snapshot.body.data.selling_price, '1000.0000');

    const option = await headers(
      request(app).post('/api/research/candidates/' + candidateId + '/suppliers'),
      organizationA, ownerCookieA,
    ).send({
      supplierId, quotedUnitCost: '500', currency: 'EGP', moq: '20',
      leadTimeDays: 14, quoteDate: '2026-08-08', preferred: true,
      notes: 'Existing supplier quote',
    });
    assert.equal(option.status, 201, JSON.stringify(option.body));
    supplierOptionId = option.body.data.id;

    const lead = await headers(
      request(app).post('/api/research/candidates/' + candidateId + '/suppliers'),
      organizationA, ownerCookieA,
    ).send({
      leadName: 'Shenzhen Hub Lead', contactUrl: 'https://example.com/supplier-lead',
      quotedUnitCost: '470', currency: 'USD', moq: '50', leadTimeDays: 25,
      preferred: false,
    });
    assert.equal(lead.status, 201, JSON.stringify(lead.body));

    const sample = await headers(
      request(app).post('/api/research/candidates/' + candidateId + '/samples'),
      organizationA, ownerCookieA,
    ).send({
      supplierOptionId, referenceCode: 'SAMPLE-' + suffix,
      orderedAt: '2026-08-01', receivedAt: '2026-08-07',
      sampleCost: '550', currency: 'EGP', result: 'pass',
      checklist: [
        { label: 'USB-C power delivery', passed: true, score: 5, notes: 'Stable at 65W' },
        { label: 'HDMI output', passed: true, score: 4 },
      ],
      notes: 'Thermals acceptable after two-hour test',
    });
    assert.equal(sample.status, 201, JSON.stringify(sample.body));
    assert.equal(sample.body.data.result, 'pass');
    assert.equal(sample.body.data.checklist.length, 2);

    const second = await headers(
      request(app).post('/api/research/candidates'), organizationA, ownerCookieA,
    ).send({ categoryId, name: 'Laptop Stand ' + suffix, status: 'research' });
    assert.equal(second.status, 201, JSON.stringify(second.body));
    comparisonCandidateId = second.body.data.id;
  });

  it('stores fee history and authoritative PostgreSQL decimal unit economics', async () => {
    const fee = await headers(
      request(app).post('/api/research/candidates/' + candidateId + '/fee-assumptions'),
      organizationA, ownerCookieA,
    ).send({
      feeName: 'Marketplace referral fee', feeType: 'percentage', feeValue: '10',
      effectiveFrom: '2026-08-01', sourceUrl: 'https://example.com/fees',
      notes: 'Recorded source assumption, not hard-coded',
    });
    assert.equal(fee.status, 201, JSON.stringify(fee.body));

    const economics = await headers(
      request(app).post('/api/research/candidates/' + candidateId + '/unit-economics'),
      organizationA, ownerCookieA,
    ).send({
      currency: 'EGP', sellingPrice: '1000', supplierUnitCost: '500',
      localTransportCost: '30', packagingCost: '20', referralFeePercentage: '10',
      referralFeeFixed: '5', fulfillmentFee: '40', shippingReimbursement: '15',
      advertisingCost: '50', estimatedReturnReserve: '25', otherVariableCosts: '10',
      targetMarginPercentage: '20', targetRoiPercentage: '25',
    });
    assert.equal(economics.status, 201, JSON.stringify(economics.body));
    economicsId = economics.body.data.id;
    assert.equal(economics.body.data.total_variable_cost, '765.0000');
    assert.equal(economics.body.data.gross_profit, '500.0000');
    assert.equal(economics.body.data.net_contribution, '235.0000');
    assert.equal(economics.body.data.net_margin_percentage, '23.5000');
    assert.equal(economics.body.data.roi_percentage, '30.7190');
    assert.equal(economics.body.data.break_even_price, '738.8889');
    assert.equal(economics.body.data.max_purchase_price_for_target_margin, '535.0000');
    assert.equal(economics.body.data.max_purchase_price_for_target_roi, '535.0000');
  });

  it('enforces controlled status transitions and records a structured launch evaluation', async () => {
    const invalid = await headers(
      request(app).patch('/api/research/candidates/' + candidateId), organizationA, ownerCookieA,
    ).send({ status: 'approved' });
    assert.equal(invalid.status, 409);
    assert.equal(invalid.body.error.code, 'RESEARCH_STATUS_TRANSITION_INVALID');

    for (const status of ['shortlisted', 'sourcing', 'sampling', 'approved']) {
      const updated = await headers(
        request(app).patch('/api/research/candidates/' + candidateId), organizationA, ownerCookieA,
      ).send({ status });
      assert.equal(updated.status, 200, JSON.stringify(updated.body));
      assert.equal(updated.body.data.status, status);
    }

    const evaluation = await headers(
      request(app).post('/api/research/candidates/' + candidateId + '/evaluations'),
      organizationA, ownerCookieA,
    ).send({
      unitEconomicsId: economicsId, recommendation: 'buy', riskLevel: 'medium',
      targetSellingPrice: '1000', targetUnitCost: '500',
      targetMarginPercentage: '23.5', targetRoiPercentage: '30.719',
      launchQuantity: '120', plannedCapital: '60000', projectedProfit: '28200',
      rationale: 'Sample passed and contribution clears the configured thresholds.',
    });
    assert.equal(evaluation.status, 201, JSON.stringify(evaluation.body));
    assert.equal(evaluation.body.data.recommendation, 'buy');
  });

  it('warns when planned capital exceeds the organization launch budget', async () => {
    const settings = await headers(
      request(app).patch('/api/research/settings'), organizationA, ownerCookieA,
    ).send({
      minimumMarginPercentage: '20', minimumRoiPercentage: '25',
      maximumCapitalAllocation: '75000', maximumDefectRisk: 'medium',
      minimumDemandScore: 3, launchBudget: '50000', currency: 'EGP',
    });
    assert.equal(settings.status, 200, JSON.stringify(settings.body));

    const summary = await headers(
      request(app).get('/api/research/summary'), organizationA, ownerCookieA,
    );
    assert.equal(summary.status, 200, JSON.stringify(summary.body));
    assert.equal(summary.body.data.total_planned_capital, '60000.0000');
    assert.equal(summary.body.data.capital_budget_exceeded, true);
    assert.equal(summary.body.data.buy_recommendations, 1);
  });

  it('compares only selected organization-owned candidates', async () => {
    const comparison = await headers(
      request(app).get('/api/research/comparison?ids=' + candidateId + ',' + comparisonCandidateId),
      organizationA, ownerCookieA,
    );
    assert.equal(comparison.status, 200, JSON.stringify(comparison.body));
    assert.equal(comparison.body.data.length, 2);
    const hub = comparison.body.data.find((candidate) => candidate.id === candidateId);
    assert.equal(hub.preferred_supplier_name, 'Research Supplier ' + suffix);
    assert.equal(hub.supplier_currency, 'EGP');
    assert.equal(hub.net_margin_percentage, '23.5000');
    assert.equal(hub.sample_result, 'pass');
  });

  it('supports combined server search, filters, and pagination', async () => {
    const filtered = await headers(
      request(app).get(
        '/api/research/candidates?search=USB-C&status=approved&categoryId=' + categoryId
        + '&decision=buy&risk=medium&supplier=true&sample=true&page=1&limit=1',
      ),
      organizationA,
      ownerCookieA,
    );
    assert.equal(filtered.status, 200, JSON.stringify(filtered.body));
    assert.equal(filtered.body.data.length, 1);
    assert.equal(filtered.body.data[0].id, candidateId);
    assert.deepEqual(filtered.body.meta, { page: 1, limit: 1, total: 1, totalPages: 1 });

    const secondPage = await headers(
      request(app).get('/api/research/candidates?page=2&limit=1'), organizationA, ownerCookieA,
    );
    assert.equal(secondPage.status, 200, JSON.stringify(secondPage.body));
    assert.equal(secondPage.body.meta.total, 2);
    assert.equal(secondPage.body.meta.totalPages, 2);
    assert.equal(secondPage.body.data.length, 1);
  });

  it('allows member reads and denies research management and evaluation', async () => {
    const read = await headers(
      request(app).get('/api/research/candidates'), organizationA, memberCookie,
    );
    assert.equal(read.status, 200, JSON.stringify(read.body));

    const write = await headers(
      request(app).post('/api/research/candidates'), organizationA, memberCookie,
    ).send({ name: 'Denied candidate', status: 'research' });
    assert.equal(write.status, 403);

    const evaluation = await headers(
      request(app).post('/api/research/candidates/' + candidateId + '/unit-economics'),
      organizationA, memberCookie,
    ).send({ currency: 'EGP', sellingPrice: '1', supplierUnitCost: '0' });
    assert.equal(evaluation.status, 403);
  });

  it('enforces organization isolation across detail, comparison, and mutation', async () => {
    const wrongMembership = await headers(
      request(app).get('/api/research/candidates'), organizationA, ownerCookieB,
    );
    assert.equal(wrongMembership.status, 403);

    const hidden = await headers(
      request(app).get('/api/research/candidates/' + candidateId), organizationB, ownerCookieB,
    );
    assert.equal(hidden.status, 404);

    const comparison = await headers(
      request(app).get('/api/research/comparison?ids=' + candidateId + ',' + comparisonCandidateId),
      organizationB, ownerCookieB,
    );
    assert.equal(comparison.status, 200);
    assert.equal(comparison.body.data.length, 0);

    const hiddenMutation = await headers(
      request(app).post('/api/research/candidates/' + candidateId + '/samples'),
      organizationB, ownerCookieB,
    ).send({ result: 'pending', checklist: [] });
    assert.equal(hiddenMutation.status, 404);
  });

  it('converts an approved candidate once without creating supplier inventory or purchase orders', async () => {
    const before = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM inventory_movements WHERE organization_id = $1) AS movements,
         (SELECT COUNT(*)::int FROM purchase_orders WHERE organization_id = $1) AS purchase_orders,
         (SELECT COUNT(*)::int FROM supplier_products WHERE organization_id = $1) AS supplier_products`,
      [organizationA],
    );
    const conversion = await headers(
      request(app).post('/api/research/candidates/' + candidateId + '/create-product'),
      organizationA, ownerCookieA,
    ).send({
      categoryId, productName: 'USB-C Hub ' + suffix,
      description: 'Draft catalog product created after research approval.',
      variantName: '7 Port', skuCode: 'HUB-' + suffix.toUpperCase(),
      serialTrackingEnabled: false,
    });
    assert.equal(conversion.status, 201, JSON.stringify(conversion.body));
    assert.equal(conversion.body.data.product.status, 'draft');

    const candidate = await headers(
      request(app).get('/api/research/candidates/' + candidateId), organizationA, ownerCookieA,
    );
    assert.equal(candidate.body.data.status, 'launched');
    assert.equal(candidate.body.data.catalog_product_id, conversion.body.data.product.id);

    const after = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM inventory_movements WHERE organization_id = $1) AS movements,
         (SELECT COUNT(*)::int FROM purchase_orders WHERE organization_id = $1) AS purchase_orders,
         (SELECT COUNT(*)::int FROM supplier_products WHERE organization_id = $1) AS supplier_products`,
      [organizationA],
    );
    assert.deepEqual(after.rows[0], before.rows[0]);

    const duplicate = await headers(
      request(app).post('/api/research/candidates/' + candidateId + '/create-product'),
      organizationA, ownerCookieA,
    ).send({
      categoryId, productName: 'Duplicate Hub', variantName: 'Standard',
      skuCode: 'DUP-' + suffix.toUpperCase(), serialTrackingEnabled: false,
    });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, 'RESEARCH_PRODUCT_ALREADY_CREATED');
  });
});
