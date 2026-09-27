import type { ApiClient } from '@/core/api/ApiClient';
import { ApiClientError } from '@/core/api/error';
import type { ApiErrorCode } from '@/core/api/types';
import type {
  AddLeaveRequest,
  AddOverrideRequest,
  AuthUser,
  AvailabilityQuery,
  Booking,
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
  Salon,
  SalonUser,
  ScheduleOverride,
  Service,
  UpdateEmployeeRequest,
  UpdateSalonRequest,
  UpdateSalonUserRequest,
  UpdateServiceRequest,
} from '@/core/api/types';

interface ErrorEnvelope {
  error?: { code?: ApiErrorCode; message?: string; details?: { field: string; message: string }[] };
}

const STATUS_TO_CODE: Record<number, ApiErrorCode> = {
  400: 'VALIDATION',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  500: 'SERVER_ERROR',
};

/**
 * Real HTTP implementation of the frozen ApiClient contract. Talks to the
 * backend over fetch. The access token is kept in memory (mirrors the mock's
 * in-memory session); the refresh token lives in an httpOnly cookie the browser
 * sends automatically, so all requests use `credentials: 'include'`.
 *
 * On a 401 it attempts one silent refresh and retries the original request.
 */
export class HttpApiClient implements ApiClient {
  private accessToken: string | null = null;

  constructor(private readonly baseUrl: string) {
    // Normalize: no trailing slash.
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  // ----- core request helper ------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    retryOn401 = true,
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    // Attempt a single silent refresh on 401, then retry once.
    if (res.status === 401 && retryOn401 && path !== '/auth/refresh' && path !== '/auth/login') {
      const refreshed = await this.tryRefresh();
      if (refreshed) return this.request<T>(method, path, body, false);
    }

    if (!res.ok) {
      await this.throwFromResponse(res);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  private async throwFromResponse(res: Response): Promise<never> {
    let payload: ErrorEnvelope | undefined;
    try {
      payload = (await res.json()) as ErrorEnvelope;
    } catch {
      // non-JSON error body
    }
    const code = payload?.error?.code ?? STATUS_TO_CODE[res.status] ?? 'SERVER_ERROR';
    const message = payload?.error?.message ?? res.statusText ?? 'Request failed';
    throw new ApiClientError(code, message, payload?.error?.details);
  }

  private async tryRefresh(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;
      const data = (await res.json()) as RefreshResponse;
      this.accessToken = data.accessToken;
      return true;
    } catch {
      return false;
    }
  }

  private qs(params: Record<string, string | string[] | undefined>): string {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) value.forEach((v) => sp.append(key, v));
      else sp.append(key, value);
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
  }

  // ----- auth ---------------------------------------------------------------

  async login(req: LoginRequest): Promise<LoginResponse> {
    const res = await this.request<LoginResponse>('POST', '/auth/login', req);
    this.accessToken = res.accessToken;
    return res;
  }

  async refresh(): Promise<RefreshResponse> {
    const res = await this.request<RefreshResponse>('POST', '/auth/refresh', undefined, false);
    this.accessToken = res.accessToken;
    return res;
  }

  async logout(): Promise<void> {
    await this.request<void>('POST', '/auth/logout');
    this.accessToken = null;
  }

  async me(): Promise<AuthUser> {
    return this.request<AuthUser>('GET', '/auth/me');
  }

  // ----- platform -----------------------------------------------------------

  createSalon(req: CreateSalonRequest): Promise<Salon> {
    return this.request<Salon>('POST', '/platform/salons', req);
  }

  listSalons(): Promise<Salon[]> {
    return this.request<Salon[]>('GET', '/platform/salons');
  }

  // ----- salon settings + users --------------------------------------------

  getSalon(): Promise<Salon> {
    return this.request<Salon>('GET', '/salon');
  }

  updateSalon(req: UpdateSalonRequest): Promise<Salon> {
    return this.request<Salon>('PUT', '/salon', req);
  }

  listSalonUsers(): Promise<SalonUser[]> {
    return this.request<SalonUser[]>('GET', '/salon/users');
  }

  createSalonUser(req: CreateSalonUserRequest): Promise<SalonUser> {
    return this.request<SalonUser>('POST', '/salon/users', req);
  }

  updateSalonUser(id: string, req: UpdateSalonUserRequest): Promise<SalonUser> {
    return this.request<SalonUser>('PATCH', `/salon/users/${encodeURIComponent(id)}`, req);
  }

  deleteSalonUser(id: string): Promise<void> {
    return this.request<void>('DELETE', `/salon/users/${encodeURIComponent(id)}`);
  }

  // ----- services -----------------------------------------------------------

  listServices(): Promise<Service[]> {
    return this.request<Service[]>('GET', '/services');
  }

  createService(req: CreateServiceRequest): Promise<Service> {
    return this.request<Service>('POST', '/services', req);
  }

  updateService(id: string, req: UpdateServiceRequest): Promise<Service> {
    return this.request<Service>('PUT', `/services/${encodeURIComponent(id)}`, req);
  }

  deleteService(id: string): Promise<void> {
    return this.request<void>('DELETE', `/services/${encodeURIComponent(id)}`);
  }

  // ----- employees ----------------------------------------------------------

  listEmployees(): Promise<Employee[]> {
    return this.request<Employee[]>('GET', '/employees');
  }

  getEmployee(id: string): Promise<Employee> {
    return this.request<Employee>('GET', `/employees/${encodeURIComponent(id)}`);
  }

  createEmployee(req: CreateEmployeeRequest): Promise<Employee> {
    return this.request<Employee>('POST', '/employees', req);
  }

  updateEmployee(id: string, req: UpdateEmployeeRequest): Promise<Employee> {
    return this.request<Employee>('PUT', `/employees/${encodeURIComponent(id)}`, req);
  }

  deleteEmployee(id: string): Promise<void> {
    return this.request<void>('DELETE', `/employees/${encodeURIComponent(id)}`);
  }

  addEmployeeLeave(employeeId: string, req: AddLeaveRequest): Promise<LeaveRange> {
    return this.request<LeaveRange>('POST', `/employees/${encodeURIComponent(employeeId)}/leave`, req);
  }

  removeEmployeeLeave(employeeId: string, leaveId: string): Promise<void> {
    return this.request<void>(
      'DELETE',
      `/employees/${encodeURIComponent(employeeId)}/leave/${encodeURIComponent(leaveId)}`,
    );
  }

  addEmployeeOverride(employeeId: string, req: AddOverrideRequest): Promise<ScheduleOverride> {
    return this.request<ScheduleOverride>(
      'POST',
      `/employees/${encodeURIComponent(employeeId)}/overrides`,
      req,
    );
  }

  removeEmployeeOverride(employeeId: string, overrideId: string): Promise<void> {
    return this.request<void>(
      'DELETE',
      `/employees/${encodeURIComponent(employeeId)}/overrides/${encodeURIComponent(overrideId)}`,
    );
  }

  // ----- holidays -----------------------------------------------------------

  listHolidays(): Promise<Holiday[]> {
    return this.request<Holiday[]>('GET', '/holidays');
  }

  // ----- customers ----------------------------------------------------------

  searchCustomers(search: string): Promise<Customer[]> {
    return this.request<Customer[]>('GET', `/customers${this.qs({ search })}`);
  }

  createCustomer(req: CreateCustomerRequest): Promise<Customer> {
    return this.request<Customer>('POST', '/customers', req);
  }

  // ----- availability -------------------------------------------------------

  getAvailability(query: AvailabilityQuery): Promise<ProfessionalAvailability[]> {
    return this.request<ProfessionalAvailability[]>(
      'GET',
      `/availability${this.qs({
        date: query.date,
        serviceIds: query.serviceIds,
        employeeId: query.employeeId,
      })}`,
    );
  }

  // ----- bookings -----------------------------------------------------------

  createBooking(req: CreateBookingRequest): Promise<Booking> {
    return this.request<Booking>('POST', '/bookings', req);
  }

  listBookings(query: BookingListQuery): Promise<Booking[]> {
    return this.request<Booking[]>(
      'GET',
      `/bookings${this.qs({ from: query.from, to: query.to, employeeId: query.employeeId })}`,
    );
  }

  getBooking(id: string): Promise<Booking> {
    return this.request<Booking>('GET', `/bookings/${encodeURIComponent(id)}`);
  }
}
