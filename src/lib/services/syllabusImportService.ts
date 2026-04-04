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
  areaResources: Record<string, string>; // areaId → default resource id
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
  const { term, syllabi, areaMatches, areaResources, globalBlockWeeks } =
    params;
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

  // Pre-load all resources and index for fast lookup
  const allResources = await listResources();
  // areaId::title → resourceId (area-scoped exact title match)
  const resourceIndex = new Map<string, string>();
  // areaId → resourceId[] (fallback: area has exactly one resource)
  const resourcesByArea = new Map<string, string[]>();
  // title → resourceId[] (fallback: title-only match regardless of area)
  const resourceIndexByTitle = new Map<string, string[]>();
  for (const r of allResources) {
    if (!r.title) continue;
    const titleKey = r.title.toLowerCase();
    if (r.area) {
      resourceIndex.set(`${r.area}::${titleKey}`, r.id);
      const list = resourcesByArea.get(r.area) ?? [];
      list.push(r.id);
      resourcesByArea.set(r.area, list);
    }
    const titleList = resourceIndexByTitle.get(titleKey) ?? [];
    titleList.push(r.id);
    resourceIndexByTitle.set(titleKey, titleList);
  }

  function resolveResource(
    reading: string | undefined,
    areaId: string,
  ): string | undefined {
    if (reading) {
      const key = reading.toLowerCase();
      // 1. Area-scoped exact title match
      const areaMatch = resourceIndex.get(`${areaId}::${key}`);
      if (areaMatch) return areaMatch;
      // 2. Title-only match (resource may not have area set)
      const titleMatches = resourceIndexByTitle.get(key);
      if (titleMatches?.length === 1) return titleMatches[0];
    }
    // 3. Fallback: area has exactly one resource
    const areaResourceList = resourcesByArea.get(areaId);
    if (areaResourceList?.length === 1) return areaResourceList[0];
    // 4. Explicit per-area default chosen by the user
    return areaResources[areaId] || undefined;
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
        if (session.reading) notesParts.push(`Reading: ${session.reading}`);
        if (session.inSession) notesParts.push(`Task: ${session.inSession}`);
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
