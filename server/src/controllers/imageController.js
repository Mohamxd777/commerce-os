import path from 'node:path';
import * as imageStorageService from '../services/imageStorageService.js';

function entityInput(request) {
  return {
    entityType: request.query.entityType || request.body?.entityType || request.header('x-image-entity-type'),
    entityId: request.query.entityId || request.body?.entityId || request.header('x-image-entity-id'),
  };
}

function uploadFilename(request) {
  const value = request.header('x-file-name');
  try { return decodeURIComponent(value); } catch { return value; }
}

export async function upload(request, response) {
  const input = entityInput(request);
  const result = await imageStorageService.uploadImage(request.organizationId, request.user.id, {
    ...input, buffer: request.body, mimeType: request.header('content-type')?.split(';')[0],
    filename: uploadFilename(request), isPrimary: request.header('x-image-primary') === 'true',
  });
  response.status(201).json({ data: result });
}

export async function importNoon(request, response) {
  const result = await imageStorageService.importNoonImages(
    request.organizationId, request.user.id, request.validated.body,
  );
  response.status(207).json({ data: result });
}

export async function list(request, response) {
  response.json({ data: await imageStorageService.listImages(request.organizationId, request.validated.query) });
}

export async function content(request, response) {
  const image = await imageStorageService.getImageContent(request.organizationId, request.params.id);
  response.type(image.mime_type);
  response.setHeader('content-disposition', 'inline; filename="' + path.basename(image.original_filename).replaceAll('"', '') + '"');
  response.sendFile(image.absolutePath);
}

export async function primary(request, response) {
  const result = await imageStorageService.markPrimary(
    request.organizationId, request.validated.params.id, request.validated.body,
  );
  response.json({ data: result });
}

export async function remove(request, response) {
  const result = await imageStorageService.removeImage(
    request.organizationId, request.validated.params.id, request.validated.query,
  );
  response.json({ data: result });
}
