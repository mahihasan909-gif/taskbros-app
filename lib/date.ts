// Local calendar date as "YYYY-MM-DD". Never use Date#toISOString() for this —
// it converts to UTC first, which silently shifts the date backward for any
// local time between midnight and the timezone offset (e.g. Bangladesh is
// UTC+6, so anything before 6 AM local rolls back to the previous day).
export function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
