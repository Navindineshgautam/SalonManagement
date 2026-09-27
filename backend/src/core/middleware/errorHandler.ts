import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { ApiError, isApiError, type ApiFieldError } from '../http/errors';
import { isProd } from '../../config';

const zodToFieldErrors = (err: ZodError): ApiFieldError[] =>
  err.errors.map((e) => ({
    field: e.path.join('.') || '(root)',
    message: e.message,
  }));

/**
 * Central error handler. Emits the frozen contract envelope:
 *   { error: { code, message, details? } }
 * mapping zod validation and known Prisma errors onto contract codes.
 */
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  let apiError: ApiError;

  if (isApiError(err)) {
    apiError = err;
  } else if (err instanceof ZodError) {
    apiError = new ApiError('VALIDATION', 'Validation failed', zodToFieldErrors(err));
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      // Unique constraint violation.
      apiError = new ApiError('CONFLICT', 'A record with these values already exists');
    } else if (err.code === 'P2025') {
      // Record not found.
      apiError = new ApiError('NOT_FOUND', 'Not found');
    } else {
      apiError = new ApiError('SERVER_ERROR', 'Database error');
    }
  } else {
    apiError = new ApiError('SERVER_ERROR', 'Something went wrong');
  }

  if (apiError.code === 'SERVER_ERROR' && !isProd) {
    // Surface unexpected errors in dev logs for debugging.
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(apiError.status).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details ? { details: apiError.details } : {}),
    },
  });
};

/** 404 fallback for unmatched routes. */
export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
};
