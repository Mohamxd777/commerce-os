import { pool } from '../config/database.js';
import { z } from 'zod';
import { userHasPermission } from '../models/authorizationModel.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export function authorize(permissionCode) {
  return asyncHandler(async (request, _response, next) => {
    const organizationId = request.header('x-organization-id');
    const parsedOrganizationId = z.string().uuid().safeParse(organizationId);

    if (!parsedOrganizationId.success) {
      throw new AppError(
        400,
        'ORGANIZATION_REQUIRED',
        'A valid x-organization-id header is required for this operation.',
      );
    }
    const validatedOrganizationId = parsedOrganizationId.data;

    const allowed = await userHasPermission(pool, {
      userId: request.user.id,
      organizationId: validatedOrganizationId,
      permissionCode,
    });

    if (!allowed) {
      throw new AppError(403, 'PERMISSION_DENIED', 'You do not have permission for this operation.');
    }

    request.organizationId = validatedOrganizationId;
    next();
  });
}
