import { DAY_END_MINUTE, DAY_START_MINUTE, SLOT_MINUTES } from '../../config';
import {
  generateStartMinutes,
  intersectWithWindow,
  mergeIntervals,
  subtractIntervals,
  type TimeInterval,
} from '../../shared/time/intervals';
import {
  localMinutesToUtcIso,
  utcIsoToLocalDate,
  utcIsoToLocalMinutes,
  weekdayOf,
} from '../../shared/time/datetime';
import type { Employee } from '../../core/http/contract';

/**
 * A booked block for a professional, expressed as a UTC instant range. Mirrors
 * the shape the mock derives from Booking.items and passes into the engine.
 */
export interface BookedBlock {
  employeeId: string;
  startAt: string;
  endAt: string;
}

const dateInRange = (date: string, start: string, end: string) => date >= start && date <= end;

/**
 * Compute the free salon-local intervals for a professional on a given date:
 * working hours (∩ 06:00-24:00) + EXTRA_HOURS overrides − breaks − existing
 * bookings − TIME_OFF overrides. Returns [] when off/leave/holiday applies.
 *
 * Ported from the frontend mock's `freeIntervalsFor` so server and client agree
 * exactly (Correctness Property 1).
 */
export const freeIntervalsFor = (
  employee: Employee,
  date: string,
  timezone: string,
  booked: BookedBlock[],
  holidayDates: string[],
): TimeInterval[] => {
  const weekday = weekdayOf(date);

  // Weekly off
  if (employee.weeklyOff === weekday) return [];
  // Leave
  if (employee.leaves.some((l) => dateInRange(date, l.startDate, l.endDate))) return [];
  // Salon holiday
  if (holidayDates.includes(date)) return [];

  const dayOverrides = employee.overrides.filter((o) => o.date === date);
  const fullDayTimeOff = dayOverrides.some(
    (o) => o.type === 'TIME_OFF' && o.startMinute == null && o.endMinute == null,
  );
  if (fullDayTimeOff) return [];

  // Base working intervals for the weekday, clamped to the operating window.
  let base: TimeInterval[] = employee.workingHours
    .filter((wh) => wh.weekday === weekday)
    .map((wh) => ({ startMinute: wh.startMinute, endMinute: wh.endMinute }));

  // EXTRA_HOURS overrides extend the base window.
  const extra = dayOverrides
    .filter((o) => o.type === 'EXTRA_HOURS' && o.startMinute != null && o.endMinute != null)
    .map((o) => ({ startMinute: o.startMinute as number, endMinute: o.endMinute as number }));
  base = intersectWithWindow([...base, ...extra], DAY_START_MINUTE, DAY_END_MINUTE);
  if (base.length === 0) return [];

  // Blocked intervals: breaks + partial TIME_OFF + existing bookings for this employee.
  const breaks: TimeInterval[] = employee.breaks
    .filter((b) => b.weekday === weekday)
    .map((b) => ({ startMinute: b.startMinute, endMinute: b.endMinute }));

  const partialTimeOff = dayOverrides
    .filter((o) => o.type === 'TIME_OFF' && o.startMinute != null && o.endMinute != null)
    .map((o) => ({ startMinute: o.startMinute as number, endMinute: o.endMinute as number }));

  const bookedIntervals: TimeInterval[] = booked
    .filter(
      (it) => it.employeeId === employee.id && utcIsoToLocalDate(it.startAt, timezone) === date,
    )
    .map((it) => ({
      startMinute: utcIsoToLocalMinutes(it.startAt, timezone),
      endMinute: utcIsoToLocalMinutes(it.endAt, timezone),
    }));

  const blocked = mergeIntervals([...breaks, ...partialTimeOff, ...bookedIntervals]);
  return subtractIntervals(base, blocked);
};

/** Available UTC slot starts for a professional given total service duration. */
export const availableSlotStarts = (
  employee: Employee,
  date: string,
  timezone: string,
  totalDuration: number,
  booked: BookedBlock[],
  holidayDates: string[],
): string[] => {
  const free = freeIntervalsFor(employee, date, timezone, booked, holidayDates);
  const startMinutes = generateStartMinutes(free, totalDuration, SLOT_MINUTES);
  return startMinutes.map((m) => localMinutesToUtcIso(date, m, timezone));
};
