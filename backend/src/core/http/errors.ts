/**
 * Typed API errors matching the frozen frontend contract.
 * The error envelope emitted to clients is:
 *   { error: { code, message, details? } }
 * and the HTTP status is derived from the code below.
 */

export type ApiErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SERVER_ERROR';

export interface ApiFieldError {
  field: string;
  message: string;
}

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SERVER_ERROR: 500,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: ApiFieldError[];

  constructor(code: ApiErrorCode, message: string, details?: ApiFieldError[]) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

export const validationError = (message: string, details?: ApiFieldError[]) =>
  new ApiError('VALIDATION', message, details);
export const unauthenticated = (message = 'Not authenticated') =>
  new ApiError('UNAUTHENTICATED', message);
export const forbidden = (message = 'You are not allowed to perform this action') =>
  new ApiError('FORBIDDEN', message);
export const notFound = (message = 'Not found') => new ApiError('NOT_FOUND', message);
export const conflict = (message: string) => new ApiError('CONFLICT', message);
export const serverError = (message = 'Something went wrong') =>
  new ApiError('SERVER_ERROR', message);
