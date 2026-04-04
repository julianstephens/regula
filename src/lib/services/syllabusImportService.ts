import { computeBlockEndDate } from "@/lib/blocks";
import { toISODateString } from "@/lib/dates";
import { createProgram, listPrograms } from "@/lib/services/programService";
import { listResources } from "@/lib/services/resourceService";
import { createStudyItem } from "@/lib/services/studyItemService";
import type { ParsedSyllabus } from "@/lib/syllabusParser";
import type { Program } from "@/types/domain";

export interface BlockRange {
  name: string;
  start: Date;
  end: Date;
}

export interface ImportParams {
  term: Program;
  syllabi: ParsedSyllabus[];
  areaMatches: Record<string, string>; // slug → area id
  globalBlockWeeks: number;
}

export interface ImportResult {
  blocksCreated: number;
  itemsCreated: number;
}

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

export function generateMeetingDates(
  termStart: Date,
  termEnd: Date,
  meetingDays: number[],
): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(termStart);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(termEnd);
  end.setHours(23, 59, 59, 999);

  while (cursor <= end) {
    if (meetingDays.includes(cursor.getDay())) {
      dates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

export async function checkExistingBlocks(termId: string): Promise<boolean> {
  const all = await listPrograms();
  return all.some((p) => p.parent === termId && p.type === "block");
}

export async function importSyllabi(
  params: ImportParams,
): Promise<ImportResult> {
  const { term, syllabi, areaMatches, globalBlockWeeks } = params;
  const termStart = new Date(term.start_date);
  const termEnd = new Date(term.end_date);
  const blockWeeks = term.block_weeks || globalBlockWeeks;

  const blockRanges = computeBlockRanges(termStart, termEnd, blockWeeks);

  // Create block Programs sequentially to preserve ordering
  const blockPrograms: Program[] = [];
  for (const range of blockRanges) {
    const prog = await createProgram({
      name: range.name,
      type: "block",
      status: "planned",
      parent: term.id,
      start_date: toISODateString(range.start),
      end_date: toISODateString(range.end),
      block_weeks: blockWeeks,
      description: "",
    });
    blockPrograms.push(prog);
  }

  function findBlock(dueDate: Date | null): Program | null {
    if (!dueDate) return null;
    return (
      blockPrograms.find((_bp, i) => {
        const range = blockRanges[i];
        return dueDate >= range.start && dueDate <= range.end;
      }) ??
      blockPrograms[blockPrograms.length - 1] ??
      null
    );
  }

  let itemsCreated = 0;

  // Pre-load all resources and index by "areaId::title" for fast lookup
  const allResources = await listResources();
  const resourceIndex = new Map<string, string>();
  // Also track how many resources exist per area
  const resourcesByArea = new Map<string, string[]>();
  for (const r of allResources) {
    if (r.area && r.title) {
      resourceIndex.set(`${r.area}::${r.title.toLowerCase()}`, r.id);
      const list = resourcesByArea.get(r.area) ?? [];
      list.push(r.id);
      resourcesByArea.set(r.area, list);
    }
  }

  function resolveResource(
    reading: string | undefined,
    areaId: string,
  ): string | undefined {
    // If a reading title is given, try an exact match first
    if (reading) {
      const match = resourceIndex.get(`${areaId}::${reading.toLowerCase()}`);
      if (match) return match;
    }
    // Fall back: if the area has exactly one resource, always use it
    const areaResources = resourcesByArea.get(areaId);
    if (areaResources?.length === 1) return areaResources[0];
    return undefined;
  }

  for (const syllabus of syllabi) {
    const areaId = areaMatches[syllabus.area];
    if (!areaId) continue; // user chose to skip this area

    const meetingDates = generateMeetingDates(
      termStart,
      termEnd,
      syllabus.meetingDays,
    );

    for (const track of syllabus.tracks) {
      for (let i = 0; i < track.sessions.length; i++) {
        const session = track.sessions[i];
        // Always use index-based meeting date; ignore any explicit date in the syllabus
        const dueDate = i < meetingDates.length ? meetingDates[i] : null;
        const block = findBlock(dueDate);

        const notesParts: string[] = [];
        if (session.inSession)
          notesParts.push(`In-session: ${session.inSession}`);
        const notes = notesParts.join("\n");

        const resourceId = !session.isSpecial
          ? resolveResource(session.reading, areaId)
          : undefined;

        await createStudyItem({
          title: session.title,
          item_type: session.isSpecial
            ? (session.specialType ?? "quiz")
            : "reading",
          notes,
          area: areaId,
          program: block?.id ?? term.id,
          due_date: dueDate ? toISODateString(dueDate) : undefined,
          resource: resourceId,
        });
        itemsCreated++;

        if (session.homework && !session.isSpecial) {
          await createStudyItem({
            title: `Homework: ${session.title}`,
            item_type: "other",
            notes: session.homework,
            area: areaId,
            program: block?.id ?? term.id,
            due_date: dueDate ? toISODateString(dueDate) : undefined,
            resource: resourceId,
          });
          itemsCreated++;
        }
      }
    }
  }

  return {
    blocksCreated: blockPrograms.length,
    itemsCreated,
  };
}
