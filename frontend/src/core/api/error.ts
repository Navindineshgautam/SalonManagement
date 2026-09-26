import type { ApiError, ApiErrorCode, ApiFieldError } from './types';

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SERVER_ERROR: 500,
};

/** Runtime error wrapper carrying the ApiError contract shape. */
export class ApiClientError extends Error implements ApiError {
  code: ApiErrorCode;
  status: number;
  details?: ApiFieldError[];

  constructor(code: ApiErrorCode, message: string, details?: ApiFieldError[]) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export const isApiError = (e: unknown): e is ApiClientError => e instanceof ApiClientError;

export const validationError = (message: string, details?: ApiFieldError[]) =>
  new ApiClientError('VALIDATION', message, details);
export const unauthenticated = (message = 'Not authenticated') =>
  new ApiClientError('UNAUTHENTICATED', message);
export const forbidden = (message = 'You are not allowed to perform this action') =>
  new ApiClientError('FORBIDDEN', message);
export const notFound = (message = 'Not found') => new ApiClientError('NOT_FOUND', message);
export const conflict = (message: string) => new ApiClientError('CONFLICT', message);
