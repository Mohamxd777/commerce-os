import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeNoonHtml, fetchPublicNoonResource, validateNoonUrl } from '../src/services/noonAnalyzerService.js';
import { inspectImageBuffer } from '../src/services/imageStorageService.js';

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

