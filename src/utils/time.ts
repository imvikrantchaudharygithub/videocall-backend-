// India-first day boundaries. The backend runs on Railway in UTC, but "today" for
// daily bonuses, VIP daily coins, and daily earnings must roll over at IST midnight
// (00:00 Asia/Kolkata), not UTC midnight. India observes no DST, so a fixed
// +5:30 offset is exact year-round.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The UTC instant of IST midnight for the IST-day that contains `date`. */
export const startOfDayIST = (date: Date = new Date()): Date => {
  const shifted = date.getTime() + IST_OFFSET_MS;        // move into IST wall-clock space
  const istMidnight = Math.floor(shifted / MS_PER_DAY) * MS_PER_DAY;
  return new Date(istMidnight - IST_OFFSET_MS);          // shift back to the real UTC instant
};

/** Whole IST-days between the IST-days of `a` and `b` (a later than b → positive). */
export const istDayDiff = (a: Date, b: Date): number =>
  Math.round((startOfDayIST(a).getTime() - startOfDayIST(b).getTime()) / MS_PER_DAY);

/** IST calendar-day key, e.g. "2026-07-01" — stable regardless of server timezone. */
export const istDateKey = (date: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
