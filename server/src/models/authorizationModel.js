export async function userHasPermission(database, { userId, organizationId, permissionCode }) {
  const result = await database.query(
    `SELECT EXISTS (
       SELECT 1
       FROM organization_memberships AS memberships
       JOIN membership_roles ON membership_roles.membership_id = memberships.id
       JOIN role_permissions ON role_permissions.role_id = membership_roles.role_id
       JOIN permissions ON permissions.id = role_permissions.permission_id
       WHERE memberships.user_id = $1
         AND memberships.organization_id = $2
         AND memberships.status = 'active'
         AND permissions.code = $3
     ) AS allowed`,
    [userId, organizationId, permissionCode],
  );
  return result.rows[0].allowed;
}
