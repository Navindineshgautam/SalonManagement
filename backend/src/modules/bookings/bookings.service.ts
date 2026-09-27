import { Prisma } from '@prisma/client';
import { prisma } from '../../core/db/prisma';
import { conflict, notFound, validationError } from '../../core/http/errors';
import { bookingInclude, employeeInclude, toBooking, toEmployee } from '../../core/http/mappers';
import { utcIsoToLocalDate, utcIsoToLocalMinutes } from '../../shared/time/datetime';
import { overlaps } from '../../shared/time/intervals';
import { resolveOrCreateCustomer, type CreateCustomerInput } from '../customers/customers.service';
import { freeIntervalsFor, type BookedBlock } from '../availability/availability.engine';
import type { Booking } from '../../core/http/contract';

export interface BookingItemInput {
  serviceId: string;
  employeeId: string;
}

export interface CreateBookingInput {
  customerId?: string;
  customer?: CreateCustomerInput;
  startAt: string;
  items: BookingItemInput[];
}

export interface BookingListQuery {
  from: string;
  to: string;
  employeeId?: string;
}

/** A fully-scheduled item computed before persistence. */
interface ScheduledItem {
  serviceId: string;
  employeeId: string;
  startAtMs: number;
  endAtMs: number;
}

const MAX_SERIALIZATION_RETRIES = 3;

/**
 * Create a booking. Runs in a SERIALIZABLE transaction and retries a bounded
 * number of times on serialization failure. On any schedule conflict the whole
 * transaction aborts (nothing persists) and a 409 is returned.
 *
 * Guarantees:
 *  - Atomicity (Property 3): Booking + all BookingItems commit together or not at all.
 *  - No double-booking (Property 2): each item is re-validated against the
 *    professional's free intervals and checked for overlap with existing items
 *    inside the serializable transaction; concurrent creators for the same slot
 *    cannot both commit.
 */
export const createBooking = async (
  salonId: string,
  createdBy: string,
  input: CreateBookingInput,
): Promise<Booking> => {
  if (!input.items || input.items.length === 0) {
    throw validationError('A booking needs at least one service', [
      { field: 'items', message: 'Add at least one service' },
    ]);
  }

  for (let attempt = 0; ; attempt += 1) {
    try {
      const bookingId = await prisma.$transaction(
        async (tx) => createBookingTx(tx, salonId, createdBy, input),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      const created = await prisma.booking.findUniqueOrThrow({
        where: { id: bookingId },
        include: bookingInclude,
      });
      return toBooking(created);
    } catch (err) {
      if (isSerializationFailure(err) && attempt < MAX_SERIALIZATION_RETRIES) {
        continue; // retry
      }
      if (isSerializationFailure(err)) {
        // Exhausted retries: treat as a conflict (someone else won the slot).
        throw conflict('Could not reserve the slot, please try again');
      }
      throw err;
    }
  }
};

const isSerializationFailure = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && (err.code === 'P2034' || err.code === 'P2002');

const createBookingTx = async (
  tx: Prisma.TransactionClient,
  salonId: string,
  createdBy: string,
  input: CreateBookingInput,
): Promise<string> => {
  const salon = await tx.salon.findUnique({ where: { id: salonId } });
  if (!salon) throw notFound('Salon not found');

  // Resolve customer.
  let customerId: string;
  if (input.customerId) {
    const customer = await tx.customer.findFirst({
      where: { id: input.customerId, salonId },
    });
    if (!customer) throw notFound('Customer not found');
    customerId = customer.id;
  } else if (input.customer) {
    const customer = await resolveOrCreateCustomer(salonId, input.customer, tx);
    customerId = customer.id;
  } else {
    throw validationError('Customer required', [
      { field: 'customer', message: 'Provide an existing customer or new customer info' },
    ]);
  }

  // Schedule items: sequential per professional, parallel across professionals.
  const bookingStartMs = new Date(input.startAt).getTime();
  const cursorByEmployee = new Map<string, number>();
  const scheduled: ScheduledItem[] = [];

  for (const item of input.items) {
    const svc = await tx.service.findFirst({ where: { id: item.serviceId, salonId } });
    if (!svc) throw notFound('Service not found');
    const emp = await tx.employee.findFirst({ where: { id: item.employeeId, salonId } });
    if (!emp) throw notFound('Professional not found');
    const canPerform = await tx.employeeService.findUnique({
      where: { employeeId_serviceId: { employeeId: emp.id, serviceId: svc.id } },
    });
    if (!canPerform) {
      throw validationError('Professional cannot perform this service', [
        { field: 'items', message: `${emp.name} cannot perform ${svc.name}` },
      ]);
    }
    const startMs = cursorByEmployee.get(emp.id) ?? bookingStartMs;
    const endMs = startMs + svc.durationMinutes * 60000;
    cursorByEmployee.set(emp.id, endMs);
    scheduled.push({
      serviceId: svc.id,
      employeeId: emp.id,
      startAtMs: startMs,
      endAtMs: endMs,
    });
  }

  // Re-validate each item against the professional's schedule + existing bookings.
  await validateScheduled(tx, salonId, salon.timezone, scheduled);

  // Persist the booking + items.
  const spanStart = new Date(Math.min(...scheduled.map((s) => s.startAtMs)));
  const spanEnd = new Date(Math.max(...scheduled.map((s) => s.endAtMs)));
  const booking = await tx.booking.create({
    data: {
      salonId,
      customerId,
      startAt: spanStart,
      endAt: spanEnd,
      status: 'BOOKED',
      createdBy,
      items: {
        create: scheduled.map((s) => ({
          serviceId: s.serviceId,
          employeeId: s.employeeId,
          startAt: new Date(s.startAtMs),
          endAt: new Date(s.endAtMs),
        })),
      },
    },
  });
  return booking.id;
};

/**
 * Validate every scheduled item: it must fit inside a free interval of the
 * professional's schedule AND must not overlap any existing booking item for
 * that professional. Also rejects overlaps between items of the same booking.
 */
const validateScheduled = async (
  tx: Prisma.TransactionClient,
  salonId: string,
  timezone: string,
  scheduled: ScheduledItem[],
): Promise<void> => {
  // Load each involved employee (with schedule relations) once.
  const employeeIds = [...new Set(scheduled.map((s) => s.employeeId))];
  const employees = await Promise.all(
    employeeIds.map((id) =>
      tx.employee.findUniqueOrThrow({ where: { id }, include: employeeInclude }),
    ),
  );
  const employeeById = new Map(employees.map((e) => [e.id, toEmployee(e)]));

  // Existing booking items for these employees (any date) — filtered per date below.
  const existing = await tx.bookingItem.findMany({
    where: { booking: { salonId }, employeeId: { in: employeeIds } },
  });

  const holidays = await tx.holiday.findMany({ where: { salonId } });
  const holidayDates = holidays.map((h) => h.date.toISOString().slice(0, 10));

  for (const item of scheduled) {
    const emp = employeeById.get(item.employeeId)!;
    const startIso = new Date(item.startAtMs).toISOString();
    const endIso = new Date(item.endAtMs).toISOString();
    const date = utcIsoToLocalDate(startIso, timezone);
    const startMin = utcIsoToLocalMinutes(startIso, timezone);
    const endMin = utcIsoToLocalMinutes(endIso, timezone);

    // Booked blocks that block this employee: existing items + other items in
    // THIS booking for the same employee that come earlier (sequential fill
    // already handles ordering, but overlapping same-employee inputs must fail).
    const bookedBlocks: BookedBlock[] = existing.map((it) => ({
      employeeId: it.employeeId,
      startAt: it.startAt.toISOString(),
      endAt: it.endAt.toISOString(),
    }));

    // Free intervals with existing bookings already subtracted.
    const free = freeIntervalsFor(emp, date, timezone, bookedBlocks, holidayDates);
    const fits = free.some((iv) => startMin >= iv.startMinute && endMin <= iv.endMinute);
    if (!fits) {
      throw conflict(`${emp.name} is not available at the requested time`);
    }

    // Explicit overlap check against existing items for this employee on this date.
    const overlapsExisting = existing
      .filter(
        (it) =>
          it.employeeId === emp.id && utcIsoToLocalDate(it.startAt.toISOString(), timezone) === date,
      )
      .some((it) =>
        overlaps(
          { startMinute: startMin, endMinute: endMin },
          {
            startMinute: utcIsoToLocalMinutes(it.startAt.toISOString(), timezone),
            endMinute: utcIsoToLocalMinutes(it.endAt.toISOString(), timezone),
          },
        ),
      );
    if (overlapsExisting) {
      throw conflict(`${emp.name} already has a booking overlapping this time`);
    }
  }
};

// ----- list / get ---------------------------------------------------------

export const listBookings = async (
  salonId: string,
  query: BookingListQuery,
): Promise<Booking[]> => {
  const salon = await prisma.salon.findUnique({ where: { id: salonId } });
  if (!salon) throw notFound('Salon not found');

  const bookings = await prisma.booking.findMany({
    where: {
      salonId,
      ...(query.employeeId ? { items: { some: { employeeId: query.employeeId } } } : {}),
    },
    include: bookingInclude,
    orderBy: { startAt: 'asc' },
  });

  return bookings
    .map(toBooking)
    .filter((b) => {
      const date = utcIsoToLocalDate(b.startAt, salon.timezone);
      return date >= query.from && date <= query.to;
    });
};

export const getBooking = async (salonId: string, id: string): Promise<Booking> => {
  const booking = await prisma.booking.findFirst({
    where: { id, salonId },
    include: bookingInclude,
  });
  if (!booking) throw notFound('Booking not found');
  return toBooking(booking);
};
