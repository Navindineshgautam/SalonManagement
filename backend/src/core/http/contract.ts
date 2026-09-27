/**
 * API contract DTOs — mirrors the frozen frontend `core/api/types.ts`.
 * These are the exact response/request shapes the frontend expects. The backend
 * maps Prisma rows onto these types so the HTTP surface matches the mock.
 */

export type Role = 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'RECEPTIONIST';
export type EntityStatus = 'ACTIVE' | 'INACTIVE';

// ----- Auth -----------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
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
  timezone: string;
  contactPhone?: string;
  contactEmail?: string;
  status: EntityStatus;
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

// ----- Services -------------------------------------------------------------

export interface Service {
  id: string;
  salonId: string;
  name: string;
  durationMinutes: number;
  price: number;
  status: EntityStatus;
}

// ----- Employees ------------------------------------------------------------

export interface TimeInterval {
  startMinute: number;
  endMinute: number;
}

export interface WorkingHour extends TimeInterval {
  weekday: number;
}

export interface BreakInterval extends TimeInterval {
  weekday: number;
}

export interface LeaveRange {
  id: string;
  startDate: string;
  endDate: string;
}

export type ScheduleOverrideType = 'EXTRA_HOURS' | 'TIME_OFF';

export interface ScheduleOverride {
  id: string;
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
  serviceIds: string[];
  weeklyOff: number | null;
  workingHours: WorkingHour[];
  breaks: BreakInterval[];
  leaves: LeaveRange[];
  overrides: ScheduleOverride[];
}

// ----- Holidays -------------------------------------------------------------

export interface Holiday {
  id: string;
  salonId: string;
  date: string;
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

// ----- Availability ---------------------------------------------------------

export interface AvailabilitySlot {
  startAt: string;
  endAt: string;
}

export interface ProfessionalAvailability {
  employeeId: string;
  employeeName: string;
  slots: AvailabilitySlot[];
}

// ----- Bookings -------------------------------------------------------------

export interface BookingItem {
  id: string;
  serviceId: string;
  serviceName: string;
  employeeId: string;
  employeeName: string;
  startAt: string;
  endAt: string;
}

export interface Booking {
  id: string;
  salonId: string;
  customerId: string;
  customerName: string;
  startAt: string;
  endAt: string;
  status: 'BOOKED';
  items: BookingItem[];
}
