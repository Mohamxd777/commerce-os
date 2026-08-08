import { Router } from 'express';
import * as brandController from '../controllers/brandController.js';
import * as categoryController from '../controllers/categoryController.js';
import * as productController from '../controllers/productController.js';
import * as skuController from '../controllers/skuController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  brandCreateSchema,
  brandListSchema,
  brandPatchSchema,
  categoryCreateSchema,
  categoryListSchema,
  categoryPatchSchema,
  idParamSchema,
  productCreateSchema,
  productListSchema,
  productPatchSchema,
  skuCreateSchema,
  skuListSchema,
  skuPatchSchema,
} from '../validators/catalogValidators.js';

function catalogRouter({ listSchema, createSchema, patchSchema, controller }) {
  const router = Router();

  router.use(authenticate);
  router.get(
    '/',
    authorize('catalog.read'),
    validate(listSchema),
    asyncHandler(controller.list),
  );
  router.post(
    '/',
    authorize('catalog.manage'),
    validate(createSchema),
    asyncHandler(controller.create),
  );
  router.get(
    '/:id',
    authorize('catalog.read'),
    validate(idParamSchema),
    asyncHandler(controller.get),
  );
  router.patch(
    '/:id',
    authorize('catalog.manage'),
    validate(patchSchema),
    asyncHandler(controller.patch),
  );

  return router;
}

export const brandRouter = catalogRouter({
  listSchema: brandListSchema,
  createSchema: brandCreateSchema,
  patchSchema: brandPatchSchema,
  controller: brandController,
});

export const categoryRouter = catalogRouter({
  listSchema: categoryListSchema,
  createSchema: categoryCreateSchema,
  patchSchema: categoryPatchSchema,
  controller: categoryController,
});

export const productRouter = catalogRouter({
  listSchema: productListSchema,
  createSchema: productCreateSchema,
  patchSchema: productPatchSchema,
  controller: productController,
});

export const skuRouter = catalogRouter({
  listSchema: skuListSchema,
  createSchema: skuCreateSchema,
  patchSchema: skuPatchSchema,
  controller: skuController,
});
