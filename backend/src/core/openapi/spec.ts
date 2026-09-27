/**
 * Minimal OpenAPI document describing the REST surface. It documents the
 * contract at a high level (paths, methods, auth) and is served at /api/docs.
 * The authoritative request/response shapes remain the frozen frontend types.
 */
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Salon Management API (Phase 1)',
    version: '1.0.0',
    description:
      'Implements the frozen frontend ApiClient contract. All salon-scoped ' +
      'endpoints derive the tenant from the access token.',
  },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/login': { post: { tags: ['auth'], summary: 'Log in', security: [] } },
    '/auth/refresh': { post: { tags: ['auth'], summary: 'Rotate refresh token', security: [] } },
    '/auth/logout': { post: { tags: ['auth'], summary: 'Log out' } },
    '/auth/me': { get: { tags: ['auth'], summary: 'Current user' } },
    '/platform/salons': {
      get: { tags: ['platform'], summary: 'List salons (SUPER_ADMIN)' },
      post: { tags: ['platform'], summary: 'Create salon + owner (SUPER_ADMIN)' },
    },
    '/salon': {
      get: { tags: ['salon'], summary: 'Get salon settings' },
      put: { tags: ['salon'], summary: 'Update salon settings (OWNER)' },
    },
    '/salon/users': {
      get: { tags: ['salon'], summary: 'List salon users (OWNER, MANAGER)' },
      post: { tags: ['salon'], summary: 'Create salon user (OWNER, MANAGER)' },
    },
    '/salon/users/{id}': {
      patch: { tags: ['salon'], summary: 'Update salon user (OWNER, MANAGER)' },
      delete: { tags: ['salon'], summary: 'Delete salon user (OWNER)' },
    },
    '/services': {
      get: { tags: ['services'], summary: 'List services' },
      post: { tags: ['services'], summary: 'Create service (OWNER, MANAGER)' },
    },
    '/services/{id}': {
      put: { tags: ['services'], summary: 'Update service (OWNER, MANAGER)' },
      delete: { tags: ['services'], summary: 'Delete service (OWNER, MANAGER)' },
    },
    '/employees': {
      get: { tags: ['employees'], summary: 'List employees' },
      post: { tags: ['employees'], summary: 'Create employee (OWNER, MANAGER)' },
    },
    '/employees/{id}': {
      get: { tags: ['employees'], summary: 'Get employee' },
      put: { tags: ['employees'], summary: 'Update employee (OWNER, MANAGER)' },
      delete: { tags: ['employees'], summary: 'Delete employee (OWNER, MANAGER)' },
    },
    '/employees/{id}/leave': {
      post: { tags: ['employees'], summary: 'Add leave (OWNER, MANAGER)' },
    },
    '/employees/{id}/leave/{leaveId}': {
      delete: { tags: ['employees'], summary: 'Remove leave (OWNER, MANAGER)' },
    },
    '/employees/{id}/overrides': {
      post: { tags: ['employees'], summary: 'Add schedule override (OWNER, MANAGER)' },
    },
    '/employees/{id}/overrides/{overrideId}': {
      delete: { tags: ['employees'], summary: 'Remove override (OWNER, MANAGER)' },
    },
    '/holidays': {
      get: { tags: ['holidays'], summary: 'List holidays' },
      post: { tags: ['holidays'], summary: 'Create holiday (OWNER, MANAGER)' },
    },
    '/holidays/{id}': {
      delete: { tags: ['holidays'], summary: 'Delete holiday (OWNER, MANAGER)' },
    },
    '/customers': {
      get: { tags: ['customers'], summary: 'Search customers' },
      post: { tags: ['customers'], summary: 'Create customer (dedupe by phone)' },
    },
    '/availability': {
      get: { tags: ['availability'], summary: 'Compute availability' },
    },
    '/bookings': {
      get: { tags: ['bookings'], summary: 'List bookings' },
      post: { tags: ['bookings'], summary: 'Create booking (concurrency-safe)' },
    },
    '/bookings/{id}': {
      get: { tags: ['bookings'], summary: 'Get booking' },
    },
  },
} as const;
