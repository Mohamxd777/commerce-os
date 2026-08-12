import dns from 'node:dns/promises';
import net from 'node:net';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const FIELD_NAMES = [
  'canonicalUrl', 'title', 'model', 'brand', 'currentPrice', 'originalPrice',
  'currency', 'rating', 'reviewCount', 'seller', 'noonExpress', 'recentSales',
  'bestsellerRank', 'availability', 'specifications', 'gtin', 'imageUrls', 'mainImageUrl',
];

const allowedPageHost = (hostname) => hostname === 'noon.com' || hostname.endsWith('.noon.com');
const allowedImageHost = (hostname) => allowedPageHost(hostname)
  || hostname === 'nooncdn.com' || hostname.endsWith('.nooncdn.com');

function normalizeUrl(value, baseUrl) {
  if (!value || typeof value !== 'string') return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

export function validateNoonUrl(value, { image = false } = {}) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new AppError(400, 'INVALID_NOON_URL', 'Enter a valid public Noon URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new AppError(400, 'INVALID_NOON_URL_PROTOCOL', 'Only HTTP and HTTPS Noon URLs are supported.');
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!(image ? allowedImageHost(hostname) : allowedPageHost(hostname))) {
    throw new AppError(400, 'NOON_HOST_NOT_ALLOWED', 'The URL must use a public Noon hostname.');
  }
  if (url.username || url.password) {
    throw new AppError(400, 'NOON_URL_CREDENTIALS_NOT_ALLOWED', 'Credentials are not allowed in a Noon URL.');
  }
  url.hash = '';
  return url;
}

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const parts = address.split('.').map(Number);
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 0
      || (parts[0] === 169 && parts[1] === 254)
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168)
      || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
      || parts[0] >= 224;
  }
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === '::' || normalized === '::1' || normalized.startsWith('fc')
      || normalized.startsWith('fd') || normalized.startsWith('fe8')
      || normalized.startsWith('fe9') || normalized.startsWith('fea')
      || normalized.startsWith('feb') || normalized.startsWith('ff')
      || normalized.startsWith('::ffff:127.') || normalized.startsWith('::ffff:10.')
      || normalized.startsWith('::ffff:192.168.');
  }
  return true;
}

async function assertPublicHostname(hostname, resolveHost) {
  let addresses;
  try {
    addresses = await resolveHost(hostname, { all: true, verbatim: true });
  } catch {
    throw new AppError(422, 'NOON_HOST_UNREACHABLE', 'The Noon hostname could not be resolved.');
  }
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new AppError(400, 'NOON_PRIVATE_ADDRESS_BLOCKED', 'The URL did not resolve to a public address.');
  }
}

async function readLimitedBody(response, maximumBytes) {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new AppError(413, 'NOON_RESPONSE_TOO_LARGE', 'The Noon response is larger than the configured limit.');
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new AppError(413, 'NOON_RESPONSE_TOO_LARGE', 'The Noon response is larger than the configured limit.');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

export async function fetchPublicNoonResource(value, options = {}) {
  const image = options.image ?? false;
  const fetchImpl = options.fetchImpl ?? fetch;
  const resolveHost = options.resolveHost ?? dns.lookup;
  const maximumBytes = options.maximumBytes ?? (image ? env.REMOTE_IMAGE_MAX_BYTES : env.NOON_ANALYZER_MAX_BYTES);
  const timeoutMs = options.timeoutMs ?? env.NOON_ANALYZER_TIMEOUT_MS;
  let currentUrl = validateNoonUrl(value, { image });
  const visited = new Set();

  for (let redirectCount = 0; redirectCount <= env.NOON_ANALYZER_MAX_REDIRECTS; redirectCount += 1) {
    if (visited.has(currentUrl.toString())) {
      throw new AppError(422, 'NOON_REDIRECT_LOOP', 'The Noon URL produced a redirect loop.');
    }
    visited.add(currentUrl.toString());
    await assertPublicHostname(currentUrl.hostname, resolveHost);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(currentUrl, {
        method: 'GET', redirect: 'manual', signal: controller.signal,
        headers: {
          'user-agent': env.NOON_ANALYZER_USER_AGENT,
          accept: image ? 'image/png,image/jpeg;q=0.9' : 'text/html,application/xhtml+xml;q=0.9',
        },
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new AppError(504, 'NOON_REQUEST_TIMEOUT', 'Noon did not respond within the configured timeout.');
      }
      throw new AppError(422, 'NOON_FETCH_FAILED', 'The public Noon page could not be fetched.');
    } finally {
      clearTimeout(timer);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirectCount === env.NOON_ANALYZER_MAX_REDIRECTS) {
        throw new AppError(422, 'NOON_REDIRECT_LIMIT', 'The Noon URL exceeded the redirect limit.');
      }
      currentUrl = validateNoonUrl(new URL(location, currentUrl).toString(), { image });
      continue;
    }
    if (!response.ok) {
      throw new AppError(422, 'NOON_HTTP_ERROR', 'Noon returned HTTP ' + response.status + '.');
    }
    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (image ? !['image/png', 'image/jpeg'].includes(contentType) : !['text/html', 'application/xhtml+xml'].includes(contentType)) {
      throw new AppError(422, 'NOON_UNEXPECTED_CONTENT', image
        ? 'The selected Noon image URL did not return a PNG or JPEG.'
        : 'The Noon URL did not return an HTML page.');
    }
    return { buffer: await readLimitedBody(response, maximumBytes), contentType, finalUrl: currentUrl.toString() };
  }
  throw new AppError(422, 'NOON_REDIRECT_LIMIT', 'The Noon URL exceeded the redirect limit.');
}

function decodeHtml(value) {
  return String(value ?? '').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([\da-f]+);/gi, (_match, number) => String.fromCodePoint(parseInt(number, 16)));
}

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const cleaned = decodeHtml(String(value).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  return cleaned || null;
}

function numberValue(value) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).replace(/[^\d.,-]/g, '').replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function integerValue(value) {
  const parsed = numberValue(value);
  return parsed === null ? null : Math.max(0, Math.trunc(parsed));
}

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    result[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4]);
  }
  return result;
}

function metaMap(html) {
  const result = new Map();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    const key = (attrs.property || attrs.name || attrs.itemprop || '').toLowerCase();
    if (key && attrs.content && !result.has(key)) result.set(key, attrs.content);
  }
  return result;
}

function linkValue(html, relationship) {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if ((attrs.rel || '').toLowerCase().split(/\s+/).includes(relationship) && attrs.href) return attrs.href;
  }
  return null;
}

function scriptJson(html, matcher) {
  const values = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = attributes('<script ' + match[1] + '>');
    if (!matcher(attrs)) continue;
    const source = match[2].trim();
    try {
      values.push(JSON.parse(source));
    } catch {
      try {
        values.push(JSON.parse(decodeHtml(source)));
      } catch {
        // Malformed public-page scripts are ignored and reported through missing fields.
      }
    }
  }
  return values;
}

function walk(value, visit, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  visit(value);
  for (const child of Object.values(value)) walk(child, visit, seen);
}

function productNodes(documents) {
  const nodes = [];
  for (const document of documents) {
    walk(document, (value) => {
      const type = value['@type'];
      if ((Array.isArray(type) ? type : [type]).some((item) => String(item).toLowerCase() === 'product')) nodes.push(value);
    });
  }
  return nodes;
}

function brandValue(value) {
  if (typeof value === 'string') return cleanText(value);
  return cleanText(value?.name);
}

function imageValues(value, baseUrl) {
  const raw = Array.isArray(value) ? value : [value];
  return [...new Set(raw.flatMap((item) => {
    const candidate = typeof item === 'string' ? item : item?.url || item?.contentUrl;
    const url = normalizeUrl(candidate, baseUrl);
    return url ? [url] : [];
  }))];
}

function offerValue(offers) {
  if (Array.isArray(offers)) return offers.find(Boolean) || {};
  return offers || {};
}

function add(result, field, value, source) {
  if (result[field]?.value !== null && result[field]?.value !== undefined) return;
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return;
  result[field] = { value, source, status: 'extracted' };
}

function genericEmbeddedCandidates(documents) {
  const candidates = [];
  for (const document of documents) {
    walk(document, (value) => {
      const keys = Object.keys(value).map((key) => key.toLowerCase());
      const score = ['price', 'name', 'title', 'brand', 'image', 'images', 'sku', 'product'].filter((key) => keys.includes(key)).length;
      if (score >= 3) candidates.push(value);
    });
  }
  return candidates.sort((a, b) => Object.keys(b).length - Object.keys(a).length);
}

function firstValue(object, keys) {
  for (const key of keys) {
    if (object?.[key] !== undefined && object[key] !== null) return object[key];
  }
  return null;
}

function extractSpecifications(product) {
  const specs = {};
  const properties = product?.additionalProperty;
  for (const item of Array.isArray(properties) ? properties : []) {
    const name = cleanText(item?.name);
    const value = cleanText(item?.value);
    if (name && value) specs[name] = value;
  }
  return specs;
}

export function analyzeNoonHtml(html, pageUrl, analyzedAt = new Date().toISOString()) {
  const result = Object.fromEntries(FIELD_NAMES.map((field) => [field, { value: null, source: null, status: 'not_found' }]));
  const warnings = [];
  const jsonLd = scriptJson(html, (attrs) => (attrs.type || '').toLowerCase() === 'application/ld+json');
  for (const product of productNodes(jsonLd)) {
    const offer = offerValue(product.offers);
    const priceSpecifications = Array.isArray(offer.priceSpecification)
      ? offer.priceSpecification : [offer.priceSpecification].filter(Boolean);
    const originalSpecification = priceSpecifications.find((item) =>
      /(?:list|original|strike|was)/i.test(String(item?.priceType || item?.name || '')),
    );
    const aggregate = product.aggregateRating || {};
    const images = imageValues(product.image, pageUrl);
    add(result, 'title', cleanText(product.name), 'json_ld');
    add(result, 'model', cleanText(product.model || product.mpn || product.sku), 'json_ld');
    add(result, 'brand', brandValue(product.brand || product.manufacturer), 'json_ld');
    add(result, 'currentPrice', numberValue(offer.price ?? offer.lowPrice), 'json_ld');
    add(result, 'originalPrice', numberValue(originalSpecification?.price), 'json_ld');
    add(result, 'currency', cleanText(offer.priceCurrency)?.toUpperCase(), 'json_ld');
    add(result, 'rating', numberValue(aggregate.ratingValue), 'json_ld');
    add(result, 'reviewCount', integerValue(aggregate.reviewCount ?? aggregate.ratingCount), 'json_ld');
    add(result, 'seller', brandValue(offer.seller), 'json_ld');
    add(result, 'availability', cleanText(String(offer.availability || '').split('/').pop()), 'json_ld');
    add(result, 'gtin', cleanText(product.gtin13 || product.gtin14 || product.gtin12 || product.gtin8 || product.gtin), 'json_ld');
    add(result, 'specifications', extractSpecifications(product), 'json_ld');
    add(result, 'imageUrls', images, 'json_ld');
    add(result, 'mainImageUrl', images[0], 'json_ld');
  }

  const embedded = scriptJson(html, (attrs) => {
    const id = (attrs.id || '').toLowerCase();
    return (attrs.type || '').toLowerCase() === 'application/json'
      || ['__next_data__', '__apollo_state__', '__nuxt_data__'].includes(id);
  });
  for (const product of genericEmbeddedCandidates(embedded)) {
    const price = firstValue(product, ['price', 'salePrice', 'sellingPrice', 'currentPrice', 'offerPrice']);
    const original = firstValue(product, ['originalPrice', 'oldPrice', 'wasPrice', 'priceBeforeDiscount']);
    const image = firstValue(product, ['images', 'image', 'imageUrl', 'image_url']);
    const images = imageValues(image, pageUrl);
    add(result, 'title', cleanText(firstValue(product, ['name', 'title', 'productTitle'])), 'embedded_state');
    add(result, 'model', cleanText(firstValue(product, ['model', 'modelNumber', 'sku', 'mpn'])), 'embedded_state');
    add(result, 'brand', brandValue(firstValue(product, ['brand', 'brandName', 'manufacturer'])), 'embedded_state');
    add(result, 'currentPrice', numberValue(typeof price === 'object' ? firstValue(price, ['value', 'amount']) : price), 'embedded_state');
    add(result, 'originalPrice', numberValue(typeof original === 'object' ? firstValue(original, ['value', 'amount']) : original), 'embedded_state');
    add(result, 'currency', cleanText(firstValue(product, ['currency', 'priceCurrency']))?.toUpperCase(), 'embedded_state');
    add(result, 'rating', numberValue(firstValue(product, ['rating', 'ratingValue', 'averageRating'])), 'embedded_state');
    add(result, 'reviewCount', integerValue(firstValue(product, ['reviewCount', 'reviewsCount', 'ratingCount'])), 'embedded_state');
    add(result, 'seller', cleanText(firstValue(product, ['seller', 'sellerName'])), 'embedded_state');
    add(result, 'gtin', cleanText(firstValue(product, ['gtin', 'gtin13', 'barcode'])), 'embedded_state');
    add(result, 'imageUrls', images, 'embedded_state');
    add(result, 'mainImageUrl', images[0], 'embedded_state');
  }

  const meta = metaMap(html);
  const metaImages = [meta.get('og:image'), meta.get('og:image:secure_url')]
    .map((value) => normalizeUrl(value, pageUrl)).filter(Boolean);
  add(result, 'canonicalUrl', normalizeUrl(linkValue(html, 'canonical') || meta.get('og:url'), pageUrl), 'meta');
  add(result, 'title', cleanText(meta.get('og:title') || meta.get('twitter:title')), 'meta');
  add(result, 'brand', cleanText(meta.get('product:brand')), 'meta');
  add(result, 'currentPrice', numberValue(meta.get('product:price:amount') || meta.get('og:price:amount')), 'meta');
  add(result, 'currency', cleanText(meta.get('product:price:currency') || meta.get('og:price:currency'))?.toUpperCase(), 'meta');
  add(result, 'availability', cleanText(meta.get('product:availability')), 'meta');
  add(result, 'imageUrls', metaImages, 'meta');
  add(result, 'mainImageUrl', metaImages[0], 'meta');

  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  add(result, 'title', cleanText(h1 || title), 'semantic_html');
  for (const match of html.matchAll(/<[^>]+itemprop=["']([^"']+)["'][^>]*>/gi)) {
    const attrs = attributes(match[0]);
    const key = String(attrs.itemprop).toLowerCase();
    const value = attrs.content || attrs.value || attrs.href || attrs.src;
    if (key === 'price') add(result, 'currentPrice', numberValue(value), 'semantic_html');
    if (key === 'pricecurrency') add(result, 'currency', cleanText(value)?.toUpperCase(), 'semantic_html');
    if (key === 'sku' || key === 'model') add(result, 'model', cleanText(value), 'semantic_html');
    if (key.startsWith('gtin')) add(result, 'gtin', cleanText(value), 'semantic_html');
    if (key === 'image') add(result, 'mainImageUrl', normalizeUrl(value, pageUrl), 'semantic_html');
  }

  const visibleText = cleanText(html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ')) || '';
  if (/noon\s*express|express\s*delivery/i.test(visibleText)) add(result, 'noonExpress', true, 'scoped_text');
  const recentSales = visibleText.match(/\d+[+\s]*(?:sold|bought)\s+(?:recently|in the past (?:day|week|month))/i)?.[0]
    || visibleText.match(/(?:sold|bought)\s+[^.]{0,80}(?:recently|past\s+(?:day|week|month))/i)?.[0];
  add(result, 'recentSales', cleanText(recentSales), 'scoped_text');
  const rankText = visibleText.match(/(?:#\s*\d+\s+in\s+[^.|]{1,80}|(?:best\s*seller|bestseller)s?\s+in\s+[^.|]{1,80})/i)?.[0]
    ?.split(/\b(?:Delivery Information|Get it|Order in|Faster Delivery|Add to cart)\b/i)[0];
  add(result, 'bestsellerRank', cleanText(rankText), 'scoped_text');
  if (result.canonicalUrl.value === null) add(result, 'canonicalUrl', pageUrl, 'request_url');
  if (result.specifications.value && Object.keys(result.specifications.value).length === 0) {
    result.specifications = { value: null, source: null, status: 'not_found' };
  }
  if (result.noonExpress.value === null) warnings.push('No Noon Express signal was found; this does not prove it is unavailable.');
  const notFound = FIELD_NAMES.filter((field) => result[field].status === 'not_found');
  return {
    requestedUrl: pageUrl,
    analyzedAt,
    values: Object.fromEntries(FIELD_NAMES.map((field) => [field, result[field].value])),
    fields: result,
    notFound,
    warnings,
    strategy: ['json_ld', 'embedded_state', 'meta', 'semantic_html', 'scoped_text'],
  };
}

export async function analyzeNoonUrl(value) {
  const validated = validateNoonUrl(value).toString();
  const resource = await fetchPublicNoonResource(validated);
  return analyzeNoonHtml(resource.buffer.toString('utf8'), resource.finalUrl);
}
