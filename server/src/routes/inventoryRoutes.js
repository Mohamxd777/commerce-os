import { Router } from 'express';
import * as inventoryController from '../controllers/inventoryController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  adjustmentCreateSchema,
  inventoryIdSchema,
  inventoryListSchema,
  inventorySummarySchema,
  movementListSchema,
  reorderRuleCreateSchema,
  reorderRuleListSchema,
  reorderRulePatchSchema,
  transferCreateSchema,
  transferListSchema,
  transferPatchSchema,
} from '../validators/inventoryValidators.js';

export const inventoryRouter = Router();

inventoryRouter.use(
  ['/inventory', '/skus', '/goods-receipts'],
  authenticate,
);

inventoryRouter.get(
  '/inventory',
  authorize('inventory.read'),
  validate(inventoryListSchema),
  asyncHandler(inventoryController.list),
);
inventoryRouter.get(
  '/inventory/summary',
  authorize('inventory.read'),
  validate(inventorySummarySchema),
  asyncHandler(inventoryController.summary),
);
inventoryRouter.get(
  '/inventory/movements',
  authorize('inventory.read'),
  validate(movementListSchema),
  asyncHandler(inventoryController.movements),
);
inventoryRouter.get(
  '/inventory/reconciliation',
  authorize('inventory.manage'),
  validate(inventorySummarySchema),
  asyncHandler(inventoryController.reconcile),
);
inventoryRouter.post(
  '/inventory/adjustments',
  authorize('inventory.adjust'),
  validate(adjustmentCreateSchema),
  asyncHandler(inventoryController.adjust),
);
inventoryRouter.get(
  '/skus/:id/inventory',
  authorize('inventory.read'),
  validate(inventoryIdSchema),
  asyncHandler(inventoryController.skuInventory),
);

inventoryRouter.get(
  '/inventory/reorder-rules',
  authorize('inventory.read'),
  validate(reorderRuleListSchema),
  asyncHandler(inventoryController.listReorderRules),
);
inventoryRouter.post(
  '/inventory/reorder-rules',
  authorize('inventory.manage'),
  validate(reorderRuleCreateSchema),
  asyncHandler(inventoryController.createReorderRule),
);
inventoryRouter.patch(
  '/inventory/reorder-rules/:id',
  authorize('inventory.manage'),
  validate(reorderRulePatchSchema),
  asyncHandler(inventoryController.patchReorderRule),
);

inventoryRouter.get(
  '/inventory/transfers',
  authorize('inventory.read'),
  validate(transferListSchema),
  asyncHandler(inventoryController.listTransfers),
);
inventoryRouter.post(
  '/inventory/transfers',
  authorize('inventory.transfer'),
  validate(transferCreateSchema),
  asyncHandler(inventoryController.createTransfer),
);
inventoryRouter.get(
  '/inventory/transfers/:id',
  authorize('inventory.read'),
  validate(inventoryIdSchema),
  asyncHandler(inventoryController.getTransfer),
);
inventoryRouter.patch(
  '/inventory/transfers/:id',
  authorize('inventory.transfer'),
  validate(transferPatchSchema),
  asyncHandler(inventoryController.patchTransfer),
);
for (const [action, controller] of [
  ['ship', inventoryController.shipTransfer],
  ['receive', inventoryController.receiveTransfer],
  ['cancel', inventoryController.cancelTransfer],
]) {
  inventoryRouter.post(
    '/inventory/transfers/:id/' + action,
    authorize('inventory.transfer'),
    validate(inventoryIdSchema),
    asyncHandler(controller),
  );
}

inventoryRouter.post(
  '/goods-receipts/:id/post-inventory',
  authorize('inventory.manage'),
  validate(inventoryIdSchema),
  asyncHandler(inventoryController.postGoodsReceipt),
);
