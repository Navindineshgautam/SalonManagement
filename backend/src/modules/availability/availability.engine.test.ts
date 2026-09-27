import { availableSlotStarts, freeIntervalsFor, type BookedBlock } from './availability.engine';
import { utcIsoToLocalMinutes } from '../../shared/time/datetime';
import type { Employee } from '../../core/http/contract';

const TZ = 'Asia/Kolkata';

// A stylist working 10:00-19:00 every day with a 13:00-14:00 lunch break,
// Sunday off. Mirrors the seed's "Arya".
const baseEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  id: 'emp-1',
  salonId: 'salon-1',
  name: 'Test Stylist',
  phone: '',
  email: '',
  role: 'Stylist',
  specialization: 'Hair',
  status: 'ACTIVE',
  serviceIds: ['svc-1'],
  weeklyOff: 0, // Sunday
  workingHours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    startMinute: 600,
    endMinute: 1140,
  })),
  breaks: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    startMinute: 780,
    endMinute: 840,
  })),
  leaves: [],
  overrides: [],
  ...overrides,
});

// 2026-01-05 is a Monday (weekday 1).
const MONDAY = '2026-01-05';
const SUNDAY = '2026-01-04';

describe('freeIntervalsFor', () => {
  it('splits the working day around the lunch break', () => {
    const free = freeIntervalsFor(baseEmployee(), MONDAY, TZ, [], []);
    expect(free).toEqual([
      { startMinute: 600, endMinute: 780 },
      { startMinute: 840, endMinute: 1140 },
    ]);
  });

  it('returns no intervals on the weekly off day', () => {
    expect(freeIntervalsFor(baseEmployee(), SUNDAY, TZ, [], [])).toEqual([]);
  });

  it('returns no intervals on a salon holiday', () => {
    expect(freeIntervalsFor(baseEmployee(), MONDAY, TZ, [], [MONDAY])).toEqual([]);
  });

  it('returns no intervals during leave', () => {
    const emp = baseEmployee({ leaves: [{ id: 'l1', startDate: MONDAY, endDate: MONDAY }] });
    expect(freeIntervalsFor(emp, MONDAY, TZ, [], [])).toEqual([]);
  });

  it('subtracts an existing booking from availability', () => {
    // A booking 11:00-12:00 local -> block 660-720.
    const booked: BookedBlock[] = [
      {
        employeeId: 'emp-1',
        // 11:00 IST == 05:30 UTC
        startAt: '2026-01-05T05:30:00.000Z',
        endAt: '2026-01-05T06:30:00.000Z',
      },
    ];
    const free = freeIntervalsFor(baseEmployee(), MONDAY, TZ, booked, []);
    expect(free).toEqual([
      { startMinute: 600, endMinute: 660 },
      { startMinute: 720, endMinute: 780 },
      { startMinute: 840, endMinute: 1140 },
    ]);
  });

  it('full-day TIME_OFF override clears availability', () => {
    const emp = baseEmployee({
      overrides: [{ id: 'o1', date: MONDAY, type: 'TIME_OFF' }],
    });
    expect(freeIntervalsFor(emp, MONDAY, TZ, [], [])).toEqual([]);
  });

  it('EXTRA_HOURS override extends the working window', () => {
    const emp = baseEmployee({
      overrides: [{ id: 'o1', date: MONDAY, type: 'EXTRA_HOURS', startMinute: 1140, endMinute: 1200 }],
    });
    const free = freeIntervalsFor(emp, MONDAY, TZ, [], []);
    expect(free).toEqual([
      { startMinute: 600, endMinute: 780 },
      { startMinute: 840, endMinute: 1200 },
    ]);
  });
});

describe('availableSlotStarts', () => {
  it('emits 15-min-aligned UTC starts where the duration fits', () => {
    // 45-min service in the morning block 600-780 -> last start 735.
    const starts = availableSlotStarts(baseEmployee(), MONDAY, TZ, 45, [], []);
    // Convert back to local minutes to assert alignment/fit.
    const localStarts = starts.map((s) => utcIsoToLocalMinutes(s, TZ));
    // Morning block starts: 600..735 step 15; afternoon 840..1095 step 15.
    expect(localStarts[0]).toBe(600);
    expect(localStarts).toContain(735);
    expect(localStarts).not.toContain(750); // 750+45=795 > 780 break
    expect(localStarts).toContain(840);
    expect(localStarts[localStarts.length - 1]).toBe(1095); // 1095+45=1140 end
  });

  it('round-trips salon-local time to correct UTC (IST = UTC+5:30)', () => {
    const [first] = availableSlotStarts(baseEmployee(), MONDAY, TZ, 45, [], []);
    // 10:00 IST == 04:30 UTC
    expect(first).toBe('2026-01-05T04:30:00.000Z');
  });
});
