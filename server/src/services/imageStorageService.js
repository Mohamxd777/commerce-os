import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { pool } from '../config/database.js';
import { env } from '../config/env.js';
import * as imageModel from '../models/imageModel.js';
import { AppError } from '../utils/AppError.js';
import { fetchPublicNoonResource } from './noonAnalyzerService.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanFilename(filename) {
  const base = path.basename(String(filename || '').replaceAll('\\', '/')).replace(/[^\p{L}\p{N}._ -]/gu, '_').trim();
  if (!base || base === '.' || base === '..') throw new AppError(400, 'IMAGE_FILENAME_INVALID', 'A valid image filename is required.');
  return base.slice(0, 255);
}

function extensionFor(mimeType) {
  return mimeType === 'image/png' ? '.png' : '.jpg';
}

function assertExtension(filename, mimeType) {
  const extension = path.extname(filename).toLowerCase();
  const valid = mimeType === 'image/png' ? extension === '.png' : ['.jpg', '.jpeg'].includes(extension);
  if (!valid) throw new AppError(400, 'IMAGE_EXTENSION_MISMATCH', 'The filename extension does not match the image type.');
}

function inspectPng(buffer) {
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
  let offset = 8;
  let sawHeader = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > buffer.length) return false;
    if (type === 'IHDR') {
      if (length !== 13 || buffer.readUInt32BE(offset + 8) === 0 || buffer.readUInt32BE(offset + 12) === 0) return false;
      sawHeader = true;
    }
    if (type === 'IEND') return sawHeader && length === 0 && end === buffer.length;
    offset = end;
  }
  return false;
}

function inspectJpeg(buffer) {
  if (buffer.length < 12 || buffer[0] !== 0xff || buffer[1] !== 0xd8
    || buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) return false;
  let offset = 2;
  let hasDimensions = false;
  while (offset < buffer.length - 2) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) return false;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return false;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 7 || buffer.readUInt16BE(offset + 3) === 0 || buffer.readUInt16BE(offset + 5) === 0) return false;
      hasDimensions = true;
    }
    offset += length;
  }
  return hasDimensions;
}

export function inspectImageBuffer(buffer, mimeType, maximumBytes = env.IMAGE_UPLOAD_MAX_BYTES) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new AppError(400, 'IMAGE_EMPTY', 'The image file is empty.');
  if (buffer.length > maximumBytes) throw new AppError(413, 'IMAGE_TOO_LARGE', 'The image exceeds the configured size limit.');
  if (!['image/png', 'image/jpeg'].includes(mimeType)) throw new AppError(415, 'IMAGE_TYPE_UNSUPPORTED', 'Only PNG and JPEG images are supported.');
  const valid = mimeType === 'image/png' ? inspectPng(buffer) : inspectJpeg(buffer);
  if (!valid) throw new AppError(400, 'IMAGE_CORRUPT', 'The file is not a complete, valid ' + (mimeType === 'image/png' ? 'PNG' : 'JPEG') + ' image.');
  return true;
}

function absoluteStoragePath(relativePath) {
  const root = path.resolve(env.LOCAL_DATA_DIR);
  const absolute = path.resolve(root, relativePath);
  if (absolute === root || !absolute.startsWith(root + path.sep)) {
    throw new AppError(500, 'IMAGE_PATH_INVALID', 'The managed image path is invalid.');
  }
  return absolute;
}

async function persistImage(input) {
  if (!uuidPattern.test(input.organizationId) || !uuidPattern.test(input.entityId)
    || !imageModel.ENTITY_TABLES[input.entityType]) {
    throw new AppError(400, 'IMAGE_ENTITY_INVALID', 'Choose a valid supported image record.');
  }
  const originalFilename = cleanFilename(input.filename);
  assertExtension(originalFilename, input.mimeType);
  inspectImageBuffer(input.buffer, input.mimeType, input.maximumBytes);
  const exists = await imageModel.entityExists(pool, input);
  if (!exists) throw new AppError(404, 'IMAGE_ENTITY_NOT_FOUND', 'The image record was not found in this organization.');

  const storedFilename = randomUUID() + extensionFor(input.mimeType);
  const relativePath = path.join('images', input.organizationId, storedFilename);
  const absolutePath = absoluteStoragePath(relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.buffer, { flag: 'wx' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const image = await imageModel.createImage(client, {
      ...input, originalFilename, storedFilename, relativePath, byteSize: input.buffer.length,
    });
    const link = await imageModel.createLink(client, { ...input, imageId: image.id });
    await client.query('COMMIT');
    return { ...image, entity_type: input.entityType, entity_id: input.entityId, is_primary: link.is_primary };
  } catch (error) {
    await client.query('ROLLBACK');
    await unlink(absolutePath).catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export function uploadImage(organizationId, userId, input) {
  return persistImage({ ...input, organizationId, userId, source: 'upload', maximumBytes: env.IMAGE_UPLOAD_MAX_BYTES });
}

export async function importNoonImages(organizationId, userId, input) {
  const imported = [];
  const errors = [];
  for (const sourceUrl of [...new Set(input.urls)].slice(0, 12)) {
    try {
      const resource = await fetchPublicNoonResource(sourceUrl, { image: true, maximumBytes: env.REMOTE_IMAGE_MAX_BYTES });
      const filename = 'noon-' + randomUUID() + extensionFor(resource.contentType);
      imported.push(await persistImage({
        organizationId, userId, entityType: input.entityType, entityId: input.entityId,
        filename, mimeType: resource.contentType, buffer: resource.buffer,
        source: 'noon_import', sourceUrl: resource.finalUrl,
        isPrimary: input.primaryUrl === sourceUrl, maximumBytes: env.REMOTE_IMAGE_MAX_BYTES,
      }));
    } catch (error) {
      errors.push({ url: sourceUrl, code: error.code || 'IMAGE_IMPORT_FAILED', message: error.message });
    }
  }
  return { imported, errors };
}

export async function listImages(organizationId, input) {
  if (!uuidPattern.test(input.entityId) || !imageModel.ENTITY_TABLES[input.entityType]) {
    throw new AppError(400, 'IMAGE_ENTITY_INVALID', 'Choose a valid supported image record.');
  }
  const exists = await imageModel.entityExists(pool, { organizationId, ...input });
  if (!exists) throw new AppError(404, 'IMAGE_ENTITY_NOT_FOUND', 'The image record was not found in this organization.');
  return imageModel.listEntityImages(pool, { organizationId, ...input });
}

export async function getImageContent(organizationId, imageId) {
  const image = await imageModel.findImage(pool, { organizationId, imageId });
  if (!image) throw new AppError(404, 'IMAGE_NOT_FOUND', 'Image not found.');
  return { ...image, absolutePath: absoluteStoragePath(image.relative_path) };
}

export async function markPrimary(organizationId, imageId, input) {
  const image = await imageModel.setPrimary(pool, { organizationId, imageId, ...input });
  if (!image) throw new AppError(404, 'IMAGE_LINK_NOT_FOUND', 'Image association not found.');
  return image;
}

export async function removeImage(organizationId, imageId, input) {
  const client = await pool.connect();
  let result;
  try {
    await client.query('BEGIN');
    result = await imageModel.removeLink(client, { organizationId, imageId, ...input });
    if (!result) throw new AppError(404, 'IMAGE_LINK_NOT_FOUND', 'Image association not found.');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  if (result.deleteFile && result.relativePath) await unlink(absoluteStoragePath(result.relativePath)).catch(() => {});
  return { removed: true, physicalFileDeleted: result.deleteFile };
}

