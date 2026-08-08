import * as locationService from '../services/locationService.js';

export async function list(request, response) {
  const result = await locationService.listLocations(
    request.organizationId,
    request.validated.query,
  );
  response.json({ data: result.items, meta: result.pagination });
}

export async function create(request, response) {
  const location = await locationService.createLocation(
    request.organizationId,
    request.validated.body,
  );
  response.status(201).json({ data: location });
}
