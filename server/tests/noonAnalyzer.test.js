import assert from 'node:assert/strict';
import test from 'node:test';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { analyzeNoonHtml, analyzeNoonUrl, fetchPublicNoonResource, validateNoonUrl } from '../src/services/noonAnalyzerService.js';
import { inspectImageBuffer } from '../src/services/imageStorageService.js';
import { normalizeNoonAnalyzeError } from '../src/services/researchService.js';
import { AppError } from '../src/utils/AppError.js';

test('Noon analyzer uses the documented fallback order and reports field provenance', () => {
  const html = `<!doctype html><html><head>
    <link rel="canonical" href="https://www.noon.com/egypt-en/test-product/N123/p/">
    <meta property="og:image" content="https://f.nooncdn.com/p/test.jpg">
    <script type="application/ld+json">{
      "@context":"https://schema.org","@type":"Product","name":"USB-C Hub 5-in-1",
      "model":"HUB-501","brand":{"name":"DockLab"},"gtin13":"1234567890123",
      "image":["https://f.nooncdn.com/p/main.jpg","https://f.nooncdn.com/p/side.jpg"],
      "additionalProperty":[{"@type":"PropertyValue","name":"Ports","value":"5"}],
      "offers":{"@type":"Offer","price":"249.00","priceCurrency":"EGP","availability":"https://schema.org/InStock","seller":{"name":"Noon seller"}},
      "aggregateRating":{"ratingValue":"4.6","reviewCount":"128"}
    }</script>
    <title>Fallback title</title></head><body><h1>Semantic title</h1><p>Noon Express delivery. 50+ sold in the past month.</p></body></html>`;
  const result = analyzeNoonHtml(html, 'https://www.noon.com/egypt-en/test-product/N123/p/', '2026-08-12T10:00:00.000Z');

  assert.equal(result.values.title, 'USB-C Hub 5-in-1');
  assert.equal(result.fields.title.source, 'json_ld');
  assert.equal(result.values.currentPrice, 249);
  assert.equal(result.values.currency, 'EGP');
  assert.equal(result.values.rating, 4.6);
  assert.equal(result.values.reviewCount, 128);
  assert.equal(result.values.noonExpress, true);
  assert.match(result.values.recentSales, /50\+ sold/i);
  assert.equal(result.values.specifications.Ports, '5');
  assert.deepEqual(result.strategy, ['json_ld', 'embedded_state', 'meta', 'semantic_html', 'scoped_text']);
  assert.ok(result.notFound.includes('originalPrice'));
});

test('Noon analyzer falls through malformed structured data to embedded state and meta', () => {
  const html = `<html><head>
    <script type="application/ld+json">{not json}</script>
    <script id="__NEXT_DATA__" type="application/json">{"props":{"product":{"name":"Embedded hub","price":199,"currency":"egp","brandName":"Acme","images":["/img.jpg"]}}}</script>
    <meta property="og:title" content="Meta title">
  </head><body></body></html>`;
  const result = analyzeNoonHtml(html, 'https://www.noon.com/item/p/');
  assert.equal(result.values.title, 'Embedded hub');
  assert.equal(result.fields.title.source, 'embedded_state');
  assert.equal(result.values.currentPrice, 199);
  assert.equal(result.values.currency, 'EGP');
  assert.equal(result.values.mainImageUrl, 'https://www.noon.com/img.jpg');
});

test('Noon URL policy rejects lookalike hosts, credentials and unsupported protocols', () => {
  assert.throws(() => validateNoonUrl('https://noon.com.evil.example/product'), { code: 'NOON_HOST_NOT_ALLOWED' });
  assert.throws(() => validateNoonUrl('file:///etc/passwd'), { code: 'INVALID_NOON_URL_PROTOCOL' });
  assert.throws(() => validateNoonUrl('https://user:pass@www.noon.com/product'), { code: 'NOON_URL_CREDENTIALS_NOT_ALLOWED' });
  assert.equal(validateNoonUrl('https://WWW.NOON.COM/product#reviews').toString(), 'https://www.noon.com/product');
});

test('Noon fetch blocks private DNS answers before making a request', async () => {
  let fetched = false;
  await assert.rejects(
    fetchPublicNoonResource('https://www.noon.com/product', {
      resolveHost: async () => [{ address: '127.0.0.1', family: 4 }],
      fetchImpl: async () => { fetched = true; return new Response('unexpected'); },
    }),
    { code: 'NOON_PRIVATE_ADDRESS_BLOCKED' },
  );
  assert.equal(fetched, false);
});

test('Noon fetch rejects redirects outside the allowlist', async () => {
  await assert.rejects(
    fetchPublicNoonResource('https://www.noon.com/product', {
      resolveHost: async () => [{ address: '8.8.8.8', family: 4 }],
      fetchImpl: async () => new Response(null, { status: 302, headers: { location: 'https://example.com/private' } }),
    }),
    { code: 'NOON_HOST_NOT_ALLOWED' },
  );
});

test('Noon fetch classifies an upstream 403 as a blocked analyzer request', async () => {
  await assert.rejects(
    fetchPublicNoonResource('https://www.noon.com/product', {
      resolveHost: async () => [{ address: '8.8.8.8', family: 4 }],
      fetchImpl: async () => new Response('Forbidden', {
        status: 403, headers: { 'content-type': 'text/html' },
      }),
    }),
    (error) => error.code === 'NOON_BLOCKED' && error.details.upstreamStatus === 403,
  );
});

test('Noon fetch preserves upstream 404 and 5xx status details', async () => {
  for (const status of [404, 503]) {
    await assert.rejects(
      fetchPublicNoonResource('https://www.noon.com/product', {
        resolveHost: async () => [{ address: '8.8.8.8', family: 4 }],
        fetchImpl: async () => new Response('Unavailable', {
          status, headers: { 'content-type': 'text/html' },
        }),
      }),
      (error) => error.code === 'NOON_HTTP_ERROR' && error.details.upstreamStatus === status,
    );
  }
});

test('Noon fetch classifies an aborted upstream request as a timeout', async () => {
  await assert.rejects(
    fetchPublicNoonResource('https://www.noon.com/product', {
      timeoutMs: 5,
      resolveHost: async () => [{ address: '8.8.8.8', family: 4 }],
      fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      }),
    }),
    { code: 'NOON_REQUEST_TIMEOUT' },
  );
});

test('Noon URL analysis succeeds with recognizable product evidence', async () => {
  const result = await analyzeNoonUrl('https://www.noon.com/product', {
    resolveHost: async () => [{ address: '8.8.8.8', family: 4 }],
    fetchImpl: async () => new Response(`
      <html><head><script type="application/ld+json">
        {"@type":"Product","name":"Test hub","offers":{"price":250,"priceCurrency":"EGP"}}
      </script></head><body></body></html>
    `, { status: 200, headers: { 'content-type': 'text/html' } }),
  });
  assert.equal(result.values.title, 'Test hub');
  assert.equal(result.values.currentPrice, 250);
});

test('Noon URL analysis reports an extraction failure for an empty product page', async () => {
  await assert.rejects(
    analyzeNoonUrl('https://www.noon.com/product', {
      resolveHost: async () => [{ address: '8.8.8.8', family: 4 }],
      fetchImpl: async () => new Response('<html><head><title>Noon</title></head><body></body></html>', {
        status: 200, headers: { 'content-type': 'text/html' },
      }),
    }),
    { code: 'NOON_EXTRACTION_FAILED' },
  );
});

test('Noon analyzer failures normalize to safe JSON with cause details', () => {
  const causes = [
    [new AppError(504, 'NOON_REQUEST_TIMEOUT', 'timeout'), 'timeout'],
    [new AppError(422, 'NOON_BLOCKED', 'blocked', { upstreamStatus: 403 }), 'blocked'],
    [new AppError(422, 'NOON_HTTP_ERROR', 'upstream', { upstreamStatus: 503 }), 'upstream_error'],
    [new AppError(422, 'NOON_EXTRACTION_FAILED', 'failed'), 'extraction'],
    [new Error('secret unexpected failure'), 'unexpected'],
  ];
  for (const [cause, reason] of causes) {
    const normalized = normalizeNoonAnalyzeError(cause);
    let body;
    let status;
    const response = {
      status(value) { status = value; return this; },
      json(value) { body = value; },
    };
    errorHandler(normalized, { id: 'test-request' }, response);
    assert.equal(status, normalized.statusCode);
    assert.equal(body.error.code, 'NOON_ANALYZE_FAILED');
    assert.equal(body.error.message, 'Could not analyze this Noon page.');
    assert.equal(body.error.details.reason, reason);
    assert.equal(body.error.stack, undefined);
    assert.doesNotMatch(JSON.stringify(body), /secret unexpected failure/);
  }
});

test('unexpected server errors never expose stack traces in JSON', () => {
  const previousConsoleError = console.error;
  console.error = () => {};
  try {
    let body;
    const response = { status() { return this; }, json(value) { body = value; } };
    errorHandler(new Error('sensitive failure'), { id: 'test-request' }, response);
    assert.equal(body.error.code, 'INTERNAL_SERVER_ERROR');
    assert.equal(body.error.stack, undefined);
    assert.doesNotMatch(JSON.stringify(body), /sensitive failure/);
  } finally {
    console.error = previousConsoleError;
  }
});

test('managed image inspection rejects mismatches and truncated files', () => {
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.from([0, 0, 0, 13]), Buffer.from('IHDR'),
    Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]), Buffer.alloc(4),
    Buffer.from([0, 0, 0, 0]), Buffer.from('IEND'), Buffer.alloc(4),
  ]);
  assert.equal(inspectImageBuffer(png, 'image/png'), true);
  assert.throws(() => inspectImageBuffer(png.subarray(0, 30), 'image/png'), { code: 'IMAGE_CORRUPT' });
  assert.throws(() => inspectImageBuffer(png, 'image/jpeg'), { code: 'IMAGE_CORRUPT' });
  assert.throws(() => inspectImageBuffer(png, 'image/gif'), { code: 'IMAGE_TYPE_UNSUPPORTED' });
  assert.throws(() => inspectImageBuffer(png, 'image/png', 10), { code: 'IMAGE_TOO_LARGE' });
});
