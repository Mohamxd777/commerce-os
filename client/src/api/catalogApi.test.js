import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './catalogApi.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiRequest response handling', () => {
  it('returns a successful JSON response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ data: { values: { title: 'USB-C hub' } } }),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    )));

    await expect(apiRequest('/research/noon/analyze')).resolves.toEqual({
      data: { values: { title: 'USB-C hub' } },
    });
  });

  it('turns a network failure into a typed error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(apiRequest('/research/noon/analyze')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });

  it('turns an empty backend body into a typed error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })));

    await expect(apiRequest('/research/noon/analyze')).rejects.toMatchObject({
      code: 'EMPTY_RESPONSE', status: 500,
    });
  });

  it('turns a non-JSON backend body into a typed error without exposing the body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>proxy failure</html>', {
      status: 502,
      headers: { 'Content-Type': 'text/html' },
    })));

    await expect(apiRequest('/research/noon/analyze')).rejects.toMatchObject({
      code: 'NON_JSON_RESPONSE', status: 502,
      details: { responseContentType: 'text/html' },
    });
  });

  it('preserves a valid JSON API error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: {
        code: 'NOON_ANALYZE_FAILED',
        message: 'Could not analyze this Noon page.',
        details: { reason: 'blocked', upstreamStatus: 403 },
      },
    }), { status: 422, headers: { 'Content-Type': 'application/json' } })));

    await expect(apiRequest('/research/noon/analyze')).rejects.toMatchObject({
      code: 'NOON_ANALYZE_FAILED', status: 422,
      details: { reason: 'blocked', upstreamStatus: 403 },
    });
  });

  it('turns malformed JSON into a typed error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{broken', {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })));

    await expect(apiRequest('/research/noon/analyze')).rejects.toMatchObject({
      code: 'MALFORMED_JSON_RESPONSE', status: 500,
    });
  });
});
