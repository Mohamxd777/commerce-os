import { Router } from 'express';
import * as goodsReceiptController from '../controllers/goodsReceiptController.js';
import * as locationController from '../controllers/locationController.js';
import * as purchaseOrderController from '../controllers/purchaseOrderController.js';
import * as purchasingSummaryController from '../controllers/purchasingSummaryController.js';
import * as supplierController from '../controllers/supplierController.js';
import * as supplierProductController from '../controllers/supplierProductController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  goodsReceiptCreateSchema,
  goodsReceiptIdSchema,
  goodsReceiptListSchema,
  locationCreateSchema,
  locationListSchema,
  purchaseOrderCreateSchema,
  purchaseOrderIdSchema,
  purchaseOrderListSchema,
  purchaseOrderPatchSchema,
  purchasingSummarySchema,
  skuSupplierComparisonSchema,
  supplierCreateSchema,
  supplierListSchema,
  supplierPatchSchema,
  supplierPriceSchema,
  supplierProductCreateSchema,
  supplierProductListSchema,
  supplierProductPatchSchema,
} from '../validators/purchasingValidators.js';

export const purchasingRouter = Router();

purchasingRouter.use(
  [
    '/purchasing-summary',
    '/suppliers',
    '/supplier-products',
    '/skus',
    '/purchase-orders',
    '/goods-receipts',
    '/locations',
  ],
  authenticate,
);

purchasingRouter.get(
  '/purchasing-summary',
  authorize('purchasing.read'),
  validate(purchasingSummarySchema),
  asyncHandler(purchasingSummaryController.get),
);

purchasingRouter.get(
  '/suppliers',
  authorize('purchasing.read'),
  validate(supplierListSchema),
  asyncHandler(supplierController.list),
);
purchasingRouter.post(
  '/suppliers',
  authorize('purchasing.manage'),
  validate(supplierCreateSchema),
  asyncHandler(supplierController.create),
);
purchasingRouter.get(
  '/suppliers/:id',
  authorize('purchasing.read'),
  validate(purchaseOrderIdSchema),
  asyncHandler(supplierController.get),
);
purchasingRouter.patch(
  '/suppliers/:id',
  authorize('purchasing.manage'),
  validate(supplierPatchSchema),
  asyncHandler(supplierController.patch),
);

purchasingRouter.get(
  '/supplier-products',
  authorize('purchasing.read'),
  validate(supplierProductListSchema),
  asyncHandler(supplierProductController.list),
);
purchasingRouter.post(
  '/supplier-products',
  authorize('purchasing.manage'),
  validate(supplierProductCreateSchema),
  asyncHandler(supplierProductController.create),
);
purchasingRouter.get(
  '/supplier-products/:id',
  authorize('purchasing.read'),
  validate(purchaseOrderIdSchema),
  asyncHandler(supplierProductController.get),
);
purchasingRouter.patch(
  '/supplier-products/:id',
  authorize('purchasing.manage'),
  validate(supplierProductPatchSchema),
  asyncHandler(supplierProductController.patch),
);
purchasingRouter.post(
  '/supplier-products/:id/price',
  authorize('purchasing.manage'),
  validate(supplierPriceSchema),
  asyncHandler(supplierProductController.updatePrice),
);
purchasingRouter.get(
  '/skus/:id/suppliers',
  authorize('purchasing.read'),
  validate(skuSupplierComparisonSchema),
  asyncHandler(supplierProductController.compareSkuSuppliers),
);

purchasingRouter.get(
  '/purchase-orders',
  authorize('purchasing.read'),
  validate(purchaseOrderListSchema),
  asyncHandler(purchaseOrderController.list),
);
purchasingRouter.post(
  '/purchase-orders',
  authorize('purchasing.manage'),
  validate(purchaseOrderCreateSchema),
  asyncHandler(purchaseOrderController.create),
);
purchasingRouter.get(
  '/purchase-orders/:id',
  authorize('purchasing.read'),
  validate(purchaseOrderIdSchema),
  asyncHandler(purchaseOrderController.get),
);
purchasingRouter.patch(
  '/purchase-orders/:id',
  authorize('purchasing.manage'),
  validate(purchaseOrderPatchSchema),
  asyncHandler(purchaseOrderController.patch),
);
purchasingRouter.post(
  '/purchase-orders/:id/approve',
  authorize('purchasing.approve'),
  validate(purchaseOrderIdSchema),
  asyncHandler(purchaseOrderController.approve),
);
purchasingRouter.post(
  '/purchase-orders/:id/mark-ordered',
  authorize('purchasing.approve'),
  validate(purchaseOrderIdSchema),
  asyncHandler(purchaseOrderController.markOrdered),
);
purchasingRouter.post(
  '/purchase-orders/:id/cancel',
  authorize('purchasing.manage'),
  validate(purchaseOrderIdSchema),
  asyncHandler(purchaseOrderController.cancel),
);
purchasingRouter.post(
  '/purchase-orders/:id/receipts',
  authorize('purchasing.receive'),
  validate(goodsReceiptCreateSchema),
  asyncHandler(goodsReceiptController.create),
);

purchasingRouter.get(
  '/goods-receipts',
  authorize('purchasing.read'),
  validate(goodsReceiptListSchema),
  asyncHandler(goodsReceiptController.list),
);
purchasingRouter.get(
  '/goods-receipts/:id',
  authorize('purchasing.read'),
  validate(goodsReceiptIdSchema),
  asyncHandler(goodsReceiptController.get),
);

purchasingRouter.get(
  '/locations',
  authorize('locations.read'),
  validate(locationListSchema),
  asyncHandler(locationController.list),
);
purchasingRouter.post(
  '/locations',
  authorize('locations.manage'),
  validate(locationCreateSchema),
  asyncHandler(locationController.create),
);
