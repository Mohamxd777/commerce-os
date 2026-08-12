import * as researchService from '../services/researchService.js';

export async function listCandidates(request, response) {
  const result = await researchService.listCandidates(request.organizationId, request.validated.query);
  response.json({ data: result.items, meta: result.pagination });
}

export async function createCandidate(request, response) {
  const result = await researchService.createCandidate(
    request.organizationId, request.user.id, request.validated.body,
  );
  response.status(201).json({ data: result });
}

export async function quickCapture(request, response) {
  const result = await researchService.quickCapture(
    request.organizationId, request.user.id, request.validated.body,
  );
  response.status(201).json({ data: result });
}

export async function getCandidate(request, response) {
  const result = await researchService.getCandidate(
    request.organizationId, request.validated.params.id,
  );
  response.json({ data: result });
}

export async function patchCandidate(request, response) {
  const result = await researchService.patchCandidate(
    request.organizationId, request.validated.params.id, request.validated.body,
  );
  response.json({ data: result });
}

export async function analyzeNoon(request, response) {
  const result = await researchService.analyzeNoon(request.validated.body.url);
  response.json({ data: result });
}

export async function createSnapshot(request, response) {
  const result = await researchService.createSnapshot(
    request.organizationId, request.validated.params.id,
    request.user.id, request.validated.body,
  );
  response.status(201).json({ data: result });
}

export async function listSuppliers(request, response) {
  const result = await researchService.listSupplierOptions(
    request.organizationId, request.validated.params.id,
  );
  response.json({ data: result });
}

export async function createSupplier(request, response) {
  const result = await researchService.createSupplierOption(
    request.organizationId, request.validated.params.id, request.validated.body,
  );
  response.status(201).json({ data: result });
}

export async function patchSupplier(request, response) {
  const result = await researchService.patchSupplierOption(
    request.organizationId, request.validated.params.id, request.validated.body,
  );
  response.json({ data: result });
}

export async function promoteSupplier(request, response) {
  const result = await researchService.promoteSupplierOption(
    request.organizationId, request.validated.params.id, request.user.id, request.validated.body,
  );
  response.json({ data: result });
}

export async function listSamples(request, response) {
  const result = await researchService.listSamples(
    request.organizationId, request.validated.params.id,
  );
  response.json({ data: result });
}

export async function createSample(request, response) {
  const result = await researchService.createSample(
    request.organizationId, request.validated.params.id,
    request.user.id, request.validated.body,
  );
  response.status(201).json({ data: result });
}

export async function patchSample(request, response) {
  const result = await researchService.patchSample(
    request.organizationId, request.validated.params.id,
    request.user.id, request.validated.body,
  );
  response.json({ data: result });
}

export async function createFeeAssumption(request, response) {
  const result = await researchService.createFeeAssumption(
    request.organizationId, request.validated.params.id,
    request.user.id, request.validated.body,
  );
  response.status(201).json({ data: result });
}

export async function createEvidence(request, response) {
  const result = await researchService.createEvidence(
    request.organizationId, request.validated.params.id,
    request.user.id, request.validated.body,
  );
  response.status(201).json({ data: result });
}

export async function calculateEconomics(request, response) {
  const result = await researchService.calculateEconomics(
    request.organizationId, request.validated.params.id,
    request.user.id, request.validated.body,
  );
  response.status(201).json({ data: result });
}

export async function createEvaluation(request, response) {
  const result = await researchService.createEvaluation(
    request.organizationId, request.validated.params.id,
    request.user.id, request.validated.body,
  );
  response.status(201).json({ data: result });
}

export async function comparison(request, response) {
  const result = await researchService.getComparison(
    request.organizationId, request.validated.query.ids,
  );
  response.json({ data: result });
}

export async function summary(request, response) {
  const result = await researchService.getSummary(request.organizationId);
  response.json({ data: result });
}

export async function settings(request, response) {
  const result = await researchService.getSettings(request.organizationId);
  response.json({ data: result });
}

export async function patchSettings(request, response) {
  const result = await researchService.patchSettings(
    request.organizationId, request.user.id, request.validated.body,
  );
  response.json({ data: result });
}

export async function createProduct(request, response) {
  const result = await researchService.createProductFromCandidate(
    request.organizationId, request.validated.params.id,
    request.user.id, request.validated.body,
  );
  response.status(201).json({ data: result });
}
