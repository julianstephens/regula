import type { Program } from "@/types/domain";

export const DEFAULT_BLOCK_WEEKS = 4;

export interface BlockRange {
  name: string;
  start: Date;
  end: Date;
}

/**
 * Compute all block date ranges for a term.
 * The final 7 days of the term are reserved as Exam Week.
 * Each block is followed by a 7-day rest week before the next block starts.
 */
export function computeBlockRanges(
  termStart: Date,
  termEnd: Date,
  blockWeeks: number,
): BlockRange[] {
  const ranges: BlockRange[] = [];
  let blockStart = new Date(termStart);
  blockStart.setHours(0, 0, 0, 0);
  let n = 1;

  // Reserve the final 7 days of the term as Exam Week
  const blockableEnd = new Date(termEnd);
  blockableEnd.setDate(blockableEnd.getDate() - 7);
  blockableEnd.setHours(23, 59, 59, 999);

  while (blockStart <= blockableEnd) {
    const blockEnd = computeBlockEndDate(blockStart, blockWeeks);
    const end = blockEnd > blockableEnd ? blockableEnd : blockEnd;
    ranges.push({ name: `Block ${n}`, start: new Date(blockStart), end });
    // Next block starts after 7-day rest week
    blockStart = new Date(end);
    blockStart.setDate(blockStart.getDate() + 8);
    n++;
  }

  return ranges;
}

/**
 * Compute the ideal term end date to exactly fit `nBlocks` complete blocks
 * (each of `blockWeeks` weeks) separated by 7-day rest weeks, plus a final
 * 7-day exam week.
 *
 * Layout: [block (blockWeeks*7 days)] [rest (7 days)] ... [exam week (7 days)]
 * Total days = nBlocks * blockWeeks * 7 + (nBlocks - 1) * 7 + 7
 *            = nBlocks * (blockWeeks + 1) * 7
 */
export function computeIdealTermEnd(
  termStart: Date,
  nBlocks: number,
  blockWeeks: number,
): Date {
  const totalDays = nBlocks * (blockWeeks + 1) * 7;
  const end = new Date(termStart);
  end.setHours(0, 0, 0, 0);
  // totalDays covers from day 0 (termStart) through day totalDays-1
  end.setDate(end.getDate() + totalDays - 1);
  end.setHours(23, 59, 59, 999);
  return end;
}

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
