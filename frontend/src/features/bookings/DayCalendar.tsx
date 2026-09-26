import type { Booking, Employee } from '@/core/api/types';
import { DAY_END_MINUTE, DAY_START_MINUTE } from '@/core/config';
import { utcIsoToLocalMinutes } from '@/shared/utils/datetime';
import { minutesToHHMM } from '@/shared/utils/intervals';

const PIXELS_PER_MINUTE = 1; // 18 hours * 60 = 1080px column height
const HOUR_MARKS = Array.from(
  { length: (DAY_END_MINUTE - DAY_START_MINUTE) / 60 + 1 },
  (_, i) => DAY_START_MINUTE + i * 60
);

interface PlacedItem {
  bookingId: string;
  employeeId: string;
  top: number;
  height: number;
  label: string;
  sub: string;
}

/**
 * A day view with one column per professional. Booking items are positioned by
 * their salon-local start/end minutes.
 */
export function DayCalendar({
  employees,
  bookings,
  timezone,
  onSelect,
}: {
  employees: Employee[];
  bookings: Booking[];
  timezone: string;
  onSelect: (booking: Booking) => void;
}) {
  const columnHeight = (DAY_END_MINUTE - DAY_START_MINUTE) * PIXELS_PER_MINUTE;

  const itemsByEmployee = new Map<string, PlacedItem[]>();
  for (const booking of bookings) {
    for (const item of booking.items) {
      const startMin = utcIsoToLocalMinutes(item.startAt, timezone);
      const endMin = utcIsoToLocalMinutes(item.endAt, timezone);
      const placed: PlacedItem = {
        bookingId: booking.id,
        employeeId: item.employeeId,
        top: (startMin - DAY_START_MINUTE) * PIXELS_PER_MINUTE,
        height: Math.max((endMin - startMin) * PIXELS_PER_MINUTE, 18),
        label: booking.customerName,
        sub: item.serviceName,
      };
      itemsByEmployee.set(item.employeeId, [...(itemsByEmployee.get(item.employeeId) ?? []), placed]);
    }
  }

  const findBooking = (id: string) => bookings.find((b) => b.id === id)!;

  return (
    <div className="overflow-auto">
      <div className="flex min-w-max">
        {/* time gutter */}
        <div className="w-14 shrink-0">
          <div className="h-10" />
          <div className="relative" style={{ height: columnHeight }}>
            {HOUR_MARKS.map((m) => (
              <div
                key={m}
                className="absolute left-0 right-0 -translate-y-1/2 pr-2 text-right text-[10px] text-slate-400"
                style={{ top: (m - DAY_START_MINUTE) * PIXELS_PER_MINUTE }}
              >
                {minutesToHHMM(m)}
              </div>
            ))}
          </div>
        </div>

        {/* professional columns */}
        {employees.map((emp) => (
          <div key={emp.id} className="w-44 shrink-0 border-l border-slate-100">
            <div className="flex h-10 items-center justify-center border-b border-slate-100 px-2 text-xs font-medium text-slate-600">
              {emp.name}
            </div>
            <div className="relative bg-white" style={{ height: columnHeight }}>
              {HOUR_MARKS.map((m) => (
                <div
                  key={m}
                  className="absolute left-0 right-0 border-t border-slate-50"
                  style={{ top: (m - DAY_START_MINUTE) * PIXELS_PER_MINUTE }}
                />
              ))}
              {(itemsByEmployee.get(emp.id) ?? []).map((it, idx) => (
                <button
                  key={`${it.bookingId}-${idx}`}
                  onClick={() => onSelect(findBooking(it.bookingId))}
                  className="absolute left-1 right-1 overflow-hidden rounded-md border border-brand-300 bg-brand-50 px-1 py-0.5 text-left text-[10px] leading-tight text-brand-800 hover:bg-brand-100"
                  style={{ top: it.top, height: it.height }}
                >
                  <span className="block font-semibold">{it.label}</span>
                  <span className="block truncate">{it.sub}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
