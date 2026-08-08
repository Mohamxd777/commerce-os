import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { app } from '../src/app.js';
import { closeDatabase, pool } from '../src/config/database.js';

const suffix = randomUUID().slice(0, 8);
const testEmails = [
  'catalog-test-a-' + suffix + '@example.com',
  'catalog-test-b-' + suffix + '@example.com',
];

let organizationA;
let organizationB;
let cookieA;
let cookieB;
let brandId;
let rootCategoryId;
let childCategoryId;
let productId;
let variantId;
let skuId;
let skuCode;

async function cleanup() {
  const identities = await pool.query(
    `SELECT DISTINCT membership.organization_id, membership.user_id
     FROM organization_memberships AS membership
     JOIN users ON users.id = membership.user_id
     WHERE users.email = ANY($1::text[])`,
    [testEmails],
  );

  const organizationIds = identities.rows.map((row) => row.organization_id);
  const userIds = identities.rows.map((row) => row.user_id);

  if (organizationIds.length === 0) return;

  const organizationParameters = [organizationIds];
  await pool.query(
    'DELETE FROM product_images WHERE organization_id = ANY($1::uuid[])',
    organizationParameters,
  );
  await pool.query(
    'DELETE FROM sku_barcodes WHERE organization_id = ANY($1::uuid[])',
    organizationParameters,
  );
  await pool.query(
    'DELETE FROM skus WHERE organization_id = ANY($1::uuid[])',
    organizationParameters,
  );
  await pool.query(
    'DELETE FROM product_variants WHERE organization_id = ANY($1::uuid[])',
    organizationParameters,
  );
  await pool.query(
    'DELETE FROM products WHERE organization_id = ANY($1::uuid[])',
    organizationParameters,
  );
  await pool.query(
    'DELETE FROM categories WHERE organization_id = ANY($1::uuid[])',
    organizationParameters,
  );
  await pool.query(
    'DELETE FROM brands WHERE organization_id = ANY($1::uuid[])',
    organizationParameters,
  );
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
    password: 'CatalogFoundation123',
    displayName: 'Catalog Test Owner',
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

function productPayload(overrides = {}) {
  return {
    brandId,
    categoryId: childCategoryId,
    name: 'G102 Lightsync ' + suffix,
    modelNumber: 'G102-' + suffix,
    description: 'Gaming mouse catalog test',
    warrantyMonths: 24,
    defaultWeightGrams: 85,
    status: 'active',
    variants: [
      {
        name: 'Black',
        attributes: { color: 'Black' },
        isActive: true,
        skus: [
          {
            skuCode: 'MOU-LOG-' + suffix.toUpperCase() + '-BLK',
            manufacturerPartNumber: 'MPN-' + suffix,
            serialTrackingEnabled: true,
            isActive: true,
            barcodes: [
              {
                type: 'gtin',
                value: '12345678' + suffix.replace(/\D/g, '').padEnd(6, '0').slice(0, 6),
                isPrimary: true,
                isActive: true,
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

before(async () => {
  await cleanup();
  const first = await registerOwner(testEmails[0], 'Catalog A ' + suffix);
  const second = await registerOwner(testEmails[1], 'Catalog B ' + suffix);
  organizationA = first.organizationId;
  organizationB = second.organizationId;
  cookieA = first.cookie;
  cookieB = second.cookie;
});

after(async () => {
  await cleanup();
  await closeDatabase();
});

describe('Catalog API', { concurrency: false }, () => {
  it('creates and reads an organization-scoped brand', async () => {
    const created = await headers(
      request(app).post('/api/brands'),
      organizationA,
      cookieA,
    ).send({
      name: 'Logitech ' + suffix,
      websiteUrl: 'https://www.logitech.com',
      isActive: true,
    });

    assert.equal(created.status, 201, JSON.stringify(created.body));
    brandId = created.body.data.id;

    const fetched = await headers(
      request(app).get('/api/brands/' + brandId),
      organizationA,
      cookieA,
    );
    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.data.id, brandId);
  });

  it('creates a category hierarchy and prevents circular parents', async () => {
    const root = await headers(
      request(app).post('/api/categories'),
      organizationA,
      cookieA,
    ).send({
      name: 'Computer Accessories ' + suffix,
      isActive: true,
    });
    assert.equal(root.status, 201, JSON.stringify(root.body));
    rootCategoryId = root.body.data.id;

    const child = await headers(
      request(app).post('/api/categories'),
      organizationA,
      cookieA,
    ).send({
      parentId: rootCategoryId,
      name: 'Gaming Mice ' + suffix,
      isActive: true,
    });
    assert.equal(child.status, 201, JSON.stringify(child.body));
    childCategoryId = child.body.data.id;

    const list = await headers(
      request(app).get('/api/categories?limit=25&page=1'),
      organizationA,
      cookieA,
    );
    assert.equal(list.status, 200);
    const childRow = list.body.data.find((category) => category.id === childCategoryId);
    assert.match(childRow.path, /Computer Accessories.*Gaming Mice/);

    const cycle = await headers(
      request(app).patch('/api/categories/' + rootCategoryId),
      organizationA,
      cookieA,
    ).send({ parentId: childCategoryId });

    assert.equal(cycle.status, 400);
    assert.equal(cycle.body.error.code, 'CATEGORY_CYCLE');
  });

  it('creates a product, variant, SKU, and barcode in one transaction', async () => {
    const response = await headers(
      request(app).post('/api/products'),
      organizationA,
      cookieA,
    ).send(productPayload());

    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.data.variants.length, 1);
    assert.equal(response.body.data.variants[0].skus.length, 1);
    assert.equal(response.body.data.variants[0].skus[0].barcodes.length, 1);

    productId = response.body.data.id;
    variantId = response.body.data.variants[0].id;
    skuId = response.body.data.variants[0].skus[0].id;
    skuCode = response.body.data.variants[0].skus[0].sku_code;
  });

  it('rolls back the whole product structure when a nested SKU conflicts', async () => {
    const failed = await headers(
      request(app).post('/api/products'),
      organizationA,
      cookieA,
    ).send(
      productPayload({
        name: 'Rollback Candidate ' + suffix,
        modelNumber: 'ROLLBACK-' + suffix,
      }),
    );

    assert.equal(failed.status, 409);
    assert.equal(failed.body.error.code, 'DUPLICATE_SKU');

    const search = await headers(
      request(app).get(
        '/api/products?page=1&limit=25&search=' + encodeURIComponent('Rollback Candidate ' + suffix),
      ),
      organizationA,
      cookieA,
    );
    assert.equal(search.status, 200);
    assert.equal(search.body.meta.total, 0);
  });

  it('prevents duplicate SKU creation', async () => {
    const response = await headers(
      request(app).post('/api/skus'),
      organizationA,
      cookieA,
    ).send({
      productVariantId: variantId,
      skuCode,
      serialTrackingEnabled: false,
      isActive: true,
      barcodes: [],
    });

    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, 'DUPLICATE_SKU');
  });

  it('searches and updates SKU configuration without allowing code changes', async () => {
    const list = await headers(
      request(app).get('/api/skus?page=1&limit=25&search=' + encodeURIComponent(skuCode)),
      organizationA,
      cookieA,
    );
    assert.equal(list.status, 200, JSON.stringify(list.body));
    assert.equal(list.body.meta.total, 1);
    assert.equal(list.body.data[0].id, skuId);

    const updated = await headers(
      request(app).patch('/api/skus/' + skuId),
      organizationA,
      cookieA,
    ).send({ serialTrackingEnabled: false });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.serial_tracking_enabled, false);
    assert.equal(updated.body.data.sku_code, skuCode);

    const immutable = await headers(
      request(app).patch('/api/skus/' + skuId),
      organizationA,
      cookieA,
    ).send({ skuCode: 'CHANGED-SKU' });
    assert.equal(immutable.status, 400);
    assert.equal(immutable.body.error.code, 'VALIDATION_ERROR');
  });

  it('enforces organization isolation for headers and record lookup', async () => {
    const forbidden = await headers(
      request(app).get('/api/products'),
      organizationA,
      cookieB,
    );
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error.code, 'PERMISSION_DENIED');

    const hidden = await headers(
      request(app).get('/api/products/' + productId),
      organizationB,
      cookieB,
    );
    assert.equal(hidden.status, 404);
    assert.equal(hidden.body.error.code, 'PRODUCT_NOT_FOUND');
  });

  it('supports server-side product search, filters, and pagination', async () => {
    const secondProduct = productPayload({
      name: 'K120 Keyboard ' + suffix,
      modelNumber: 'K120-' + suffix,
      variants: [
        {
          name: 'US Layout',
          attributes: { layout: 'US' },
          isActive: true,
          skus: [
            {
              skuCode: 'KEY-LOG-' + suffix.toUpperCase() + '-US',
              serialTrackingEnabled: false,
              isActive: true,
              barcodes: [],
            },
          ],
        },
      ],
    });
    const created = await headers(
      request(app).post('/api/products'),
      organizationA,
      cookieA,
    ).send(secondProduct);
    assert.equal(created.status, 201, JSON.stringify(created.body));

    const paged = await headers(
      request(app).get(
        '/api/products?page=1&limit=1&brandId=' + brandId + '&status=active',
      ),
      organizationA,
      cookieA,
    );
    assert.equal(paged.status, 200, JSON.stringify(paged.body));
    assert.equal(paged.body.data.length, 1);
    assert.equal(paged.body.meta.total, 2);
    assert.equal(paged.body.meta.totalPages, 2);

    const searched = await headers(
      request(app).get(
        '/api/products?page=1&limit=25&search=' + encodeURIComponent('G102-' + suffix),
      ),
      organizationA,
      cookieA,
    );
    assert.equal(searched.status, 200);
    assert.equal(searched.body.meta.total, 1);
    assert.equal(searched.body.data[0].id, productId);

    const searchedBySku = await headers(
      request(app).get(
        '/api/products?page=1&limit=25&search=' + encodeURIComponent(skuCode),
      ),
      organizationA,
      cookieA,
    );
    assert.equal(searchedBySku.status, 200);
    assert.equal(searchedBySku.body.meta.total, 1);
    assert.equal(searchedBySku.body.data[0].id, productId);
  });

  it('archives products and deactivates referenced brands without deleting them', async () => {
    const archived = await headers(
      request(app).patch('/api/products/' + productId),
      organizationA,
      cookieA,
    ).send({ status: 'archived' });

    assert.equal(archived.status, 200);
    assert.equal(archived.body.data.status, 'archived');
    assert.ok(archived.body.data.archived_at);

    const deactivated = await headers(
      request(app).patch('/api/brands/' + brandId),
      organizationA,
      cookieA,
    ).send({ isActive: false });

    assert.equal(deactivated.status, 200);
    assert.equal(deactivated.body.data.is_active, false);

    const stillReadable = await headers(
      request(app).get('/api/products/' + productId),
      organizationA,
      cookieA,
    );
    assert.equal(stillReadable.status, 200);
  });
});
