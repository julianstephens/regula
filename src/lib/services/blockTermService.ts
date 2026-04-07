import {
  computeBlockRanges,
  computeIdealTermEnd,
  type BlockRange,
} from "@/lib/blocks";
import { toISODateString, toPbDate } from "@/lib/dates";
import {
  listCourseSessions,
  updateCourseSession,
} from "@/lib/services/courseSessionService";
import {
  createProgram,
  listPrograms,
  updateProgram,
} from "@/lib/services/programService";
import {
  listStudyItemsByPrograms,
  updateStudyItem,
} from "@/lib/services/studyItemService";
import type { Program, StudyItem } from "@/types/domain";

export interface BlockTermParams {
  term: Program;
  blockWeeks: number;
  extendTerm: boolean;
}

export interface BlockTermResult {
  blocksCreated: number;
  newEndDate?: string;
}

export async function checkExistingBlocks(termId: string): Promise<boolean> {
  const all = await listPrograms();
  return all.some((p) => p.parent === termId && p.type === "block");
}

async function rescheduleItemsAndSessions(
  termId: string,
  blockRanges: BlockRange[],
): Promise<void> {
  if (blockRanges.length < 2) return;

  // Start of each rest week: the day after each non-final block ends.
  const restWeekStarts: Date[] = blockRanges.slice(0, -1).map((b) => {
    const s = new Date(b.end);
    s.setDate(s.getDate() + 1);
    s.setHours(0, 0, 0, 0);
    return s;
  });

  // How many days to add to a date:
  // 7 × (number of rest-week starts that are ≤ that date).
  // This "inserts" each rest week into the schedule rather than collapsing
  // all sessions in the gap onto the same day.
  function computeShiftDays(dateStr: string | undefined): number {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    return restWeekStarts.filter((rs) => d >= rs).length * 7;
  }

  function applyShift(dateStr: string, days: number): Date {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d;
  }

  const allPrograms = await listPrograms();
  const courseChildren = allPrograms.filter(
    (p) => p.parent === termId && p.type === "course",
  );

  // Extend each course's end_date to accommodate the inserted rest weeks.
  await Promise.all(
    courseChildren.map(async (course) => {
      const days = computeShiftDays(course.end_date);
      if (days > 0) {
        await updateProgram(course.id, {
          end_date: toISODateString(applyShift(course.end_date, days)),
        });
      }
    }),
  );

  // Shift study items belonging to the term or its course children.
  const programIds = [termId, ...courseChildren.map((c) => c.id)];
  const studyItems = await listStudyItemsByPrograms(programIds);

  await Promise.all(
    studyItems.map(async (item: StudyItem) => {
      const updates: Partial<StudyItem> = {};
      const dueDays = computeShiftDays(item.due_date);
      if (dueDays > 0) {
        updates.due_date = toISODateString(applyShift(item.due_date, dueDays));
      }
      const schedDays = computeShiftDays(item.scheduled_date);
      if (schedDays > 0) {
        updates.scheduled_date = toISODateString(
          applyShift(item.scheduled_date, schedDays),
        );
      }
      if (Object.keys(updates).length > 0) {
        await updateStudyItem(item.id, updates);
      }
    }),
  );

  // Shift course sessions for each course under the term.
  const allSessionUpdates: Promise<unknown>[] = [];
  for (const course of courseChildren) {
    const sessions = await listCourseSessions({ course: course.id });
    for (const session of sessions) {
      const days = computeShiftDays(session.date);
      if (days > 0) {
        allSessionUpdates.push(
          updateCourseSession(session.id, {
            date: toPbDate(applyShift(session.date, days)),
          }),
        );
      }
    }
  }
  await Promise.all(allSessionUpdates);
}

export async function blockTerm(
  params: BlockTermParams,
): Promise<BlockTermResult> {
  const { term, blockWeeks, extendTerm } = params;
  const termStart = new Date(term.start_date);
  let termEnd = new Date(term.end_date);

  let newEndDate: string | undefined;

  if (extendTerm) {
    // Compute how many blocks the current term can fit, then extend to fit them all cleanly
    const currentRanges = computeBlockRanges(termStart, termEnd, blockWeeks);
    const idealEnd = computeIdealTermEnd(
      termStart,
      currentRanges.length,
      blockWeeks,
    );
    newEndDate = toISODateString(idealEnd);
    await updateProgram(term.id, { end_date: newEndDate });
    termEnd = idealEnd;
  }

  const blockRanges = computeBlockRanges(termStart, termEnd, blockWeeks);

  for (const range of blockRanges) {
    await createProgram({
      name: range.name,
      type: "block",
      status: "planned",
      parent: term.id,
      start_date: toISODateString(range.start),
      end_date: toISODateString(range.end),
      block_weeks: blockWeeks,
      description: "",
    });
  }

  await rescheduleItemsAndSessions(term.id, blockRanges);

  return { blocksCreated: blockRanges.length, newEndDate };
}
