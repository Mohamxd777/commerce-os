import { pool } from '../config/database.js';
import { userHasPermission } from '../models/authorizationModel.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export function authorize(permissionCode) {
  return asyncHandler(async (request, _response, next) => {
    const organizationId = request.header('x-organization-id');

    if (!organizationId) {
      throw new AppError(
        400,
        'ORGANIZATION_REQUIRED',
        'The x-organization-id header is required for this operation.',
      );
    }

    const allowed = await userHasPermission(pool, {
      userId: request.user.id,
      organizationId,
      permissionCode,
    });

    if (!allowed) {
      throw new AppError(403, 'PERMISSION_DENIED', 'You do not have permission for this operation.');
    }

    request.organizationId = organizationId;
    next();
  });
}
