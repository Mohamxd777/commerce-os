export async function listLocations(
  database,
  { organizationId, search, status, page, limit },
) {
  const parameters = [
    organizationId,
    search ? '%' + search + '%' : null,
    status ?? null,
  ];
  const countResult = await database.query(
    `SELECT COUNT(*)::int AS total
     FROM locations
     WHERE organization_id = $1
       AND ($2::text IS NULL OR name ILIKE $2 OR code ILIKE $2)
       AND ($3::text IS NULL OR status = $3)`,
    parameters,
  );
  const result = await database.query(
    `SELECT id, organization_id, name, code, location_type, city,
            governorate, country_code, timezone, status,
            created_at, updated_at
     FROM locations
     WHERE organization_id = $1
       AND ($2::text IS NULL OR name ILIKE $2 OR code ILIKE $2)
       AND ($3::text IS NULL OR status = $3)
     ORDER BY status = 'active' DESC, name, id
     LIMIT $4 OFFSET $5`,
    [...parameters, limit, (page - 1) * limit],
  );
  return { rows: result.rows, total: countResult.rows[0].total };
}

export async function createLocation(database, input) {
  const result = await database.query(
    `INSERT INTO locations (
       organization_id, name, code, location_type, city,
       governorate, country_code, timezone, status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
     RETURNING id, organization_id, name, code, location_type, city,
               governorate, country_code, timezone, status,
               created_at, updated_at`,
    [
      input.organizationId,
      input.name,
      input.code,
      input.locationType,
      input.city ?? null,
      input.governorate ?? null,
      input.countryCode,
      input.timezone,
    ],
  );
  return result.rows[0];
}
