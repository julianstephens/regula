import { toISODateString } from "@/lib/dates";
import {
  listCourseSessions,
  updateCourseSession,
} from "@/lib/services/courseSessionService";
import { createProgram } from "@/lib/services/programService";
import { listResources } from "@/lib/services/resourceService";
import { createStudyItem } from "@/lib/services/studyItemService";
import type { ParsedSyllabus } from "@/lib/syllabusParser";
import type { Area, CourseSession, ItemType, Program } from "@/types/domain";

export interface ImportParams {
  term: Program;
  syllabi: ParsedSyllabus[];
  areaMatches: Record<string, string>; // slug → area id
  areaResources: Record<string, string>; // areaId → default resource id
  areas: Area[];
}

export interface ImportResult {
  coursesCreated: number;
  courseSessionsUpdated: number;
  itemsCreated: number;
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

export async function importSyllabi(
  params: ImportParams,
): Promise<ImportResult> {
  const { term, syllabi, areaMatches, areaResources, areas } = params;
  const termStart = new Date(term.start_date);
  const termEnd = new Date(term.end_date);

  console.log("[import] start", {
    term: term.name,
    syllabi: syllabi.length,
    termStart,
    termEnd,
  });

  let itemsCreated = 0;

  // ── Helpers ─────────────────────────────────────────────────────────────

  // "YYYY-MM-DD HH:mm:ss" or ISO → "YYYY-MM-DD"
  function toDateKey(s: string): string {
    return s.slice(0, 10);
  }

  // Map day integer (0=Sun…6=Sat) back to the abbreviation Program.meeting_days uses
  const DAY_ABBRS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

  function isPlaceholder(s: string | undefined): boolean {
    if (!s) return true;
    return /^[-—–\s]+$/.test(s);
  }

  // Parse explicit date strings like "Apr 6 (Mon)" using the term year as a hint.
  function parseSessionDate(
    dateStr: string | undefined,
    yearHint: number,
  ): Date | null {
    if (!dateStr || isPlaceholder(dateStr)) return null;
    const match = /([A-Za-z]+)\s+(\d+)/.exec(dateStr);
    if (!match) return null;
    const candidate = new Date(`${match[1]} ${match[2]}, ${yearHint}`);
    if (!isNaN(candidate.getTime())) return candidate;
    // Try the following year for terms that cross a year boundary
    const next = new Date(`${match[1]} ${match[2]}, ${yearHint + 1}`);
    return isNaN(next.getTime()) ? null : next;
  }

  function detectHomeworkType(text: string): ItemType {
    const t = text.toLowerCase();
    if (/write|essay|paper|composition|draft/.test(t)) return "writing";
    if (/read|review|passage|text|chapter/.test(t)) return "reading";
    if (/exercise|problem|worksheet|practice|drill|question/.test(t))
      return "exercise";
    if (/memorize|memorise|memorization|recall|recite/.test(t))
      return "memorization";
    return "other";
  }

  // ── Course creation ──────────────────────────────────────────────────────

  // Create course programs (and their sessions) for every syllabus that has
  // meeting days defined. Must happen before study items so we can index the
  // generated sessions for classwork notes.
  let coursesCreated = 0;
  const courseProgramsByArea = new Map<string, Program>();

  for (const syllabus of syllabi) {
    const areaId = areaMatches[syllabus.area];
    if (!areaId || syllabus.meetingDays.length === 0) continue;

    const areaName = areas.find((a) => a.id === areaId)?.name ?? syllabus.area;
    const meetingDayAbbrs = syllabus.meetingDays.map((d) => DAY_ABBRS[d]);

    console.log(
      "[import] creating course for area:",
      areaName,
      meetingDayAbbrs,
    );
    const course = await createProgram({
      name: areaName,
      type: "course",
      status: "planned",
      parent: term.id,
      area: areaId,
      meeting_days: meetingDayAbbrs,
      start_date: toISODateString(termStart),
      end_date: toISODateString(termEnd),
      description: "",
    });
    console.log("[import] course created:", course.id);

    courseProgramsByArea.set(areaId, course);
    coursesCreated++;
  }

  // ── Course-session index ─────────────────────────────────────────────────

  // Build areaId → (dateKey → CourseSession) for O(1) classwork-note lookups
  let courseSessionsUpdated = 0;
  const courseSessionIndex = new Map<string, Map<string, CourseSession>>();

  for (const [areaId, course] of courseProgramsByArea) {
    console.log("[import] loading course sessions for course:", course.id);
    const sessions = await listCourseSessions({ course: course.id });
    console.log("[import] loaded", sessions.length, "sessions");
    const byDate = new Map<string, CourseSession>();
    for (const cs of sessions) {
      byDate.set(toDateKey(cs.date), cs);
    }
    courseSessionIndex.set(areaId, byDate);
  }

  console.log("[import] loading resources");
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

  console.log("[import] resources loaded:", allResources.length);

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

    console.log(
      "[import] processing syllabus:",
      syllabus.filename,
      "areaId:",
      areaId,
    );

    const meetingDates = generateMeetingDates(
      termStart,
      termEnd,
      syllabus.meetingDays,
    );
    console.log("[import] meetingDates:", meetingDates.length);

    const sessionUpdates: Promise<unknown>[] = [];
    const itemCreates: Promise<unknown>[] = [];

    for (const track of syllabus.tracks) {
      // Accumulate in-class notes per date key so multiple sessions on the
      // same day are combined into a single course-session update.
      const notesAccum = new Map<string, string[]>();

      // Pre-pass: resolve the calendar date for every session in the track so
      // that homework items can be due at the *next* session's date.
      // If a session has an explicit date outside the term bounds it gets null
      // (skipped entirely). Index-based fallback is only used when there is no
      // explicit date at all.
      const sessionDates: (Date | null)[] = [];
      let indexCounter = 0;
      for (const s of track.sessions) {
        const explicit = parseSessionDate(s.date, termStart.getFullYear());
        let d: Date | null;
        if (explicit !== null) {
          // Explicit date: use it only if within the term, otherwise skip
          d = explicit >= termStart && explicit <= termEnd ? explicit : null;
        } else {
          // No explicit date: assign by meeting index
          d =
            indexCounter < meetingDates.length
              ? meetingDates[indexCounter]
              : null;
          indexCounter++;
        }
        sessionDates.push(d);
      }

      for (let i = 0; i < track.sessions.length; i++) {
        const session = track.sessions[i];
        const sessionDate = sessionDates[i];
        const dueDateKey = sessionDate
          ? sessionDate.toISOString().slice(0, 10)
          : null;

        if (session.isSpecial) {
          // Exam / quiz — single study item, nothing else
          console.log(
            "[import] special session:",
            session.title,
            session.specialType,
          );
          const course = courseProgramsByArea.get(areaId);
          itemCreates.push(
            createStudyItem({
              title: session.title,
              item_type: session.specialType ?? "quiz",
              notes: "",
              area: areaId,
              program: course?.id ?? term.id,
              due_date: sessionDate ? toISODateString(sessionDate) : undefined,
            }),
          );
          itemsCreated++;
          continue;
        }

        // Accumulate in-class content (focus + reading + inSession) grouped by date
        if (session.title || session.reading || session.inSession) {
          const notesParts: string[] = [];
          if (session.title) notesParts.push(`Focus: ${session.title}`);
          if (session.reading) notesParts.push(`Reading: ${session.reading}`);
          if (session.inSession)
            notesParts.push(`In-Session: ${session.inSession}`);
          if (dueDateKey) {
            const existing = notesAccum.get(dueDateKey) ?? [];
            existing.push(notesParts.join("\n"));
            notesAccum.set(dueDateKey, existing);
          }
        }

        // Study item: only create from explicit homework entries.
        // Homework is due at the *next* session's date (fall back to current
        // session's date for the last entry in the track).
        const itemText = !isPlaceholder(session.homework)
          ? session.homework
          : undefined;

        if (itemText) {
          const nextSessionDate = sessionDates[i + 1] ?? sessionDate;
          const resourceId = resolveResource(undefined, areaId);
          const course = courseProgramsByArea.get(areaId);
          console.log("[import] study item:", itemText);
          itemCreates.push(
            createStudyItem({
              title: itemText,
              item_type: detectHomeworkType(itemText),
              notes: itemText,
              area: areaId,
              program: course?.id ?? term.id,
              due_date: nextSessionDate
                ? toISODateString(nextSessionDate)
                : undefined,
              resource: resourceId,
            }),
          );
          itemsCreated++;
        }
      }

      // Emit one course-session update per unique date, combining same-day blocks
      for (const [dateKey, blocks] of notesAccum) {
        const notes = blocks.join("\n\n");
        const cs = courseSessionIndex.get(areaId)?.get(dateKey);
        console.log(
          "[import] in-class notes for",
          dateKey,
          "blocks:",
          blocks.length,
          "cs found:",
          !!cs,
        );
        if (cs) {
          sessionUpdates.push(updateCourseSession(cs.id, { notes }));
          courseSessionsUpdated++;
        }
      }
    }

    const allOps = [...sessionUpdates, ...itemCreates];
    console.log(
      "[import] firing batch:",
      sessionUpdates.length,
      "session updates,",
      itemCreates.length,
      "item creates",
    );
    for (let i = 0; i < allOps.length; i += 5) {
      await Promise.all(allOps.slice(i, i + 5));
    }
    console.log("[import] batch complete for:", syllabus.filename);

    // Papers → study items due on the last day of the term (exam week)
    if (syllabus.papers.length > 0) {
      const examDueDate = new Date(termEnd);
      examDueDate.setHours(0, 0, 0, 0);
      const course = courseProgramsByArea.get(areaId);
      const paperOps = syllabus.papers.map((paper) => {
        console.log("[import] paper:", paper.title);
        itemsCreated++;
        return createStudyItem({
          title: paper.title,
          item_type: "paper",
          notes:
            [
              paper.description,
              paper.length ? `Length: ${paper.length}` : undefined,
            ]
              .filter(Boolean)
              .join("\n") || undefined,
          area: areaId,
          program: course?.id ?? term.id,
          due_date: toISODateString(examDueDate),
        });
      });
      for (let i = 0; i < paperOps.length; i += 5) {
        await Promise.all(paperOps.slice(i, i + 5));
      }
    }
  }

  console.log("[import] done", {
    coursesCreated,
    courseSessionsUpdated,
    itemsCreated,
  });
  return {
    coursesCreated,
    courseSessionsUpdated,
    itemsCreated,
  };
}
