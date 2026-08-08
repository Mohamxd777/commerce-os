import { env } from '../config/env.js';
import { pool } from '../config/database.js';
import { findActiveSession } from '../models/sessionModel.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { hashSessionToken } from '../utils/sessionToken.js';

export const authenticate = asyncHandler(async (request, _response, next) => {
  const token = request.cookies[env.COOKIE_NAME];

  if (!token) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Please sign in to continue.');
  }

  const session = await findActiveSession(pool, hashSessionToken(token));

  if (!session) {
    throw new AppError(401, 'INVALID_SESSION', 'Your session is invalid or has expired.');
  }

  request.user = {
    id: session.id,
    email: session.email,
    displayName: session.display_name,
  };
  request.session = {
    id: session.session_id,
    expiresAt: session.expires_at,
  };
  next();
});
