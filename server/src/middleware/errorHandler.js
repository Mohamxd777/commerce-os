import { AppError } from '../utils/AppError.js';

export function notFound(request, _response, next) {
  next(new AppError(404, 'NOT_FOUND', 'Route not found: ' + request.method + ' ' + request.originalUrl));
}

export function errorHandler(error, request, response, _next) {
  const isKnownError = error instanceof AppError || error.isOperational;
  const statusCode = isKnownError ? error.statusCode : 500;

  if (!isKnownError) {
    console.error('Unhandled application error', {
      requestId: request.id,
      error,
    });
  }

  const payload = {
    error: {
      code: isKnownError ? error.code : 'INTERNAL_SERVER_ERROR',
      message: isKnownError ? error.message : 'An unexpected error occurred.',
      requestId: request.id,
    },
  };

  if (isKnownError && error.details) {
    payload.error.details = error.details;
  }

  response.status(statusCode).json(payload);
}
