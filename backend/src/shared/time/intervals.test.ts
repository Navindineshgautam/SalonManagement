import {
  generateStartMinutes,
  mergeIntervals,
  overlaps,
  subtractIntervals,
} from './intervals';

describe('mergeIntervals', () => {
  it('merges overlapping and adjacent intervals', () => {
    expect(
      mergeIntervals([
        { startMinute: 60, endMinute: 120 },
        { startMinute: 120, endMinute: 180 },
        { startMinute: 100, endMinute: 110 },
      ]),
    ).toEqual([{ startMinute: 60, endMinute: 180 }]);
  });

  it('drops empty intervals', () => {
    expect(mergeIntervals([{ startMinute: 60, endMinute: 60 }])).toEqual([]);
  });
});

describe('subtractIntervals', () => {
  it('splits a base interval around a middle cut', () => {
    expect(
      subtractIntervals(
        [{ startMinute: 540, endMinute: 720 }],
        [{ startMinute: 600, endMinute: 630 }],
      ),
    ).toEqual([
      { startMinute: 540, endMinute: 600 },
      { startMinute: 630, endMinute: 720 },
    ]);
  });

  it('removes a fully covered interval', () => {
    expect(
      subtractIntervals(
        [{ startMinute: 540, endMinute: 600 }],
        [{ startMinute: 500, endMinute: 700 }],
      ),
    ).toEqual([]);
  });
});

describe('generateStartMinutes', () => {
  it('only emits starts where the full duration fits', () => {
    // free 09:00-10:00 (540-600), duration 30, step 15
    expect(generateStartMinutes([{ startMinute: 540, endMinute: 600 }], 30, 15)).toEqual([
      540, 555, 570,
    ]);
  });

  it('emits nothing when duration cannot fit', () => {
    expect(generateStartMinutes([{ startMinute: 540, endMinute: 555 }], 30, 15)).toEqual([]);
  });
});

describe('overlaps', () => {
  it('detects overlap and non-overlap on half-open ranges', () => {
    expect(overlaps({ startMinute: 0, endMinute: 30 }, { startMinute: 15, endMinute: 45 })).toBe(
      true,
    );
    expect(overlaps({ startMinute: 0, endMinute: 30 }, { startMinute: 30, endMinute: 45 })).toBe(
      false,
    );
  });
});
