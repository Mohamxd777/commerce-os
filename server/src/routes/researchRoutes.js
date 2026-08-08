import { Router } from 'express';
import * as researchController from '../controllers/researchController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  candidateCreateSchema, candidateListSchema, candidatePatchSchema,
  comparisonSchema, createProductFromCandidateSchema, economicsCreateSchema,
  evaluationCreateSchema, evidenceCreateSchema, feeAssumptionCreateSchema,
  researchIdSchema, researchSummarySchema, sampleCreateSchema, samplePatchSchema,
  settingsPatchSchema, snapshotCreateSchema, supplierOptionCreateSchema,
  supplierOptionPatchSchema,
} from '../validators/researchValidators.js';

export const researchRouter = Router();

researchRouter.use('/research', authenticate);

researchRouter.get('/research/candidates', authorize('research.read'), validate(candidateListSchema), asyncHandler(researchController.listCandidates));
researchRouter.post('/research/candidates', authorize('research.manage'), validate(candidateCreateSchema), asyncHandler(researchController.createCandidate));
researchRouter.get('/research/candidates/:id', authorize('research.read'), validate(researchIdSchema), asyncHandler(researchController.getCandidate));
researchRouter.patch('/research/candidates/:id', authorize('research.manage'), validate(candidatePatchSchema), asyncHandler(researchController.patchCandidate));

researchRouter.post('/research/candidates/:id/snapshots', authorize('research.manage'), validate(snapshotCreateSchema), asyncHandler(researchController.createSnapshot));
researchRouter.get('/research/candidates/:id/suppliers', authorize('research.read'), validate(researchIdSchema), asyncHandler(researchController.listSuppliers));
researchRouter.post('/research/candidates/:id/suppliers', authorize('research.manage'), validate(supplierOptionCreateSchema), asyncHandler(researchController.createSupplier));
researchRouter.patch('/research/supplier-options/:id', authorize('research.manage'), validate(supplierOptionPatchSchema), asyncHandler(researchController.patchSupplier));
researchRouter.get('/research/candidates/:id/samples', authorize('research.read'), validate(researchIdSchema), asyncHandler(researchController.listSamples));
researchRouter.post('/research/candidates/:id/samples', authorize('research.manage'), validate(sampleCreateSchema), asyncHandler(researchController.createSample));
researchRouter.patch('/research/samples/:id', authorize('research.manage'), validate(samplePatchSchema), asyncHandler(researchController.patchSample));

researchRouter.post('/research/candidates/:id/fee-assumptions', authorize('research.manage'), validate(feeAssumptionCreateSchema), asyncHandler(researchController.createFeeAssumption));
researchRouter.post('/research/candidates/:id/evidence', authorize('research.manage'), validate(evidenceCreateSchema), asyncHandler(researchController.createEvidence));
researchRouter.post('/research/candidates/:id/unit-economics', authorize('research.evaluate'), validate(economicsCreateSchema), asyncHandler(researchController.calculateEconomics));
researchRouter.post('/research/candidates/:id/evaluations', authorize('research.evaluate'), validate(evaluationCreateSchema), asyncHandler(researchController.createEvaluation));
researchRouter.post('/research/candidates/:id/create-product', authorize('research.evaluate'), validate(createProductFromCandidateSchema), asyncHandler(researchController.createProduct));

researchRouter.get('/research/comparison', authorize('research.read'), validate(comparisonSchema), asyncHandler(researchController.comparison));
researchRouter.get('/research/summary', authorize('research.read'), validate(researchSummarySchema), asyncHandler(researchController.summary));
researchRouter.get('/research/settings', authorize('research.read'), validate(researchSummarySchema), asyncHandler(researchController.settings));
researchRouter.patch('/research/settings', authorize('research.manage'), validate(settingsPatchSchema), asyncHandler(researchController.patchSettings));
