// ============================================================================
// API Contract Types — source of truth for the frontend/backend contract.
// Mirrors design.md. Times are ISO-8601 UTC strings unless noted.
// ============================================================================

export type Role = 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'RECEPTIONIST';
export type EntityStatus = 'ACTIVE' | 'INACTIVE';

// ----- Error shape ----------------------------------------------------------

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

export interface ApiError {
  code: ApiErrorCode;
  /** HTTP status the backend returns for this error. */
  status: number;
  message: string;
  details?: ApiFieldError[];
}

// ----- Auth -----------------------------------------------------------------

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  /** null for SUPER_ADMIN (platform-level). */
  salonId: string | null;
  name: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
}

// ----- Salon ----------------------------------------------------------------

export interface Salon {
  id: string;
  name: string;
  /** IANA timezone, e.g. "Asia/Kolkata". */
  timezone: string;
  contactPhone?: string;
  contactEmail?: string;
  status: EntityStatus;
}

export interface UpdateSalonRequest {
  name: string;
  timezone: string;
  contactPhone?: string;
  contactEmail?: string;
}

export interface CreateSalonRequest {
  name: string;
  timezone: string;
  contactPhone?: string;
  contactEmail?: string;
  owner: {
    name: string;
    email: string;
    password: string;
  };
}

// ----- Salon users ----------------------------------------------------------

export interface SalonUser {
  id: string;
  salonId: string;
  name: string;
  email: string;
  role: Exclude<Role, 'SUPER_ADMIN'>;
  status: EntityStatus;
}

export interface CreateSalonUserRequest {
  name: string;
  email: string;
  password: string;
  role: 'MANAGER' | 'RECEPTIONIST';
}

export interface UpdateSalonUserRequest {
  name?: string;
  role?: 'MANAGER' | 'RECEPTIONIST';
  status?: EntityStatus;
}

// ----- Services -------------------------------------------------------------

export interface Service {
  id: string;
  salonId: string;
  name: string;
  /** Must be a positive multiple of SLOT_MINUTES (15). */
  durationMinutes: number;
  price: number;
  status: EntityStatus;
}

export interface CreateServiceRequest {
  name: string;
  durationMinutes: number;
  price: number;
}

export type UpdateServiceRequest = Partial<CreateServiceRequest> & {
  status?: EntityStatus;
};

// ----- Employees / professionals --------------------------------------------

/** Minutes-from-midnight in the salon-local day (06:00 = 360, 24:00 = 1440). */
export interface TimeInterval {
  startMinute: number;
  endMinute: number;
}

/** weekday: 0=Sunday .. 6=Saturday. */
export interface WorkingHour extends TimeInterval {
  weekday: number;
}

export interface BreakInterval extends TimeInterval {
  weekday: number;
}

export interface LeaveRange {
  id: string;
  /** salon-local date, YYYY-MM-DD, inclusive. */
  startDate: string;
  endDate: string;
}

export type ScheduleOverrideType = 'EXTRA_HOURS' | 'TIME_OFF';

export interface ScheduleOverride {
  id: string;
  /** salon-local date, YYYY-MM-DD. */
  date: string;
  type: ScheduleOverrideType;
  startMinute?: number;
  endMinute?: number;
}

export interface Employee {
  id: string;
  salonId: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  specialization: string;
  status: EntityStatus;
  /** Service ids this professional can perform. */
  serviceIds: string[];
  /** 0=Sunday .. 6=Saturday, or null for none. */
  weeklyOff: number | null;
  workingHours: WorkingHour[];
  breaks: BreakInterval[];
  leaves: LeaveRange[];
  overrides: ScheduleOverride[];
}

export interface CreateEmployeeRequest {
  name: string;
  phone: string;
  email: string;
  role: string;
  specialization: string;
  serviceIds: string[];
  weeklyOff: number | null;
  workingHours: WorkingHour[];
  breaks: BreakInterval[];
}

export type UpdateEmployeeRequest = Partial<CreateEmployeeRequest> & {
  status?: EntityStatus;
};

export interface AddLeaveRequest {
  startDate: string;
  endDate: string;
}

export interface AddOverrideRequest {
  date: string;
  type: ScheduleOverrideType;
  startMinute?: number;
  endMinute?: number;
}

// ----- Holidays -------------------------------------------------------------

export interface Holiday {
  id: string;
  salonId: string;
  date: string; // salon-local YYYY-MM-DD
  name: string;
}

// ----- Customers ------------------------------------------------------------

export interface Customer {
  id: string;
  salonId: string;
  name: string;
  phone: string;
  email?: string;
}

export interface CreateCustomerRequest {
  name: string;
  phone: string;
  email?: string;
}

// ----- Availability ---------------------------------------------------------

export interface AvailabilityQuery {
  /** salon-local date, YYYY-MM-DD. */
  date: string;
  serviceIds: string[];
  /** optional filter to a single professional. */
  employeeId?: string;
}

export interface AvailabilitySlot {
  /** UTC ISO instant for the slot start. */
  startAt: string;
  /** UTC ISO instant for the slot end (start + total service duration). */
  endAt: string;
}

export interface ProfessionalAvailability {
  employeeId: string;
  employeeName: string;
  slots: AvailabilitySlot[];
}

// ----- Bookings -------------------------------------------------------------

export interface BookingItemInput {
  serviceId: string;
  employeeId: string;
}

export interface CreateBookingRequest {
  /** Provide either an existing customer id or new-customer basic info. */
  customerId?: string;
  customer?: CreateCustomerRequest;
  /** UTC ISO instant the booking starts. */
  startAt: string;
  items: BookingItemInput[];
}

export interface BookingItem {
  id: string;
  serviceId: string;
  serviceName: string;
  employeeId: string;
  employeeName: string;
  startAt: string; // UTC ISO
  endAt: string; // UTC ISO
}

export interface Booking {
  id: string;
  salonId: string;
  customerId: string;
  customerName: string;
  startAt: string; // UTC ISO
  endAt: string; // UTC ISO
  status: 'BOOKED';
  items: BookingItem[];
}

export interface BookingListQuery {
  /** salon-local date range, YYYY-MM-DD inclusive. */
  from: string;
  to: string;
  employeeId?: string;
}
