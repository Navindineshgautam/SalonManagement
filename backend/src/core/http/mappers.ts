import type {
  Booking as PBooking,
  BookingItem as PBookingItem,
  Break as PBreak,
  Customer as PCustomer,
  Employee as PEmployee,
  EmployeeService as PEmployeeService,
  Holiday as PHoliday,
  Leave as PLeave,
  Salon as PSalon,
  ScheduleOverride as PScheduleOverride,
  Service as PService,
  User as PUser,
  WorkingHour as PWorkingHour,
} from '@prisma/client';
import type {
  AuthUser,
  Booking,
  BookingItem,
  Customer,
  Employee,
  Holiday,
  Role,
  Salon,
  SalonUser,
  Service,
} from './contract';
import { dateOnlyToIso } from '../../shared/time/datetime';

export const toAuthUser = (u: PUser): AuthUser => ({
  id: u.id,
  email: u.email,
  role: u.role as Role,
  salonId: u.salonId,
  name: u.name,
});

export const toSalon = (s: PSalon): Salon => ({
  id: s.id,
  name: s.name,
  timezone: s.timezone,
  contactPhone: s.contactPhone ?? undefined,
  contactEmail: s.contactEmail ?? undefined,
  status: s.status,
});

export const toSalonUser = (u: PUser): SalonUser => ({
  id: u.id,
  salonId: u.salonId as string,
  name: u.name,
  email: u.email,
  role: u.role as SalonUser['role'],
  status: u.status,
});

export const toService = (s: PService): Service => ({
  id: s.id,
  salonId: s.salonId,
  name: s.name,
  durationMinutes: s.durationMinutes,
  // Decimal -> number for the JSON contract.
  price: Number(s.price),
  status: s.status,
});

type EmployeeWithRelations = PEmployee & {
  employeeServices: PEmployeeService[];
  workingHours: PWorkingHour[];
  breaks: PBreak[];
  leaves: PLeave[];
  overrides: PScheduleOverride[];
};

export const toEmployee = (e: EmployeeWithRelations): Employee => ({
  id: e.id,
  salonId: e.salonId,
  name: e.name,
  phone: e.phone,
  email: e.email,
  role: e.role,
  specialization: e.specialization,
  status: e.status,
  serviceIds: e.employeeServices.map((es) => es.serviceId),
  weeklyOff: e.weeklyOff,
  workingHours: e.workingHours.map((w) => ({
    weekday: w.weekday,
    startMinute: w.startMinute,
    endMinute: w.endMinute,
  })),
  breaks: e.breaks.map((b) => ({
    weekday: b.weekday,
    startMinute: b.startMinute,
    endMinute: b.endMinute,
  })),
  leaves: e.leaves.map((l) => ({
    id: l.id,
    startDate: dateOnlyToIso(l.startDate),
    endDate: dateOnlyToIso(l.endDate),
  })),
  overrides: e.overrides.map((o) => ({
    id: o.id,
    date: dateOnlyToIso(o.date),
    type: o.type,
    startMinute: o.startMinute ?? undefined,
    endMinute: o.endMinute ?? undefined,
  })),
});

/** Prisma include object that loads everything toEmployee needs. */
export const employeeInclude = {
  employeeServices: true,
  workingHours: true,
  breaks: true,
  leaves: true,
  overrides: true,
} as const;

export const toHoliday = (h: PHoliday): Holiday => ({
  id: h.id,
  salonId: h.salonId,
  date: dateOnlyToIso(h.date),
  name: h.name,
});

export const toCustomer = (c: PCustomer): Customer => ({
  id: c.id,
  salonId: c.salonId,
  name: c.name,
  phone: c.phone,
  email: c.email ?? undefined,
});

type BookingWithRelations = PBooking & {
  customer: PCustomer;
  items: (PBookingItem & { service: PService; employee: PEmployee })[];
};

export const toBooking = (b: BookingWithRelations): Booking => ({
  id: b.id,
  salonId: b.salonId,
  customerId: b.customerId,
  customerName: b.customer.name,
  startAt: b.startAt.toISOString(),
  endAt: b.endAt.toISOString(),
  status: 'BOOKED',
  items: b.items
    .map(
      (it): BookingItem => ({
        id: it.id,
        serviceId: it.serviceId,
        serviceName: it.service.name,
        employeeId: it.employeeId,
        employeeName: it.employee.name,
        startAt: it.startAt.toISOString(),
        endAt: it.endAt.toISOString(),
      }),
    )
    .sort((a, b2) => a.startAt.localeCompare(b2.startAt)),
});

export const bookingInclude = {
  customer: true,
  items: { include: { service: true, employee: true } },
} as const;
