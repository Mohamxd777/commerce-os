import { env } from '../config/env.js';
import * as authService from '../services/authService.js';

function cookieOptions(expiresAt) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  };
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    status: user.status,
    createdAt: user.created_at,
  };
}

export async function register(request, response) {
  const result = await authService.registerOwner(request.validated.body);

  response.cookie(env.COOKIE_NAME, result.session.token, cookieOptions(result.session.expiresAt));
  response.status(201).json({
    data: {
      user: publicUser(result.user),
      organization: result.organization,
    },
  });
}

export async function login(request, response) {
  const result = await authService.login(request.validated.body);

  response.cookie(env.COOKIE_NAME, result.session.token, cookieOptions(result.session.expiresAt));
  response.json({ data: { user: publicUser(result.user) } });
}

export async function logout(request, response) {
  await authService.logout(request.cookies[env.COOKIE_NAME]);
  response.clearCookie(env.COOKIE_NAME, cookieOptions());
  response.status(204).end();
}

export async function me(request, response) {
  const memberships = await authService.getCurrentUser(request.user.id);
  response.json({
    data: {
      user: request.user,
      memberships,
    },
  });
}
