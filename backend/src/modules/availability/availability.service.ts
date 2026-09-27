import { prisma } from '../../core/db/prisma';
import { notFound, validationError } from '../../core/http/errors';
import { employeeInclude, toEmployee } from '../../core/http/mappers';
import { utcIsoToLocalDate } from '../../shared/time/datetime';
import type { ProfessionalAvailability } from '../../core/http/contract';
import { availableSlotStarts, type BookedBlock } from './availability.engine';

export interface AvailabilityQuery {
  date: string;
  serviceIds: string[];
  employeeId?: string;
}

/**
 * Load all booking items for a salon that fall on `date` in the salon timezone,
 * as BookedBlocks for the availability engine. We over-fetch a ±1 day window in
 * UTC (timezone offsets never exceed 24h) then filter to the local date.
 */
export const loadBookedBlocks = async (
  salonId: string,
  date: string,
  timezone: string,
): Promise<BookedBlock[]> => {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const from = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000);
  const to = new Date(dayStart.getTime() + 48 * 60 * 60 * 1000);
  const items = await prisma.bookingItem.findMany({
    where: { booking: { salonId }, startAt: { gte: from, lt: to } },
  });
  return items
    .map((it) => ({
      employeeId: it.employeeId,
      startAt: it.startAt.toISOString(),
      endAt: it.endAt.toISOString(),
    }))
    .filter((b) => utcIsoToLocalDate(b.startAt, timezone) === date);
};

export const getAvailability = async (
  salonId: string,
  query: AvailabilityQuery,
): Promise<ProfessionalAvailability[]> => {
  const salon = await prisma.salon.findUnique({ where: { id: salonId } });
  if (!salon) throw notFound('Salon not found');

  if (query.serviceIds.length === 0) {
    throw validationError('Select at least one service', [
      { field: 'serviceIds', message: 'At least one service is required' },
    ]);
  }

  // Resolve services (must all belong to the salon) and total duration.
  const services = await prisma.service.findMany({
    where: { salonId, id: { in: query.serviceIds } },
  });
  if (services.length !== new Set(query.serviceIds).size) {
    throw notFound('Service not found');
  }
  const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0);
  const requiredServiceIds = new Set(query.serviceIds);

  // Eligible = active employees (optionally filtered to one) whose skills cover
  // ALL requested services.
  const employees = await prisma.employee.findMany({
    where: {
      salonId,
      status: 'ACTIVE',
      ...(query.employeeId ? { id: query.employeeId } : {}),
    },
    include: employeeInclude,
  });
  const eligible = employees
    .map(toEmployee)
    .filter((e) => [...requiredServiceIds].every((sid) => e.serviceIds.includes(sid)));

  const booked = await loadBookedBlocks(salonId, query.date, salon.timezone);

  const holidays = await prisma.holiday.findMany({ where: { salonId } });
  const holidayDates = holidays.map((h) => h.date.toISOString().slice(0, 10));

  return eligible.map((emp) => {
    const starts = availableSlotStarts(
      emp,
      query.date,
      salon.timezone,
      totalDuration,
      booked,
      holidayDates,
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
};
