import * as categoryService from '../services/categoryService.js';

export async function list(request, response) {
  const result = await categoryService.listCategories(
    request.organizationId,
    request.validated.query,
  );
  response.json({ data: result.items, meta: result.pagination });
}

export async function create(request, response) {
  const category = await categoryService.createCategory(
    request.organizationId,
    request.validated.body,
  );
  response.status(201).json({ data: category });
}

export async function get(request, response) {
  const category = await categoryService.getCategory(
    request.organizationId,
    request.validated.params.id,
  );
  response.json({ data: category });
}

export async function patch(request, response) {
  const category = await categoryService.patchCategory(
    request.organizationId,
    request.validated.params.id,
    request.validated.body,
  );
  response.json({ data: category });
}
