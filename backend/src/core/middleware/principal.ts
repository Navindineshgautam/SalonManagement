import type { Role } from '../http/contract';

/** The authenticated principal attached to a request by `authenticate`. */
export interface Principal {
  userId: string;
  role: Role;
  /** null for SUPER_ADMIN. */
  salonId: string | null;
}

// Augment Express's Request with our principal.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}

export {};
