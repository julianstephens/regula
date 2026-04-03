import type { Program } from "@/types/domain";

export const DEFAULT_BLOCK_WEEKS = 4;

/**
 * Compute a block program's end date.
 * end = startDate + (blockWeeks * 7) - 1 days (inclusive last day of the block).
 */
export function computeBlockEndDate(startDate: Date, blockWeeks: number): Date {
  const d = new Date(startDate);
  d.setDate(d.getDate() + blockWeeks * 7 - 1);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Return the rest-week date range for a block program (7 days immediately
 * after end_date), or null if the program is not a block or has no end_date.
 */
export function getRestWeek(
  program: Program,
  globalDefault: number,
): { start: Date; end: Date } | null {
  if (program.type !== "block" || !program.end_date) return null;
  const blockEnd = new Date(program.end_date);
  const restStart = new Date(blockEnd);
  restStart.setDate(blockEnd.getDate() + 1);
  restStart.setHours(0, 0, 0, 0);
  const restEnd = new Date(restStart);
  restEnd.setDate(restStart.getDate() + 6);
  restEnd.setHours(23, 59, 59, 999);
  // suppress unused-variable warning — globalDefault kept for API consistency
  void globalDefault;
  return { start: restStart, end: restEnd };
}

/**
 * Return true if `date` falls within the rest week of any block program.
 */
export function isInRestWeek(
  date: Date,
  blockPrograms: Program[],
  globalDefault: number,
): boolean {
  return blockPrograms.some((p) => {
    const rw = getRestWeek(p, globalDefault);
    if (!rw) return false;
    return date >= rw.start && date <= rw.end;
  });
}

/**
 * Return which week number (1-based) `date` falls in within the block, or
 * null if the date is outside the block's active period.
 */
export function getBlockWeekNumber(
  date: Date,
  program: Program,
  globalDefault: number,
): number | null {
  if (program.type !== "block" || !program.start_date || !program.end_date) {
    return null;
  }
  const start = new Date(program.start_date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(program.end_date);
  end.setHours(23, 59, 59, 999);
  if (date < start || date > end) return null;
  const diffMs = date.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;
  const totalWeeks = program.block_weeks ?? globalDefault;
  return week <= totalWeeks ? week : null;
}
