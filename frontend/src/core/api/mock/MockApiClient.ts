import type { ApiClient } from '@/core/api/ApiClient';
import {
  conflict,
  forbidden,
  notFound,
  unauthenticated,
  validationError,
} from '@/core/api/error';
import { SLOT_MINUTES } from '@/core/config';
import type {
  AddLeaveRequest,
  AddOverrideRequest,
  AuthUser,
  AvailabilityQuery,
  Booking,
  BookingItem,
  BookingListQuery,
  CreateBookingRequest,
  CreateCustomerRequest,
  CreateEmployeeRequest,
  CreateSalonRequest,
  CreateSalonUserRequest,
  CreateServiceRequest,
  Customer,
  Employee,
  Holiday,
  LeaveRange,
  LoginRequest,
  LoginResponse,
  ProfessionalAvailability,
  RefreshResponse,
  Role,
  Salon,
  SalonUser,
  ScheduleOverride,
  Service,
  UpdateEmployeeRequest,
  UpdateSalonRequest,
  UpdateSalonUserRequest,
  UpdateServiceRequest,
} from '@/core/api/types';
import { buildSeedDb, type MockDb, type MockUserRecord } from './seed';
import { availableSlotStarts } from './availability';
import { overlaps } from '@/shared/utils/intervals';
import {
  utcIsoToLocalDate,
  utcIsoToLocalMinutes,
} from '@/shared/utils/datetime';

let idCounter = 1000;
const nextId = (prefix: string) => `${prefix}-${++idCounter}`;

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

/**
 * In-memory implementation of ApiClient. Enforces tenant scoping and role rules
 * so screens behave like production. Session lives in-memory; a page reload
 * clears it (mirrors access-token-in-memory behaviour).
 */
export class MockApiClient implements ApiClient {
  private db: MockDb = buildSeedDb();
  private session: MockUserRecord | null = null;

  // ----- helpers ------------------------------------------------------------

  private requireSession(): MockUserRecord {
    if (!this.session) throw unauthenticated();
    return this.session;
  }

  private requireSalonUser(): { user: MockUserRecord; salonId: string } {
    const user = this.requireSession();
    if (user.role === 'SUPER_ADMIN' || !user.salonId) {
      throw forbidden('This action requires a salon context');
    }
    return { user, salonId: user.salonId };
  }

  private requireRole(...roles: Role[]) {
    const user = this.requireSession();
    if (!roles.includes(user.role)) throw forbidden();
    return user;
  }

  private toAuthUser(u: MockUserRecord): AuthUser {
    return { id: u.id, email: u.email, role: u.role, salonId: u.salonId, name: u.name };
  }

  // ----- auth ---------------------------------------------------------------

  async login(req: LoginRequest): Promise<LoginResponse> {
    await delay();
    const user = this.db.users.find(
      (u) => u.email.toLowerCase() === req.email.toLowerCase() && u.status === 'ACTIVE'
    );
    // Do not reveal whether the email exists.
    if (!user || user.password !== req.password) {
      throw unauthenticated('Invalid email or password');
    }
    this.session = user;
    return { accessToken: `mock-token-${user.id}`, user: this.toAuthUser(user) };
  }

  async refresh(): Promise<RefreshResponse> {
    await delay(60);
    const user = this.requireSession();
    return { accessToken: `mock-token-${user.id}` };
  }

  async logout(): Promise<void> {
    await delay(60);
    this.session = null;
  }

  async me(): Promise<AuthUser> {
    await delay(60);
    return this.toAuthUser(this.requireSession());
  }

  // ----- platform (super admin) --------------------------------------------

  async createSalon(req: CreateSalonRequest): Promise<Salon> {
    await delay();
    this.requireRole('SUPER_ADMIN');
    if (this.db.users.some((u) => u.email.toLowerCase() === req.owner.email.toLowerCase())) {
      throw validationError('Owner email already in use', [
        { field: 'owner.email', message: 'This email is already registered' },
      ]);
    }
    const salon: Salon = {
      id: nextId('salon'),
      name: req.name,
      timezone: req.timezone,
      contactPhone: req.contactPhone,
      contactEmail: req.contactEmail,
      status: 'ACTIVE',
    };
    this.db.salons.push(salon);
    this.db.users.push({
      id: nextId('user'),
      salonId: salon.id,
      name: req.owner.name,
      email: req.owner.email,
      password: req.owner.password,
      role: 'OWNER',
      status: 'ACTIVE',
    });
    return salon;
  }

  async listSalons(): Promise<Salon[]> {
    await delay();
    this.requireRole('SUPER_ADMIN');
    return [...this.db.salons];
  }

  // ----- salon settings + users --------------------------------------------

  async getSalon(): Promise<Salon> {
    await delay();
    const { salonId } = this.requireSalonUser();
    const salon = this.db.salons.find((s) => s.id === salonId);
    if (!salon) throw notFound('Salon not found');
    return salon;
  }

  async updateSalon(req: UpdateSalonRequest): Promise<Salon> {
    await delay();
    this.requireRole('OWNER');
    const { salonId } = this.requireSalonUser();
    const salon = this.db.salons.find((s) => s.id === salonId);
    if (!salon) throw notFound('Salon not found');
    if (!isValidTimezone(req.timezone)) {
      throw validationError('Invalid timezone', [
        { field: 'timezone', message: 'Unknown timezone' },
      ]);
    }
    Object.assign(salon, req);
    return salon;
  }

  async listSalonUsers(): Promise<SalonUser[]> {
    await delay();
    this.requireRole('OWNER', 'MANAGER');
    const { salonId } = this.requireSalonUser();
    return this.db.users
      .filter((u) => u.salonId === salonId && u.role !== 'SUPER_ADMIN')
      .map((u) => ({
        id: u.id,
        salonId: salonId,
        name: u.name,
        email: u.email,
        role: u.role as SalonUser['role'],
        status: u.status,
      }));
  }

  async createSalonUser(req: CreateSalonUserRequest): Promise<SalonUser> {
    await delay();
    const actor = this.requireRole('OWNER', 'MANAGER');
    const { salonId } = this.requireSalonUser();
    if (actor.role === 'MANAGER' && req.role !== 'RECEPTIONIST') {
      throw forbidden('Managers can only create receptionists');
    }
    if (this.db.users.some((u) => u.email.toLowerCase() === req.email.toLowerCase())) {
      throw validationError('Email already in use', [
        { field: 'email', message: 'This email is already registered' },
      ]);
    }
    const record: MockUserRecord = {
      id: nextId('user'),
      salonId,
      name: req.name,
      email: req.email,
      password: req.password,
      role: req.role,
      status: 'ACTIVE',
    };
    this.db.users.push(record);
    return { id: record.id, salonId, name: record.name, email: record.email, role: req.role, status: 'ACTIVE' };
  }

  async updateSalonUser(id: string, req: UpdateSalonUserRequest): Promise<SalonUser> {
    await delay();
    const actor = this.requireRole('OWNER', 'MANAGER');
    const { salonId } = this.requireSalonUser();
    const user = this.db.users.find((u) => u.id === id && u.salonId === salonId);
    if (!user || user.role === 'SUPER_ADMIN') throw notFound('User not found');
    if (actor.role === 'MANAGER' && (user.role === 'OWNER' || req.role === 'MANAGER')) {
      throw forbidden('Managers cannot manage owners or promote to manager');
    }
    if (req.name != null) user.name = req.name;
    if (req.role != null) user.role = req.role;
    if (req.status != null) user.status = req.status;
    return {
      id: user.id,
      salonId,
      name: user.name,
      email: user.email,
      role: user.role as SalonUser['role'],
      status: user.status,
    };
  }

  async deleteSalonUser(id: string): Promise<void> {
    await delay();
    this.requireRole('OWNER');
    const { salonId } = this.requireSalonUser();
    const user = this.db.users.find((u) => u.id === id && u.salonId === salonId);
    if (!user || user.role === 'SUPER_ADMIN') throw notFound('User not found');
    if (user.role === 'OWNER') throw forbidden('Cannot delete the owner');
    this.db.users = this.db.users.filter((u) => u.id !== id);
  }

  // ----- services -----------------------------------------------------------

  async listServices(): Promise<Service[]> {
    await delay();
    const { salonId } = this.requireSalonUser();
    return this.db.services.filter((s) => s.salonId === salonId);
  }

  async createService(req: CreateServiceRequest): Promise<Service> {
    await delay();
    this.requireRole('OWNER', 'MANAGER');
    const { salonId } = this.requireSalonUser();
    this.validateDuration(req.durationMinutes);
    const svc: Service = {
      id: nextId('svc'),
      salonId,
      name: req.name,
      durationMinutes: req.durationMinutes,
      price: req.price,
      status: 'ACTIVE',
    };
    this.db.services.push(svc);
    return svc;
  }

  async updateService(id: string, req: UpdateServiceRequest): Promise<Service> {
    await delay();
    this.requireRole('OWNER', 'MANAGER');
    const { salonId } = this.requireSalonUser();
    const svc = this.db.services.find((s) => s.id === id && s.salonId === salonId);
    if (!svc) throw notFound('Service not found');
    if (req.durationMinutes != null) this.validateDuration(req.durationMinutes);
    Object.assign(svc, req);
    return svc;
  }

  async deleteService(id: string): Promise<void> {
    await delay();
    this.requireRole('OWNER', 'MANAGER');
    const { salonId } = this.requireSalonUser();
    const svc = this.db.services.find((s) => s.id === id && s.salonId === salonId);
    if (!svc) throw notFound('Service not found');
    this.db.services = this.db.services.filter((s) => s.id !== id);
  }

  private validateDuration(duration: number) {
    if (duration <= 0 || duration % SLOT_MINUTES !== 0) {
      throw validationError('Invalid duration', [
        { field: 'durationMinutes', message: `Must be a positive multiple of ${SLOT_MINUTES} minutes` },
      ]);
    }
  }

  // ----- employees ----------------------------------------------------------

  async listEmployees(): Promise<Employee[]> {
    await delay();
    const { salonId } = this.requireSalonUser();
    return this.db.employees.filter((e) => e.salonId === salonId);
  }

  async getEmployee(id: string): Promise<Employee> {
    await delay();
    const { salonId } = this.requireSalonUser();
    const emp = this.db.employees.find((e) => e.id === id && e.salonId === salonId);
    if (!emp) throw notFound('Employee not found');
    return emp;
  }

  async createEmployee(req: CreateEmployeeRequest): Promise<Employee> {
    await delay();
    this.requireRole('OWNER', 'MANAGER');
    const { salonId } = this.requireSalonUser();
    const emp: Employee = {
      id: nextId('emp'),
      salonId,
      name: req.name,
      phone: req.phone,
      email: req.email,
      role: req.role,
      specialization: req.specialization,
      status: 'ACTIVE',
      serviceIds: req.serviceIds,
      weeklyOff: req.weeklyOff,
      workingHours: req.workingHours,
      breaks: req.breaks,
      leaves: [],
      overrides: [],
    };
    this.db.employees.push(emp);
    return emp;
  }

  async updateEmployee(id: string, req: UpdateEmployeeRequest): Promise<Employee> {
    await delay();
    this.requireRole('OWNER', 'MANAGER');
    const emp = await this.getEmployee(id);
    Object.assign(emp, req);
    return emp;
  }

  async deleteEmployee(id: string): Promise<void> {
    await delay();
    this.requireRole('OWNER', 'MANAGER');
    const { salonId } = this.requireSalonUser();
    const emp = this.db.employees.find((e) => e.id === id && e.salonId === salonId);
    if (!emp) throw notFound('Employee not found');
    this.db.employees = this.db.employees.filter((e) => e.id !== id);
  }

  async addEmployeeLeave(employeeId: string, req: AddLeaveRequest): Promise<LeaveRange> {
    await delay();
    this.requireRole('OWNER', 'MANAGER');
    const emp = await this.getEmployee(employeeId);
    if (req.endDate < req.startDate) {
      throw validationError('Invalid leave range', [
        { field: 'endDate', message: 'End date must be on or after start date' },
      ]);
    }
    const leave: LeaveRange = { id: nextId('leave'), startDate: req.startDate, endDate: req.endDate };
    emp.leaves.push(leave);
    return leave;
  }

  async removeEmployeeLeave(employeeId: string, leaveId: string): Promise<void> {
    await delay();
    this.requireRole('OWNER', 'MANAGER');
    const emp = await this.getEmployee(employeeId);
    emp.leaves = emp.leaves.filter((l) => l.id !== leaveId);
  }

  async addEmployeeOverride(employeeId: string, req: AddOverrideRequest): Promise<ScheduleOverride> {
    await delay();
    this.requireRole('OWNER', 'MANAGER');
    const emp = await this.getEmployee(employeeId);
    const override: ScheduleOverride = {
      id: nextId('ovr'),
      date: req.date,
      type: req.type,
      startMinute: req.startMinute,
      endMinute: req.endMinute,
    };
    emp.overrides.push(override);
    return override;
  }

  async removeEmployeeOverride(employeeId: string, overrideId: string): Promise<void> {
    await delay();
    this.requireRole('OWNER', 'MANAGER');
    const emp = await this.getEmployee(employeeId);
    emp.overrides = emp.overrides.filter((o) => o.id !== overrideId);
  }

  // ----- holidays -----------------------------------------------------------

  async listHolidays(): Promise<Holiday[]> {
    await delay();
    const { salonId } = this.requireSalonUser();
    return this.db.holidays.filter((h) => h.salonId === salonId);
  }

  // ----- customers ----------------------------------------------------------

  async searchCustomers(search: string): Promise<Customer[]> {
    await delay();
    const { salonId } = this.requireSalonUser();
    const q = search.trim().toLowerCase();
    return this.db.customers
      .filter((c) => c.salonId === salonId)
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q));
  }

  async createCustomer(req: CreateCustomerRequest): Promise<Customer> {
    await delay();
    const { salonId } = this.requireSalonUser();
    return this.resolveOrCreateCustomer(salonId, req);
  }

  private resolveOrCreateCustomer(salonId: string, req: CreateCustomerRequest): Customer {
    const existing = this.db.customers.find(
      (c) => c.salonId === salonId && c.phone === req.phone
    );
    if (existing) return existing; // dedupe by phone (Req 9.3)
    const customer: Customer = {
      id: nextId('cust'),
      salonId,
      name: req.name,
      phone: req.phone,
      email: req.email,
    };
    this.db.customers.push(customer);
    return customer;
  }

  // ----- availability -------------------------------------------------------

  async getAvailability(query: AvailabilityQuery): Promise<ProfessionalAvailability[]> {
    await delay();
    const { salonId } = this.requireSalonUser();
    const salon = this.db.salons.find((s) => s.id === salonId)!;
    const services = query.serviceIds.map((id) => {
      const svc = this.db.services.find((s) => s.id === id && s.salonId === salonId);
      if (!svc) throw notFound('Service not found');
      return svc;
    });
    if (services.length === 0) {
      throw validationError('Select at least one service', [
        { field: 'serviceIds', message: 'At least one service is required' },
      ]);
    }
    const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0);
    const requiredServiceIds = new Set(query.serviceIds);

    const salonBookings = this.db.bookings.filter((b) => b.salonId === salonId);
    const eligible = this.db.employees
      .filter((e) => e.salonId === salonId && e.status === 'ACTIVE')
      .filter((e) => (query.employeeId ? e.id === query.employeeId : true))
      .filter((e) => [...requiredServiceIds].every((sid) => e.serviceIds.includes(sid)));

    return eligible.map((emp) => {
      const starts = availableSlotStarts(
        emp,
        query.date,
        salon.timezone,
        totalDuration,
        salonBookings,
        this.db.holidays.filter((h) => h.salonId === salonId)
      );
      return {
        employeeId: emp.id,
        employeeName: emp.name,
        slots: starts.map((startAt) => ({
          startAt,
          endAt: new Date(new Date(startAt).getTime() + totalDuration * 60000).toISOString(),
        })),
      };
    });
  }

  // ----- bookings -----------------------------------------------------------

  async createBooking(req: CreateBookingRequest): Promise<Booking> {
    await delay();
    const { salonId } = this.requireSalonUser();
    const salon = this.db.salons.find((s) => s.id === salonId)!;

    if (!req.items || req.items.length === 0) {
      throw validationError('A booking needs at least one service', [
        { field: 'items', message: 'Add at least one service' },
      ]);
    }

    // Resolve customer
    let customer: Customer | undefined;
    if (req.customerId) {
      customer = this.db.customers.find((c) => c.id === req.customerId && c.salonId === salonId);
      if (!customer) throw notFound('Customer not found');
    } else if (req.customer) {
      customer = this.resolveOrCreateCustomer(salonId, req.customer);
    } else {
      throw validationError('Customer required', [
        { field: 'customer', message: 'Provide an existing customer or new customer info' },
      ]);
    }

    // Schedule items: sequential per professional, parallel across professionals.
    const bookingStart = new Date(req.startAt).getTime();
    const cursorByEmployee = new Map<string, number>();
    const items: BookingItem[] = [];

    for (const input of req.items) {
      const svc = this.db.services.find((s) => s.id === input.serviceId && s.salonId === salonId);
      if (!svc) throw notFound('Service not found');
      const emp = this.db.employees.find((e) => e.id === input.employeeId && e.salonId === salonId);
      if (!emp) throw notFound('Professional not found');
      if (!emp.serviceIds.includes(svc.id)) {
        throw validationError('Professional cannot perform this service', [
          { field: 'items', message: `${emp.name} cannot perform ${svc.name}` },
        ]);
      }
      const start = cursorByEmployee.get(emp.id) ?? bookingStart;
      const end = start + svc.durationMinutes * 60000;
      cursorByEmployee.set(emp.id, end);
      items.push({
        id: nextId('bi'),
        serviceId: svc.id,
        serviceName: svc.name,
        employeeId: emp.id,
        employeeName: emp.name,
        startAt: new Date(start).toISOString(),
        endAt: new Date(end).toISOString(),
      });
    }

    // Re-validate each item against schedule + existing bookings (Req 10.3-10.5).
    const salonBookings = this.db.bookings.filter((b) => b.salonId === salonId);
    for (const item of items) {
      this.validateItemBookable(item, salon.timezone, salonBookings);
    }

    const booking: Booking = {
      id: nextId('bk'),
      salonId,
      customerId: customer.id,
      customerName: customer.name,
      startAt: new Date(Math.min(...items.map((i) => new Date(i.startAt).getTime()))).toISOString(),
      endAt: new Date(Math.max(...items.map((i) => new Date(i.endAt).getTime()))).toISOString(),
      status: 'BOOKED',
      items,
    };
    this.db.bookings.push(booking);
    return booking;
  }

  private validateItemBookable(item: BookingItem, timezone: string, existing: Booking[]) {
    const emp = this.db.employees.find((e) => e.id === item.employeeId)!;
    const date = utcIsoToLocalDate(item.startAt, timezone);
    const startMin = utcIsoToLocalMinutes(item.startAt, timezone);
    const endMin = utcIsoToLocalMinutes(item.endAt, timezone);

    // Must fall inside a free interval of the professional's schedule.
    const free = availableSlotStartsFree(emp, date, timezone, existing, this.db.holidays);
    const fits = free.some((iv) => startMin >= iv.startMinute && endMin <= iv.endMinute);
    if (!fits) {
      throw conflict(`${emp.name} is not available at the requested time`);
    }

    // Overlap with existing bookings for this professional.
    const conflictExists = existing
      .flatMap((b) => b.items)
      .filter((it) => it.employeeId === emp.id && utcIsoToLocalDate(it.startAt, timezone) === date)
      .some((it) =>
        overlaps(
          { startMinute: startMin, endMinute: endMin },
          {
            startMinute: utcIsoToLocalMinutes(it.startAt, timezone),
            endMinute: utcIsoToLocalMinutes(it.endAt, timezone),
          }
        )
      );
    if (conflictExists) {
      throw conflict(`${emp.name} already has a booking overlapping this time`);
    }
  }

  async listBookings(query: BookingListQuery): Promise<Booking[]> {
    await delay();
    const { salonId } = this.requireSalonUser();
    const salon = this.db.salons.find((s) => s.id === salonId)!;
    return this.db.bookings
      .filter((b) => b.salonId === salonId)
      .filter((b) => {
        const date = utcIsoToLocalDate(b.startAt, salon.timezone);
        return date >= query.from && date <= query.to;
      })
      .filter((b) => (query.employeeId ? b.items.some((i) => i.employeeId === query.employeeId) : true))
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  }

  async getBooking(id: string): Promise<Booking> {
    await delay();
    const { salonId } = this.requireSalonUser();
    const booking = this.db.bookings.find((b) => b.id === id && b.salonId === salonId);
    if (!booking) throw notFound('Booking not found');
    return booking;
  }
}

// Reuse the availability engine's free-interval calc for booking validation.
import { freeIntervalsFor } from './availability';
function availableSlotStartsFree(
  emp: Employee,
  date: string,
  timezone: string,
  bookings: Booking[],
  holidays: Holiday[]
) {
  return freeIntervalsFor(emp, date, timezone, bookings, holidays);
}

const isValidTimezone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};
