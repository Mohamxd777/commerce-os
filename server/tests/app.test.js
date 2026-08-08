import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import request from 'supertest';
import { app } from '../src/app.js';
import { closeDatabase } from '../src/config/database.js';

after(async () => {
  await closeDatabase();
});

describe('API foundation', () => {
  it('reports process health without requiring a database query', async () => {
    const response = await request(app).get('/api/health');

    assert.equal(response.status, 200);
    assert.equal(response.body.data.service, 'commerce-os-api');
    assert.equal(response.body.data.status, 'ok');
    assert.ok(response.headers['x-request-id']);
  });

  it('uses the shared validation error format', async () => {
    const response = await request(app).post('/api/auth/register').send({
      email: 'not-an-email',
      password: 'short',
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(response.body.error.details));
  });

  it('uses the shared not-found error format', async () => {
    const response = await request(app).get('/api/does-not-exist');

    assert.equal(response.status, 404);
    assert.equal(response.body.error.code, 'NOT_FOUND');
  });
});
