import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny, type infer as ZInfer } from 'zod';
import { validationError, type ApiFieldError } from '../http/errors';

const toFieldErrors = (err: ZodError): ApiFieldError[] =>
  err.errors.map((e) => ({ field: e.path.join('.') || '(root)', message: e.message }));

/**
 * Validate and coerce `req.body` against a zod schema. On success the parsed
 * value replaces `req.body`. On failure throws a VALIDATION ApiError with field
 * details, matching the frozen error contract.
 */
export const validateBody =
  <S extends ZodTypeAny>(schema: S) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(validationError('Validation failed', toFieldErrors(result.error)));
      return;
    }
    req.body = result.data as ZInfer<S>;
    next();
  };

/** Validate and coerce `req.query` against a zod schema. */
export const validateQuery =
  <S extends ZodTypeAny>(schema: S) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(validationError('Validation failed', toFieldErrors(result.error)));
      return;
    }
    // Express query is read-only in some setups; stash the parsed value.
    (req as Request & { validatedQuery?: unknown }).validatedQuery = result.data;
    next();
  };

/** Retrieve the query object validated by `validateQuery`. */
export const getValidatedQuery = <T>(req: Request): T =>
  (req as Request & { validatedQuery?: T }).validatedQuery as T;
