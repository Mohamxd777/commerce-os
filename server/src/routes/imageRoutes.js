import express, { Router } from 'express';
import { env } from '../config/env.js';
import * as imageController from '../controllers/imageController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { imageContentSchema, imageLinkSchema, imageListSchema, imageRemoveSchema, noonImageImportSchema } from '../validators/imageValidators.js';

export const imageRouter = Router();

imageRouter.use('/images', authenticate);
imageRouter.get('/images', authorize('research.read'), validate(imageListSchema), asyncHandler(imageController.list));
imageRouter.get('/images/:id/content', (request, _response, next) => {
  if (!request.header('x-organization-id') && request.query.organizationId) {
    request.headers['x-organization-id'] = request.query.organizationId;
  }
  next();
}, authorize('research.read'), validate(imageContentSchema), asyncHandler(imageController.content));
imageRouter.post(
  '/images/upload', authorize('research.manage'),
  express.raw({ type: ['image/png', 'image/jpeg'], limit: env.IMAGE_UPLOAD_MAX_BYTES }),
  asyncHandler(imageController.upload),
);
imageRouter.post('/images/import-noon', authorize('research.manage'), express.json({ limit: '100kb' }), validate(noonImageImportSchema), asyncHandler(imageController.importNoon));
imageRouter.patch('/images/:id/primary', authorize('research.manage'), validate(imageLinkSchema), asyncHandler(imageController.primary));
imageRouter.delete('/images/:id', authorize('research.manage'), validate(imageRemoveSchema), asyncHandler(imageController.remove));
