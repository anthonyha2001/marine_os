// Date helpers shared by forms and pages.

/** Today's local date as YYYY-MM-DD (for <input type="date">). */
export function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** The companies work on Beirut time: "today" on the server is the date there, not in UTC. */
export const BUSINESS_TIME_ZONE = "Asia/Beirut";

/** Today in the business time zone as YYYY-MM-DD (server-safe). */
export function businessToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Parse YYYY-MM-DD as midnight UTC, or undefined. */
export function parseDay(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : undefined;
}

/** End of a YYYY-MM-DD day in UTC, or undefined. */
export function parseDayEnd(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T23:59:59.999Z`) : undefined;
}

export const dayFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
