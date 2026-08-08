export async function createSession(database, { userId, tokenHash, expiresAt }) {
  const result = await database.query(
    `INSERT INTO user_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, expires_at`,
    [userId, tokenHash, expiresAt],
  );
  return result.rows[0];
}

export async function findActiveSession(database, tokenHash) {
  const result = await database.query(
    `SELECT
       sessions.id AS session_id,
       sessions.expires_at,
       users.id,
       users.email,
       users.display_name,
       users.status
     FROM user_sessions AS sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = $1
       AND sessions.revoked_at IS NULL
       AND sessions.expires_at > NOW()
       AND users.status = 'active'`,
    [tokenHash],
  );
  return result.rows[0] ?? null;
}

export async function revokeSession(database, tokenHash) {
  await database.query(
    `UPDATE user_sessions
     SET revoked_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash],
  );
}
