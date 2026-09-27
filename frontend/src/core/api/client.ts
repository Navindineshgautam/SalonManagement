import type { ApiClient } from './ApiClient';
import { MockApiClient } from './mock/MockApiClient';
import { HttpApiClient } from './http/HttpApiClient';

/**
 * The single active API adapter.
 *
 * - When `VITE_API_BASE_URL` is set (e.g. the deployed backend), the app talks
 *   to the real API over HTTP.
 * - When it is unset (local dev with no backend), it falls back to the
 *   in-memory mock so screens keep working.
 *
 * Both implement the same `ApiClient` interface, so nothing else changes.
 */
const baseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const api: ApiClient = baseUrl ? new HttpApiClient(baseUrl) : new MockApiClient();
