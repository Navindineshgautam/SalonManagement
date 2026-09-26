import type { ApiClient } from './ApiClient';
import { MockApiClient } from './mock/MockApiClient';

/**
 * The single active API adapter. Phase 1 uses the in-memory mock; after the
 * backend is built this is the only line that changes (swap to an HttpApiClient
 * implementing the same ApiClient interface).
 */
export const api: ApiClient = new MockApiClient();
