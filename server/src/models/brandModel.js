import { updateCatalogRecord } from './catalogModelHelpers.js';

export async function listBrands(
  database,
  { organizationId, search, isActive, page, limit },
) {
  const searchPattern = search ? '%' + search + '%' : null;
  const offset = (page - 1) * limit;
  const parameters = [organizationId, searchPattern, isActive ?? null];

  const countResult = await database.query(
    `SELECT COUNT(*)::int AS total
     FROM brands
     WHERE organization_id = $1
       AND ($2::text IS NULL OR name ILIKE $2)
       AND ($3::boolean IS NULL OR is_active = $3)`,
    parameters,
  );

  const result = await database.query(
    `SELECT id, organization_id, name, normalized_name, website_url, notes,
            is_active, created_at, updated_at
     FROM brands
     WHERE organization_id = $1
       AND ($2::text IS NULL OR name ILIKE $2)
       AND ($3::boolean IS NULL OR is_active = $3)
     ORDER BY is_active DESC, name, id
     LIMIT $4 OFFSET $5`,
    [...parameters, limit, offset],
  );

  return {
    rows: result.rows,
    total: countResult.rows[0].total,
  };
}

export async function findBrandById(database, { organizationId, id }) {
  const result = await database.query(
    `SELECT id, organization_id, name, normalized_name, website_url, notes,
            is_active, created_at, updated_at
     FROM brands
     WHERE id = $1 AND organization_id = $2`,
    [id, organizationId],
  );
  return result.rows[0] ?? null;
}

export async function createBrand(
  database,
  { organizationId, name, websiteUrl, notes, isActive },
) {
  const result = await database.query(
    `INSERT INTO brands (organization_id, name, website_url, notes, is_active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, organization_id, name, normalized_name, website_url, notes,
               is_active, created_at, updated_at`,
    [organizationId, name, websiteUrl ?? null, notes ?? null, isActive],
  );
  return result.rows[0];
}

export function updateBrand(database, { organizationId, id, changes }) {
  return updateCatalogRecord(database, {
    table: 'brands',
    organizationId,
    id,
    changes,
    returning: `id, organization_id, name, normalized_name, website_url, notes,
                is_active, created_at, updated_at`,
  });
}
