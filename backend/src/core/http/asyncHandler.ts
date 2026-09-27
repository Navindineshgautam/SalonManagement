import type { NextFunction, Request, Response } from 'express';

/**
 * Wraps an async route handler so rejected promises are forwarded to Express's
 * error handler instead of crashing the process.
 */
export const asyncHandler =
  <T>(fn: (req: Request, res: Response, next: NextFunction) => Promise<T>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
