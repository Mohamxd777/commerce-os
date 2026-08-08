import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authenticationRateLimiter } from '../middleware/rateLimiters.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { loginSchema, registerSchema } from '../validators/authValidators.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  authenticationRateLimiter,
  validate(registerSchema),
  asyncHandler(authController.register),
);
authRouter.post(
  '/login',
  authenticationRateLimiter,
  validate(loginSchema),
  asyncHandler(authController.login),
);
authRouter.post('/logout', authenticate, asyncHandler(authController.logout));
authRouter.get('/me', authenticate, asyncHandler(authController.me));
