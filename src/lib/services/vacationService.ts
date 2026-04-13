import { toISODateString } from "@/lib/dates";
import pb from "@/lib/pocketbase";
import {
  listLessonsByPrograms,
  updateLesson,
} from "@/lib/services/lessonService";
import { listPrograms, updateProgram } from "@/lib/services/programService";
import { DEFAULT_WORK_WEEK, getSettings } from "@/lib/services/settingsService";
import type { Lesson, Program, Vacation } from "@/types/domain";

export type { Vacation };

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listVacations(): Promise<Vacation[]> {
  return pb.collection("regula_vacations").getFullList({
    sort: "-start_date",
  }) as Promise<Vacation[]>;
}

export async function deleteVacation(id: string): Promise<void> {
  await pb.collection("regula_vacations").delete(id);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns affected program IDs: the active IDs plus any of their child programs. */
async function getAffectedProgramIds(activeIds: string[]): Promise<string[]> {
  if (activeIds.length === 0) return [];
  const all = await listPrograms();
  const childIds = all
    .filter((p) => activeIds.includes(p.parent))
    .map((p) => p.id);
  return [...new Set([...activeIds, ...childIds])];
}

/** Fetch lessons for given programs, excluding completed/archived, with due_at in [startDate, endDate]. */
async function getVacationLessons(
  programIds: string[],
  startDate: string,
  endDate: string,
): Promise<Lesson[]> {
  if (programIds.length === 0) return [];
  const programFilter = programIds
    .map((id) => `program = "${id}"`)
    .join(" || ");
  return pb.collection("regula_lessons").getFullList({
    filter: `(${programFilter}) && due_at >= "${startDate}" && due_at <= "${endDate}" && status != "completed" && status != "archived"`,
    sort: "due_at",
  }) as Promise<Lesson[]>;
}

/** Add `days` calendar days to a YYYY-MM-DD string. */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Number of calendar days between two YYYY-MM-DD strings (inclusive of end). */
function daysBetweenInclusive(startStr: string, endStr: string): number {
  const start = new Date(startStr + "T12:00:00");
  const end = new Date(endStr + "T12:00:00");
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

// ---------------------------------------------------------------------------
// Work-week helpers
// ---------------------------------------------------------------------------

const DAY_NUM_TO_NAME = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function dayOfWeekName(dateStr: string): string {
  return DAY_NUM_TO_NAME[new Date(dateStr + "T12:00:00").getDay()];
}

/**
 * Returns the effective set of schedulable days by unioning the base work week
 * with any override days (i.e. days users want to temporarily enable).
 */
function getEffectiveWorkDays(
  workWeek: string[],
  overrideDays?: string[],
): Set<string> {
  const base = workWeek.length ? workWeek : DEFAULT_WORK_WEEK;
  const combined = [...base, ...(overrideDays ?? [])];
  return new Set(combined);
}

/**
 * Advances `dateStr` forward until it falls on a valid work day.
 * Scans at most 7 days to prevent infinite loops on empty work sets.
 */
function nextValidWorkDay(dateStr: string, workDays: Set<string>): string {
  let candidate = dateStr;
  for (let i = 0; i < 7; i++) {
    if (workDays.has(dayOfWeekName(candidate))) return candidate;
    candidate = addDays(candidate, 1);
  }
  return candidate;
}

// ---------------------------------------------------------------------------
// Strategy: stack
// ---------------------------------------------------------------------------

interface StackResult {
  assignments: Map<string, { due_at: string; available_on?: string }>;
  overflowCount: number;
}

async function applyStack(
  vacation: Pick<Vacation, "start_date" | "end_date">,
  programIds: string[],
  workDays: Set<string>,
): Promise<StackResult> {
  const { start_date, end_date } = vacation;

  // Resolve earliest program start date
  const allPrograms = await listPrograms();
  const affectedPrograms = allPrograms.filter((p) => programIds.includes(p.id));
  const earliestStart =
    affectedPrograms
      .filter((p) => p.start_date)
      .map((p) => p.start_date.slice(0, 10))
      .sort()[0] ?? start_date;

  // Vacation lessons to rescheduling
  const vacationLessons = await getVacationLessons(
    programIds,
    start_date,
    end_date,
  );

  // Pre-vacation lessons to build daily count
  const programFilter = programIds
    .map((id) => `program = "${id}"`)
    .join(" || ");
  const preVacationLessons = (await pb
    .collection("regula_lessons")
    .getFullList({
      filter: `(${programFilter}) && due_at < "${start_date}" && status != "completed" && status != "archived"`,
      sort: "due_at",
    })) as Lesson[];

  // Build dailyCount map
  const dailyCount = new Map<string, number>();
  for (const l of preVacationLessons) {
    if (!l.due_at) continue;
    const key = l.due_at.slice(0, 10);
    dailyCount.set(key, (dailyCount.get(key) ?? 0) + 1);
  }

  const assignments = new Map<
    string,
    { due_at: string; available_on?: string }
  >();
  let overflowCount = 0;

  // Sort vacation lessons by due_at ascending
  const sorted = [...vacationLessons].sort((a, b) =>
    (a.due_at ?? "").localeCompare(b.due_at ?? ""),
  );

  const startDateMinus1 = addDays(start_date, -1);

  for (const lesson of sorted) {
    // Walk backward from start_date - 1 to earliestStart
    let placed = false;
    let candidate = startDateMinus1;

    while (candidate >= earliestStart) {
      if (!workDays.has(dayOfWeekName(candidate))) {
        candidate = addDays(candidate, -1);
        continue;
      }
      const count = dailyCount.get(candidate) ?? 0;
      if (count < 2) {
        dailyCount.set(candidate, count + 1);
        const entry: { due_at: string; available_on?: string } = {
          due_at: candidate,
        };
        // Shift available_on by same delta if it's in/after vacation
        if (
          lesson.available_on &&
          lesson.available_on.slice(0, 10) >= start_date
        ) {
          entry.available_on = candidate;
        }
        assignments.set(lesson.id, entry);
        placed = true;
        break;
      }
      candidate = addDays(candidate, -1);
    }

    if (!placed) {
      // Overflow: place on earliestStart
      const count = dailyCount.get(earliestStart) ?? 0;
      dailyCount.set(earliestStart, count + 1);
      const entry: { due_at: string; available_on?: string } = {
        due_at: earliestStart,
      };
      if (
        lesson.available_on &&
        lesson.available_on.slice(0, 10) >= start_date
      ) {
        entry.available_on = earliestStart;
      }
      assignments.set(lesson.id, entry);
      overflowCount++;
    }
  }

  return { assignments, overflowCount };
}

/** Preview overflow count for the stack strategy without writing to DB. */
export async function previewStackOverflow(
  data: Pick<Vacation, "start_date" | "end_date">,
  programIds: string[],
): Promise<number> {
  const settings = await getSettings();
  const effectiveWorkWeek = settings.work_week?.length
    ? settings.work_week
    : DEFAULT_WORK_WEEK;
  const workDays = getEffectiveWorkDays(effectiveWorkWeek);
  const { overflowCount } = await applyStack(data, programIds, workDays);
  return overflowCount;
}

async function commitStack(
  assignments: Map<string, { due_at: string; available_on?: string }>,
): Promise<void> {
  await Promise.all(
    Array.from(assignments.entries()).map(([id, vals]) =>
      updateLesson(id, vals),
    ),
  );
}

// ---------------------------------------------------------------------------
// Strategy: recovery
// ---------------------------------------------------------------------------

async function applyRecovery(
  vacation: Pick<
    Vacation,
    "start_date" | "end_date" | "recovery_before_days" | "recovery_after_days"
  >,
  programIds: string[],
  workDays: Set<string>,
): Promise<void> {
  const { start_date, end_date, recovery_before_days, recovery_after_days } =
    vacation;

  const vacationLessons = await getVacationLessons(
    programIds,
    start_date,
    end_date,
  );
  if (vacationLessons.length === 0) return;

  // Build recovery dates (only schedulable work days)
  const recoveryDates: string[] = [];
  for (let i = recovery_before_days; i >= 1; i--) {
    const d = addDays(start_date, -i);
    if (workDays.has(dayOfWeekName(d))) recoveryDates.push(d);
  }
  for (let i = 1; i <= recovery_after_days; i++) {
    const d = addDays(end_date, i);
    if (workDays.has(dayOfWeekName(d))) recoveryDates.push(d);
  }

  if (recoveryDates.length === 0) {
    console.warn(
      "[vacationService] applyRecovery: no recovery dates, skipping.",
    );
    return;
  }

  // Round-robin assign
  await Promise.all(
    vacationLessons.map((lesson, idx) => {
      const newDate = recoveryDates[idx % recoveryDates.length];
      const entry: Partial<Lesson> = { due_at: newDate };
      if (
        lesson.available_on &&
        lesson.available_on.slice(0, 10) >= start_date
      ) {
        entry.available_on = newDate;
      }
      return updateLesson(lesson.id, entry);
    }),
  );
}

// ---------------------------------------------------------------------------
// Strategy: push_back
// ---------------------------------------------------------------------------

async function applyPushBack(
  vacation: Pick<Vacation, "start_date" | "end_date">,
  programIds: string[],
  workDays: Set<string>,
): Promise<void> {
  const { start_date, end_date } = vacation;
  const shiftDays = daysBetweenInclusive(start_date, end_date);

  function shiftDate(dateStr: string): string {
    return nextValidWorkDay(addDays(dateStr, shiftDays), workDays);
  }

  // Shift lessons
  const allLessons = await listLessonsByPrograms(programIds);
  const lessonsToShift = allLessons.filter(
    (l) =>
      l.due_at &&
      l.due_at.slice(0, 10) >= start_date &&
      l.status !== "completed" &&
      l.status !== "archived",
  );

  // Shift assessments
  const programFilter = programIds
    .map((id) => `program = "${id}"`)
    .join(" || ");
  const assessments = await pb.collection("regula_assessments").getFullList({
    filter: `(${programFilter}) && due_at >= "${start_date}"`,
  });

  // Shift program end dates
  const allPrograms = await listPrograms();
  const programsToShift = allPrograms.filter(
    (p) =>
      programIds.includes(p.id) &&
      p.end_date &&
      p.end_date.slice(0, 10) >= start_date,
  );

  // Shift active reviews
  const reviews = await pb.collection("regula_reviews").getFullList({
    filter: `status = "active" && due_at >= "${start_date}" && owner = "${pb.authStore.record!.id}"`,
  });

  await Promise.all([
    ...lessonsToShift.map((l) => {
      const entry: Partial<Lesson> = {
        due_at: toISODateString(
          new Date(shiftDate(l.due_at.slice(0, 10)) + "T12:00:00"),
        ),
      };
      if (l.available_on && l.available_on.slice(0, 10) >= start_date) {
        entry.available_on = toISODateString(
          new Date(shiftDate(l.available_on.slice(0, 10)) + "T12:00:00"),
        );
      }
      return updateLesson(l.id, entry);
    }),
    ...assessments.map((a) =>
      pb.collection("regula_assessments").update(a.id, {
        due_at: toISODateString(
          new Date(shiftDate(String(a.due_at).slice(0, 10)) + "T12:00:00"),
        ),
      }),
    ),
    ...programsToShift.map((p: Program) =>
      updateProgram(p.id, {
        end_date: toISODateString(
          new Date(shiftDate(p.end_date.slice(0, 10)) + "T12:00:00"),
        ),
      }),
    ),
    ...reviews.map((r) =>
      pb.collection("regula_reviews").update(r.id, {
        due_at: toISODateString(
          new Date(shiftDate(String(r.due_at).slice(0, 10)) + "T12:00:00"),
        ),
        next_review_at: r.next_review_at
          ? toISODateString(
              new Date(
                shiftDate(String(r.next_review_at).slice(0, 10)) + "T12:00:00",
              ),
            )
          : undefined,
      }),
    ),
  ]);
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

async function applyVacationStrategy(
  vacation: Vacation,
  programIds: string[],
  workDays: Set<string>,
): Promise<void> {
  switch (vacation.strategy) {
    case "stack": {
      const { assignments } = await applyStack(vacation, programIds, workDays);
      await commitStack(assignments);
      break;
    }
    case "recovery":
      await applyRecovery(vacation, programIds, workDays);
      break;
    case "push_back":
      await applyPushBack(vacation, programIds, workDays);
      break;
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Applies any existing vacations that overlap with the given programs' date
 * range. Called after a course import so that already-scheduled vacations are
 * respected. Vacations are applied in chronological order.
 * Returns the number of vacations that were applied.
 */
export async function applyExistingVacationsToPrograms(
  programIds: string[],
): Promise<number> {
  if (programIds.length === 0) return 0;

  const [allVacations, settings, allPrograms] = await Promise.all([
    listVacations(),
    getSettings(),
    listPrograms(),
  ]);

  const relevantPrograms = allPrograms.filter((p) => programIds.includes(p.id));
  if (relevantPrograms.length === 0) return 0;

  const starts = relevantPrograms
    .map((p) => p.start_date?.slice(0, 10))
    .filter(Boolean) as string[];
  const ends = relevantPrograms
    .map((p) => p.end_date?.slice(0, 10))
    .filter(Boolean) as string[];
  if (starts.length === 0 || ends.length === 0) return 0;

  const rangeStart = [...starts].sort()[0];
  const rangeEnd = [...ends].sort().reverse()[0];

  // Filter to vacations that overlap [rangeStart, rangeEnd]
  const overlapping = allVacations.filter(
    (v) =>
      v.start_date.slice(0, 10) <= rangeEnd &&
      v.end_date.slice(0, 10) >= rangeStart,
  );
  if (overlapping.length === 0) return 0;

  overlapping.sort((a, b) =>
    a.start_date.slice(0, 10).localeCompare(b.start_date.slice(0, 10)),
  );

  const effectiveWorkWeek = settings.work_week?.length
    ? settings.work_week
    : DEFAULT_WORK_WEEK;

  for (const vacation of overlapping) {
    const workDays = getEffectiveWorkDays(
      effectiveWorkWeek,
      vacation.work_week_override_days,
    );
    await applyVacationStrategy(vacation, programIds, workDays);
  }

  return overlapping.length;
}

export async function createAndApplyVacation(
  data: Omit<Vacation, "id" | "owner" | "created" | "updated">,
): Promise<Vacation> {
  const record = (await pb.collection("regula_vacations").create({
    ...data,
    owner: pb.authStore.record!.id,
  })) as Vacation;

  // Resolve active program IDs from settings
  const settings = await getSettings();
  const activeIds: string[] = settings.active_programs ?? [];

  if (activeIds.length === 0) {
    // Silent no-op
    return record;
  }

  const effectiveWorkWeek = settings.work_week?.length
    ? settings.work_week
    : DEFAULT_WORK_WEEK;
  const workDays = getEffectiveWorkDays(
    effectiveWorkWeek,
    record.work_week_override_days,
  );

  const programIds = await getAffectedProgramIds(activeIds);
  await applyVacationStrategy(record, programIds, workDays);

  return record;
}
