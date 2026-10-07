/** Convert a Vietnamese wall-clock deadline to an unambiguous UTC timestamp. */
export function parseVietnameseDateTimeToIso(dateText, timeText) {
  const dateMatch = String(dateText || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const timeMatch = String(timeText || '').trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!dateMatch || !timeMatch) return null;

  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  const calendarDay = new Date(Date.UTC(year, month - 1, day));
  if (calendarDay.getUTCFullYear() !== year || calendarDay.getUTCMonth() !== month - 1 || calendarDay.getUTCDate() !== day) return null;

  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute)).toISOString();
}
