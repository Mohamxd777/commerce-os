import { env } from '../config/env.js';
import { pool } from '../config/database.js';
import { listUserMemberships } from '../models/membershipModel.js';
import { createSession, revokeSession } from '../models/sessionModel.js';
import { createUser, findUserByEmail } from '../models/userModel.js';
import { AppError } from '../utils/AppError.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { generateSessionToken, hashSessionToken } from '../utils/sessionToken.js';

function slugify(value) {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
  return slug || 'organization';
}

function sessionExpiry() {
  return new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);
}

async function issueSession(database, userId) {
  const token = generateSessionToken();
  const expiresAt = sessionExpiry();

  await createSession(database, {
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });

  return { token, expiresAt };
}

export async function registerOwner({ email, password, displayName, organizationName }) {
  const database = await pool.connect();

  try {
    await database.query('BEGIN');

    if (await findUserByEmail(database, email)) {
      throw new AppError(409, 'EMAIL_ALREADY_REGISTERED', 'An account already exists for this email.');
    }

    const organizationResult = await database.query(
      `INSERT INTO organizations (name, slug)
       VALUES ($1, $2)
       RETURNING id, name, slug, base_currency, status, created_at`,
      [organizationName, slugify(organizationName) + '-' + Date.now().toString(36)],
    );
    const organization = organizationResult.rows[0];

    const user = await createUser(database, {
      email,
      displayName,
      passwordHash: await hashPassword(password),
    });

    const membershipResult = await database.query(
      `INSERT INTO organization_memberships (organization_id, user_id)
       VALUES ($1, $2)
       RETURNING id`,
      [organization.id, user.id],
    );

    const roleResult = await database.query(
      `INSERT INTO membership_roles (membership_id, role_id)
       SELECT $1, id FROM roles WHERE organization_id IS NULL AND slug = 'owner'
       RETURNING role_id`,
      [membershipResult.rows[0].id],
    );

    if (roleResult.rowCount !== 1) {
      throw new Error('The built-in owner role is missing. Run database migrations first.');
    }

    const session = await issueSession(database, user.id);
    await database.query('COMMIT');

    return { user, organization, session };
  } catch (error) {
    await database.query('ROLLBACK');
    if (error.code === '23505') {
      throw new AppError(409, 'DUPLICATE_RECORD', 'A record with these details already exists.');
    }
    throw error;
  } finally {
    database.release();
  }
}

export async function login({ email, password }) {
  const user = await findUserByEmail(pool, email);
  const validPassword = user && (await verifyPassword(password, user.password_hash));

  if (!validPassword || user.status !== 'active') {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  const session = await issueSession(pool, user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      status: user.status,
    },
    session,
  };
}

export async function logout(token) {
  if (token) {
    await revokeSession(pool, hashSessionToken(token));
  }
}

export function getCurrentUser(userId) {
  return listUserMemberships(pool, userId);
}
