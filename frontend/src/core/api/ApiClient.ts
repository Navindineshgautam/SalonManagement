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
} from './types';

/**
 * The single contract implemented by both the mock adapter (Phase 1 frontend)
 * and the real HTTP client (after the backend is built). Swapping adapters is a
 * one-line change; screens depend only on this interface.
 *
 * Every method may reject with an `ApiError`. Tenant scoping and role checks are
 * enforced by the implementation, mirroring the authoritative backend.
 */
export interface ApiClient {
  // ----- Auth ---------------------------------------------------------------
  login(req: LoginRequest): Promise<LoginResponse>;
  refresh(): Promise<RefreshResponse>;
  logout(): Promise<void>;
  me(): Promise<AuthUser>;

  // ----- Platform (Super Admin) --------------------------------------------
  createSalon(req: CreateSalonRequest): Promise<Salon>;
  listSalons(): Promise<Salon[]>;

  // ----- Salon settings + users --------------------------------------------
  getSalon(): Promise<Salon>;
  updateSalon(req: UpdateSalonRequest): Promise<Salon>;
  listSalonUsers(): Promise<SalonUser[]>;
  createSalonUser(req: CreateSalonUserRequest): Promise<SalonUser>;
  updateSalonUser(id: string, req: UpdateSalonUserRequest): Promise<SalonUser>;
  deleteSalonUser(id: string): Promise<void>;

  // ----- Services -----------------------------------------------------------
  listServices(): Promise<Service[]>;
  createService(req: CreateServiceRequest): Promise<Service>;
  updateService(id: string, req: UpdateServiceRequest): Promise<Service>;
  deleteService(id: string): Promise<void>;

  // ----- Employees ----------------------------------------------------------
  listEmployees(): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee>;
  createEmployee(req: CreateEmployeeRequest): Promise<Employee>;
  updateEmployee(id: string, req: UpdateEmployeeRequest): Promise<Employee>;
  deleteEmployee(id: string): Promise<void>;
  addEmployeeLeave(employeeId: string, req: AddLeaveRequest): Promise<LeaveRange>;
  removeEmployeeLeave(employeeId: string, leaveId: string): Promise<void>;
  addEmployeeOverride(employeeId: string, req: AddOverrideRequest): Promise<ScheduleOverride>;
  removeEmployeeOverride(employeeId: string, overrideId: string): Promise<void>;

  // ----- Holidays -----------------------------------------------------------
  listHolidays(): Promise<Holiday[]>;

  // ----- Customers ----------------------------------------------------------
  searchCustomers(search: string): Promise<Customer[]>;
  createCustomer(req: CreateCustomerRequest): Promise<Customer>;

  // ----- Availability -------------------------------------------------------
  getAvailability(query: AvailabilityQuery): Promise<ProfessionalAvailability[]>;

  // ----- Bookings -----------------------------------------------------------
  createBooking(req: CreateBookingRequest): Promise<Booking>;
  listBookings(query: BookingListQuery): Promise<Booking[]>;
  getBooking(id: string): Promise<Booking>;
}
