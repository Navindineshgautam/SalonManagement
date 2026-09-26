import type { TimeInterval } from '@/core/api/types';

/**
 * Pure interval math on half-open [startMinute, endMinute) ranges.
 * Used by the mock availability engine and mirrored by the backend engine.
 */

export const sortIntervals = (intervals: TimeInterval[]): TimeInterval[] =>
  [...intervals].sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);

/** Merge overlapping/adjacent intervals into a minimal set. */
export const mergeIntervals = (intervals: TimeInterval[]): TimeInterval[] => {
  const sorted = sortIntervals(intervals.filter((i) => i.endMinute > i.startMinute));
  const out: TimeInterval[] = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv.startMinute <= last.endMinute) {
      last.endMinute = Math.max(last.endMinute, iv.endMinute);
    } else {
      out.push({ ...iv });
    }
  }
  return out;
};

/** Intersect a set of intervals with a single bounding window. */
export const intersectWithWindow = (
  intervals: TimeInterval[],
  windowStart: number,
  windowEnd: number
): TimeInterval[] =>
  mergeIntervals(intervals)
    .map((iv) => ({
      startMinute: Math.max(iv.startMinute, windowStart),
      endMinute: Math.min(iv.endMinute, windowEnd),
    }))
    .filter((iv) => iv.endMinute > iv.startMinute);

/** Subtract a set of "blocked" intervals from a set of "base" intervals. */
export const subtractIntervals = (
  base: TimeInterval[],
  blocked: TimeInterval[]
): TimeInterval[] => {
  const merged = mergeIntervals(base);
  const cuts = mergeIntervals(blocked);
  let result: TimeInterval[] = merged;

  for (const cut of cuts) {
    const next: TimeInterval[] = [];
    for (const iv of result) {
      // no overlap
      if (cut.endMinute <= iv.startMinute || cut.startMinute >= iv.endMinute) {
        next.push(iv);
        continue;
      }
      // left remainder
      if (cut.startMinute > iv.startMinute) {
        next.push({ startMinute: iv.startMinute, endMinute: cut.startMinute });
      }
      // right remainder
      if (cut.endMinute < iv.endMinute) {
        next.push({ startMinute: cut.endMinute, endMinute: iv.endMinute });
      }
    }
    result = next;
  }
  return result;
};

export const overlaps = (a: TimeInterval, b: TimeInterval): boolean =>
  a.startMinute < b.endMinute && a.endMinute > b.startMinute;

/**
 * Generate start minutes at `step` intervals within each free interval such that
 * a block of `duration` fits entirely inside the interval.
 */
export const generateStartMinutes = (
  freeIntervals: TimeInterval[],
  duration: number,
  step: number
): number[] => {
  const starts: number[] = [];
  for (const iv of freeIntervals) {
    // align first start up to the next step boundary at/after iv.startMinute
    const first = Math.ceil(iv.startMinute / step) * step;
    for (let s = first; s + duration <= iv.endMinute; s += step) {
      starts.push(s);
    }
  }
  return starts;
};

export const minutesToHHMM = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const hhmmToMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
