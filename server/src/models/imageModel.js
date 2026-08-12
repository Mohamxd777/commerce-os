export const ENTITY_TABLES = Object.freeze({
  candidate: 'product_candidates',
  supplier_option: 'candidate_supplier_options',
  sample: 'product_samples',
  marketplace_observation: 'product_candidate_market_snapshots',
});

export async function entityExists(database, { organizationId, entityType, entityId }) {
  const table = ENTITY_TABLES[entityType];
  if (!table) return false;
  const result = await database.query(
    `SELECT 1 FROM ${table} WHERE organization_id = $1 AND id = $2`,
    [organizationId, entityId],
  );
  return result.rowCount > 0;
}

export async function createImage(database, input) {
  const result = await database.query(
    `INSERT INTO local_images (
       organization_id, relative_path, original_filename, stored_filename,
       mime_type, byte_size, source, source_url, created_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [input.organizationId, input.relativePath, input.originalFilename, input.storedFilename,
      input.mimeType, input.byteSize, input.source, input.sourceUrl ?? null, input.userId],
  );
  return result.rows[0];
}

export async function createLink(database, input) {
  const existing = await database.query(
    `SELECT COUNT(*)::int AS count FROM local_image_links
     WHERE organization_id = $1 AND entity_type = $2 AND entity_id = $3`,
    [input.organizationId, input.entityType, input.entityId],
  );
  const makePrimary = input.isPrimary || existing.rows[0].count === 0;
  if (makePrimary) {
    await database.query(
      `UPDATE local_image_links SET is_primary = FALSE
       WHERE organization_id = $1 AND entity_type = $2 AND entity_id = $3`,
      [input.organizationId, input.entityType, input.entityId],
    );
  }
  const result = await database.query(
    `INSERT INTO local_image_links (
       organization_id, image_id, entity_type, entity_id, is_primary, created_by
     ) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [input.organizationId, input.imageId, input.entityType, input.entityId, makePrimary, input.userId],
  );
  return result.rows[0];
}

export async function listEntityImages(database, input) {
  const result = await database.query(
    `SELECT image.id, image.original_filename, image.mime_type, image.byte_size,
            image.source, image.source_url, image.created_at,
            link.entity_type, link.entity_id, link.is_primary
     FROM local_image_links AS link
     JOIN local_images AS image
       ON image.id = link.image_id AND image.organization_id = link.organization_id
     WHERE link.organization_id = $1 AND link.entity_type = $2 AND link.entity_id = $3
     ORDER BY link.is_primary DESC, link.created_at, image.id`,
    [input.organizationId, input.entityType, input.entityId],
  );
  return result.rows;
}

export async function findImage(database, { organizationId, imageId }) {
  const result = await database.query(
    `SELECT * FROM local_images WHERE organization_id = $1 AND id = $2`,
    [organizationId, imageId],
  );
  return result.rows[0] ?? null;
}

export async function setPrimary(database, input) {
  const target = await database.query(
    `SELECT 1 FROM local_image_links
     WHERE organization_id = $1 AND image_id = $2 AND entity_type = $3 AND entity_id = $4`,
    [input.organizationId, input.imageId, input.entityType, input.entityId],
  );
  if (target.rowCount === 0) return null;
  await database.query(
    `UPDATE local_image_links SET is_primary = (image_id = $2)
     WHERE organization_id = $1 AND entity_type = $3 AND entity_id = $4`,
    [input.organizationId, input.imageId, input.entityType, input.entityId],
  );
  return findImage(database, { organizationId: input.organizationId, imageId: input.imageId });
}

export async function removeLink(database, input) {
  const removed = await database.query(
    `DELETE FROM local_image_links
     WHERE organization_id = $1 AND image_id = $2 AND entity_type = $3 AND entity_id = $4
     RETURNING is_primary`,
    [input.organizationId, input.imageId, input.entityType, input.entityId],
  );
  if (removed.rowCount === 0) return null;
  const remainingForEntity = await database.query(
    `SELECT id FROM local_image_links
     WHERE organization_id = $1 AND entity_type = $2 AND entity_id = $3
     ORDER BY created_at, id LIMIT 1`,
    [input.organizationId, input.entityType, input.entityId],
  );
  if (removed.rows[0].is_primary && remainingForEntity.rowCount > 0) {
    await database.query('UPDATE local_image_links SET is_primary = TRUE WHERE id = $1', [remainingForEntity.rows[0].id]);
  }
  const remainingLinks = await database.query(
    'SELECT COUNT(*)::int AS count FROM local_image_links WHERE organization_id = $1 AND image_id = $2',
    [input.organizationId, input.imageId],
  );
  if (remainingLinks.rows[0].count > 0) return { deleteFile: false };
  const image = await database.query(
    `DELETE FROM local_images WHERE organization_id = $1 AND id = $2 RETURNING relative_path`,
    [input.organizationId, input.imageId],
  );
  return { deleteFile: true, relativePath: image.rows[0]?.relative_path };
}

