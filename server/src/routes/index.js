import { Router } from 'express';
import { query } from '../config/database.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authRouter } from './authRoutes.js';

export const apiRouter = Router();

apiRouter.get('/health', (_request, response) => {
  response.json({
    data: {
      service: 'commerce-os-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  });
});

apiRouter.get(
  '/health/database',
  asyncHandler(async (_request, response) => {
    await query('SELECT 1');
    response.json({
      data: {
        database: 'postgresql',
        status: 'ok',
        timestamp: new Date().toISOString(),
      },
    });
  }),
);

apiRouter.use('/auth', authRouter);
