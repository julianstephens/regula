export function toPbDate(date: Date): string {
  return date.toISOString().replace("T", " ");
}

export function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isOverdue(
  dueDateStr: string | undefined,
  status: string,
): boolean {
  if (!dueDateStr) return false;
  if (["completed", "archived", "cancelled"].includes(status)) return false;
  return new Date(dueDateStr) < startOfDay();
}

export function toISODateString(date: Date): string {
  return date.toISOString();
}

export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  // Extract the YYYY-MM-DD portion from any format (bare date or PocketBase
  // datetime like "2026-04-12 00:00:00.000Z") and parse as local noon to avoid
  // UTC-midnight → previous-day rollback in UTC+ timezones.
  const datePart = dateStr.slice(0, 10);
  return new Date(`${datePart}T12:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
