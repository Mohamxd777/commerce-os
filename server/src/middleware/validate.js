import { AppError } from '../utils/AppError.js';

export function validate(schema) {
  return function validateRequest(request, _response, next) {
    const result = schema.safeParse({
      body: request.body,
      params: request.params,
      query: request.query,
    });

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new AppError(400, 'VALIDATION_ERROR', 'The request contains invalid data.', details));
    }

    request.validated = result.data;
    return next();
  };
}
