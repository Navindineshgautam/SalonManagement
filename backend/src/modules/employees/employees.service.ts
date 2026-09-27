import { prisma } from '../../core/db/prisma';
import { DAY_END_MINUTE, DAY_START_MINUTE } from '../../config';
import { notFound, validationError } from '../../core/http/errors';
import { employeeInclude, toEmployee } from '../../core/http/mappers';
import type {
  BreakInterval,
  Employee,
  LeaveRange,
  ScheduleOverride,
  WorkingHour,
} from '../../core/http/contract';

const toDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

const validateInterval = (i: { startMinute: number; endMinute: number }, label: string): void => {
  if (
    i.startMinute < DAY_START_MINUTE ||
    i.endMinute > DAY_END_MINUTE ||
    i.endMinute <= i.startMinute
  ) {
    throw validationError('Invalid schedule interval', [
      {
        field: label,
        message: `Times must be within ${DAY_START_MINUTE}-${DAY_END_MINUTE} minutes and end after start`,
      },
    ]);
  }
};

const validateSchedule = (workingHours: WorkingHour[], breaks: BreakInterval[]): void => {
  workingHours.forEach((w) => validateInterval(w, 'workingHours'));
  breaks.forEach((b) => validateInterval(b, 'breaks'));
};

/** Load a salon-scoped employee with all relations, or throw 404. */
const loadEmployee = async (salonId: string, id: string) => {
  const emp = await prisma.employee.findFirst({
    where: { id, salonId },
    include: employeeInclude,
  });
  if (!emp) throw notFound('Employee not found');
  return emp;
};

export const listEmployees = async (salonId: string): Promise<Employee[]> => {
  const employees = await prisma.employee.findMany({
    where: { salonId },
    include: employeeInclude,
    orderBy: { createdAt: 'asc' },
  });
  return employees.map(toEmployee);
};

export const getEmployee = async (salonId: string, id: string): Promise<Employee> =>
  toEmployee(await loadEmployee(salonId, id));

export interface CreateEmployeeInput {
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

/** Ensure every serviceId belongs to this salon. */
const assertServicesInSalon = async (salonId: string, serviceIds: string[]): Promise<void> => {
  if (serviceIds.length === 0) return;
  const count = await prisma.service.count({
    where: { salonId, id: { in: serviceIds } },
  });
  if (count !== new Set(serviceIds).size) {
    throw validationError('Unknown service', [
      { field: 'serviceIds', message: 'One or more services do not exist in this salon' },
    ]);
  }
};

export const createEmployee = async (
  salonId: string,
  input: CreateEmployeeInput,
): Promise<Employee> => {
  validateSchedule(input.workingHours, input.breaks);
  await assertServicesInSalon(salonId, input.serviceIds);

  const created = await prisma.$transaction(async (tx) => {
    const emp = await tx.employee.create({
      data: {
        salonId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        role: input.role,
        specialization: input.specialization,
        weeklyOff: input.weeklyOff,
        status: 'ACTIVE',
        employeeServices: { create: input.serviceIds.map((serviceId) => ({ serviceId })) },
        workingHours: {
          create: input.workingHours.map((w) => ({
            weekday: w.weekday,
            startMinute: w.startMinute,
            endMinute: w.endMinute,
          })),
        },
        breaks: {
          create: input.breaks.map((b) => ({
            weekday: b.weekday,
            startMinute: b.startMinute,
            endMinute: b.endMinute,
          })),
        },
      },
      include: employeeInclude,
    });
    return emp;
  });
  return toEmployee(created);
};

export interface UpdateEmployeeInput extends Partial<CreateEmployeeInput> {
  status?: 'ACTIVE' | 'INACTIVE';
}

export const updateEmployee = async (
  salonId: string,
  id: string,
  input: UpdateEmployeeInput,
): Promise<Employee> => {
  await loadEmployee(salonId, id); // 404 if cross-tenant/missing
  if (input.workingHours) input.workingHours.forEach((w) => validateInterval(w, 'workingHours'));
  if (input.breaks) input.breaks.forEach((b) => validateInterval(b, 'breaks'));
  if (input.serviceIds) await assertServicesInSalon(salonId, input.serviceIds);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id },
      data: {
        ...(input.name != null ? { name: input.name } : {}),
        ...(input.phone != null ? { phone: input.phone } : {}),
        ...(input.email != null ? { email: input.email } : {}),
        ...(input.role != null ? { role: input.role } : {}),
        ...(input.specialization != null ? { specialization: input.specialization } : {}),
        ...(input.weeklyOff !== undefined ? { weeklyOff: input.weeklyOff } : {}),
        ...(input.status != null ? { status: input.status } : {}),
      },
    });
    // Replace skill set if provided.
    if (input.serviceIds) {
      await tx.employeeService.deleteMany({ where: { employeeId: id } });
      await tx.employeeService.createMany({
        data: input.serviceIds.map((serviceId) => ({ employeeId: id, serviceId })),
      });
    }
    // Replace working hours if provided.
    if (input.workingHours) {
      await tx.workingHour.deleteMany({ where: { employeeId: id } });
      await tx.workingHour.createMany({
        data: input.workingHours.map((w) => ({
          employeeId: id,
          weekday: w.weekday,
          startMinute: w.startMinute,
          endMinute: w.endMinute,
        })),
      });
    }
    // Replace breaks if provided.
    if (input.breaks) {
      await tx.break.deleteMany({ where: { employeeId: id } });
      await tx.break.createMany({
        data: input.breaks.map((b) => ({
          employeeId: id,
          weekday: b.weekday,
          startMinute: b.startMinute,
          endMinute: b.endMinute,
        })),
      });
    }
    return tx.employee.findUniqueOrThrow({ where: { id }, include: employeeInclude });
  });
  return toEmployee(updated);
};

export const deleteEmployee = async (salonId: string, id: string): Promise<void> => {
  await loadEmployee(salonId, id);
  await prisma.employee.delete({ where: { id } });
};

// ----- Leave --------------------------------------------------------------

export const addLeave = async (
  salonId: string,
  employeeId: string,
  startDate: string,
  endDate: string,
): Promise<LeaveRange> => {
  await loadEmployee(salonId, employeeId);
  if (endDate < startDate) {
    throw validationError('Invalid leave range', [
      { field: 'endDate', message: 'End date must be on or after start date' },
    ]);
  }
  const leave = await prisma.leave.create({
    data: { employeeId, startDate: toDate(startDate), endDate: toDate(endDate) },
  });
  return {
    id: leave.id,
    startDate: leave.startDate.toISOString().slice(0, 10),
    endDate: leave.endDate.toISOString().slice(0, 10),
  };
};

export const removeLeave = async (
  salonId: string,
  employeeId: string,
  leaveId: string,
): Promise<void> => {
  await loadEmployee(salonId, employeeId);
  await prisma.leave.deleteMany({ where: { id: leaveId, employeeId } });
};

// ----- Overrides ----------------------------------------------------------

export interface AddOverrideInput {
  date: string;
  type: 'EXTRA_HOURS' | 'TIME_OFF';
  startMinute?: number;
  endMinute?: number;
}

export const addOverride = async (
  salonId: string,
  employeeId: string,
  input: AddOverrideInput,
): Promise<ScheduleOverride> => {
  await loadEmployee(salonId, employeeId);
  // EXTRA_HOURS must carry a bounded interval; TIME_OFF may be full-day (no bounds).
  if (input.type === 'EXTRA_HOURS' && (input.startMinute == null || input.endMinute == null)) {
    throw validationError('EXTRA_HOURS override requires a time range', [
      { field: 'startMinute', message: 'Start and end minute are required for extra hours' },
    ]);
  }
  if (input.startMinute != null && input.endMinute != null) {
    validateInterval({ startMinute: input.startMinute, endMinute: input.endMinute }, 'override');
  }
  const created = await prisma.scheduleOverride.create({
    data: {
      employeeId,
      date: toDate(input.date),
      type: input.type,
      startMinute: input.startMinute ?? null,
      endMinute: input.endMinute ?? null,
    },
  });
  return {
    id: created.id,
    date: created.date.toISOString().slice(0, 10),
    type: created.type,
    startMinute: created.startMinute ?? undefined,
    endMinute: created.endMinute ?? undefined,
  };
};

export const removeOverride = async (
  salonId: string,
  employeeId: string,
  overrideId: string,
): Promise<void> => {
  await loadEmployee(salonId, employeeId);
  await prisma.scheduleOverride.deleteMany({ where: { id: overrideId, employeeId } });
};
