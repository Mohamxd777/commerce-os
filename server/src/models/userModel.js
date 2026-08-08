export async function findUserByEmail(database, email) {
  const result = await database.query(
    `SELECT id, email, display_name, password_hash, status, created_at, updated_at
     FROM users
     WHERE email = $1`,
    [email],
  );
  return result.rows[0] ?? null;
}

export async function createUser(database, { email, displayName, passwordHash }) {
  const result = await database.query(
    `INSERT INTO users (email, display_name, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, email, display_name, status, created_at, updated_at`,
    [email, displayName, passwordHash],
  );
  return result.rows[0];
}
