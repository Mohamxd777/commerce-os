export async function updateCatalogRecord(
  database,
  { table, id, organizationId, changes, returning = '*' },
) {
  const entries = Object.entries(changes);

  if (entries.length === 0) {
    return null;
  }

  const values = entries.map(([, value]) => value);
  const assignments = entries.map(
    ([column], index) => column + ' = $' + (index + 1),
  );
  values.push(id, organizationId);

  const sql =
    'UPDATE ' + table +
    ' SET ' + assignments.join(', ') +
    ' WHERE id = $' + (values.length - 1) +
    ' AND organization_id = $' + values.length +
    ' RETURNING ' + returning;

  const result = await database.query(sql, values);
  return result.rows[0] ?? null;
}

export function paginationMetadata(total, page, limit) {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
