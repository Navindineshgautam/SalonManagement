/**
 * Timezone helpers converting between a salon-local calendar day + minutes and
 * UTC instants. Ported verbatim (behavior) from the frontend
 * `shared/utils/datetime.ts` so the server and client agree exactly.
 */

/** weekday index 0=Sun..6=Sat for a salon-local YYYY-MM-DD. */
export const weekdayOf = (dateStr: string): number => {
  // Treat as a plain calendar date (no tz), midday to avoid DST edge issues.
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
};

/** Offset (minutes) to add to UTC to get local time in `timeZone` at `utcDate`. */
const tzOffsetMinutes = (timeZone: string, utcDate: Date): number => {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(utcDate);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return (asUTC - utcDate.getTime()) / 60000;
};

/**
 * Convert a salon-local date + minutes-from-midnight to a UTC ISO instant.
 * Iterates once to correct for the offset at the target instant (DST-safe).
 */
export const localMinutesToUtcIso = (
  dateStr: string,
  minutes: number,
  timeZone: string,
): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const naiveUtc = Date.UTC(y, m - 1, d, 0, 0) + minutes * 60000;
  let offset = tzOffsetMinutes(timeZone, new Date(naiveUtc));
  let instant = naiveUtc - offset * 60000;
  // refine once
  offset = tzOffsetMinutes(timeZone, new Date(instant));
  instant = naiveUtc - offset * 60000;
  return new Date(instant).toISOString();
};

/** Salon-local YYYY-MM-DD for a UTC ISO instant. */
export const utcIsoToLocalDate = (iso: string, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};

/** Salon-local minutes-from-midnight for a UTC ISO instant. */
export const utcIsoToLocalMinutes = (iso: string, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const hour = get('hour') % 24;
  return hour * 60 + get('minute');
};

/** Render a UTC ISO instant as HH:MM in the salon timezone. */
export const formatTimeInTz = (iso: string, timeZone: string): string =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

export const todayIso = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const addDaysIso = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};

/** Convert a Date (from DB `@db.Date`) to a salon-local YYYY-MM-DD string. */
export const dateOnlyToIso = (date: Date): string => date.toISOString().slice(0, 10);
