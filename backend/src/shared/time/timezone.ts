/**
 * Validate an IANA timezone string by attempting to construct a formatter.
 * Mirrors the mock's `isValidTimezone`.
 */
export const isValidTimezone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};
