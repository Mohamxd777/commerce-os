import { updateCatalogRecord } from './catalogModelHelpers.js';

const categoryTree = `WITH RECURSIVE category_tree AS (
  SELECT category.id, category.organization_id, category.parent_id, category.name,
         category.normalized_name, category.description, category.is_active,
         category.created_at, category.updated_at, 0 AS depth,
         ARRAY[category.name::text] AS path_parts
  FROM categories AS category
  WHERE category.organization_id = $1
    AND category.parent_id IS NULL

  UNION ALL

  SELECT child.id, child.organization_id, child.parent_id, child.name,
         child.normalized_name, child.description, child.is_active,
         child.created_at, child.updated_at, parent.depth + 1,
         parent.path_parts || child.name::text
  FROM categories AS child
  JOIN category_tree AS parent
    ON parent.id = child.parent_id
   AND parent.organization_id = child.organization_id
)`;

export async function listCategories(
  database,
  { organizationId, search, isActive, page, limit },
) {
  const searchPattern = search ? '%' + search + '%' : null;
  const offset = (page - 1) * limit;
  const parameters = [organizationId, searchPattern, isActive ?? null];

  const countResult = await database.query(
    categoryTree +
      `
      SELECT COUNT(*)::int AS total
      FROM category_tree
      WHERE ($2::text IS NULL OR name ILIKE $2)
        AND ($3::boolean IS NULL OR is_active = $3)`,
    parameters,
  );

  const result = await database.query(
    categoryTree +
      `
      SELECT id, organization_id, parent_id, name, normalized_name, description,
             is_active, created_at, updated_at, depth,
             ARRAY_TO_STRING(path_parts, ' > ') AS path
      FROM category_tree
      WHERE ($2::text IS NULL OR name ILIKE $2)
        AND ($3::boolean IS NULL OR is_active = $3)
      ORDER BY path_parts
      LIMIT $4 OFFSET $5`,
    [...parameters, limit, offset],
  );

  return {
    rows: result.rows,
    total: countResult.rows[0].total,
  };
}

export async function findCategoryById(database, { organizationId, id }) {
  const result = await database.query(
    `SELECT category.id, category.organization_id, category.parent_id,
            category.name, category.normalized_name, category.description,
            category.is_active, category.created_at, category.updated_at,
            parent.name AS parent_name
     FROM categories AS category
     LEFT JOIN categories AS parent
       ON parent.id = category.parent_id
      AND parent.organization_id = category.organization_id
     WHERE category.id = $1
       AND category.organization_id = $2`,
    [id, organizationId],
  );
  return result.rows[0] ?? null;
}

export async function wouldCreateCategoryCycle(
  database,
  { organizationId, categoryId, proposedParentId },
) {
  const result = await database.query(
    `WITH RECURSIVE ancestors AS (
       SELECT id, parent_id
       FROM categories
       WHERE id = $1 AND organization_id = $2

       UNION ALL

       SELECT parent.id, parent.parent_id
       FROM categories AS parent
       JOIN ancestors ON ancestors.parent_id = parent.id
       WHERE parent.organization_id = $2
     )
     SELECT EXISTS (
       SELECT 1 FROM ancestors WHERE id = $3
     ) AS creates_cycle`,
    [proposedParentId, organizationId, categoryId],
  );
  return result.rows[0].creates_cycle;
}

export async function createCategory(
  database,
  { organizationId, parentId, name, description, isActive },
) {
  const result = await database.query(
    `INSERT INTO categories (
       organization_id, parent_id, name, description, is_active
     )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, organization_id, parent_id, name, normalized_name,
               description, is_active, created_at, updated_at`,
    [organizationId, parentId ?? null, name, description ?? null, isActive],
  );
  return result.rows[0];
}

export function updateCategory(database, { organizationId, id, changes }) {
  return updateCatalogRecord(database, {
    table: 'categories',
    organizationId,
    id,
    changes,
    returning: `id, organization_id, parent_id, name, normalized_name,
                description, is_active, created_at, updated_at`,
  });
}
