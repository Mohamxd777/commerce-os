export async function listUserMemberships(database, userId) {
  const result = await database.query(
    `SELECT
       memberships.id,
       organizations.id AS organization_id,
       organizations.name AS organization_name,
       organizations.slug AS organization_slug,
       memberships.status,
       COALESCE(
         jsonb_agg(DISTINCT roles.slug) FILTER (WHERE roles.id IS NOT NULL),
         '[]'::jsonb
       ) AS roles,
       COALESCE(
         jsonb_agg(DISTINCT permissions.code) FILTER (WHERE permissions.id IS NOT NULL),
         '[]'::jsonb
       ) AS permissions
     FROM organization_memberships AS memberships
     JOIN organizations ON organizations.id = memberships.organization_id
     LEFT JOIN membership_roles ON membership_roles.membership_id = memberships.id
     LEFT JOIN roles ON roles.id = membership_roles.role_id
     LEFT JOIN role_permissions ON role_permissions.role_id = roles.id
     LEFT JOIN permissions ON permissions.id = role_permissions.permission_id
     WHERE memberships.user_id = $1
       AND memberships.status = 'active'
       AND organizations.status = 'active'
     GROUP BY memberships.id, organizations.id
     ORDER BY organizations.name`,
    [userId],
  );
  return result.rows;
}
