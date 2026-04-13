import type {
  ParsedCourseOfStudy,
  ParsedCourseOfStudyFile,
} from "@/lib/courseOfStudyParser";
import { createAssessment } from "@/lib/services/assessmentService";
import { createLesson } from "@/lib/services/lessonService";
import { createModule } from "@/lib/services/moduleService";
import { createProgram } from "@/lib/services/programService";
import { createResource } from "@/lib/services/resourceService";
import { DEFAULT_WORK_WEEK, getSettings } from "@/lib/services/settingsService";
import { applyExistingVacationsToPrograms } from "@/lib/services/vacationService";

export interface CourseFileImportParams {
  file: ParsedCourseOfStudyFile;
  areaMap: Record<string, string>;
  resourceMap: Record<string, string>;
  /** Override the work week used for scheduling (e.g. after conflict resolution). */
  workWeek?: string[];
}

export interface CourseFileImportResult {
  programsCreated: number;
  modulesCreated: number;
  lessonsCreated: number;
  assessmentsCreated: number;
  resourcesCreated: number;
  vacationsApplied: number;
  rootProgramId: string;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

const DAY_NAME_TO_NUM: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

/** Returns YYYY-MM-DD strings for every day in [startDate, endDate] that falls on a meeting day AND a work day. */
function getMeetingDates(
  startDate: string,
  endDate: string,
  meetingDays: string[],
  workWeek: string[],
): string[] {
  const effectiveWorkWeek = workWeek.length ? workWeek : DEFAULT_WORK_WEEK;
  const workDayNums = new Set(
    effectiveWorkWeek
      .map((d) => DAY_NAME_TO_NUM[d.toLowerCase()])
      .filter((n): n is number => n !== undefined),
  );
  const dayNums = meetingDays
    .map((d) => DAY_NAME_TO_NUM[d.toLowerCase()])
    .filter((n): n is number => n !== undefined && workDayNums.has(n));
  if (dayNums.length === 0) return [];

  const dates: string[] = [];
  // Parse as local noon to avoid DST boundary issues
  const end = new Date(`${endDate}T12:00:00`);
  const cur = new Date(`${startDate}T12:00:00`);
  while (cur <= end) {
    if (dayNums.includes(cur.getDay())) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, "0");
      const d = String(cur.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${d}`);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/** Assigns due dates to items that lack one, spreading them across meetingDates in order. */
function spreadDueDates<T extends { due_at?: string }>(
  items: T[],
  meetingDates: string[],
): T[] {
  if (meetingDates.length === 0) return items;
  return items.map((item, i) => {
    if (item.due_at) return item;
    return {
      ...item,
      due_at: meetingDates[Math.min(i, meetingDates.length - 1)],
    };
  });
}

async function batchCreate<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    await Promise.all(items.slice(i, i + batchSize).map(fn));
  }
}

export async function importCourseOfStudyFile(
  params: CourseFileImportParams,
): Promise<CourseFileImportResult> {
  const { file, areaMap } = params;
  // Resolve __create__ sentinels — create new resources and update the map.
  const resourceMap = { ...params.resourceMap };
  let resourcesCreated = 0;
  for (const [titleKey, value] of Object.entries(resourceMap)) {
    if (value === "__create__") {
      // Capitalise the stored title key back to a readable title.
      const title = titleKey
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      const created = await createResource({ title, resource_type: "other" });
      resourceMap[titleKey] = created.id;
      resourcesCreated++;
    }
  }

  const settings = await getSettings();
  const workWeek = params.workWeek?.length
    ? params.workWeek
    : settings.work_week?.length
      ? settings.work_week
      : DEFAULT_WORK_WEEK;

  let parentId: string | undefined;
  let rootProgramId: string | undefined;
  let programsCreated = 0;
  const allCreatedProgramIds: string[] = [];

  if (file.parent) {
    const parentProgram = await createProgram({
      name: file.parent.name,
      type: file.parent.type,
      status: file.parent.status ?? "planned",
      description: file.parent.description ?? "",
      start_date: file.parent.start_date,
      end_date: file.parent.end_date,
      meeting_days: file.parent.meeting_days,
    });
    parentId = parentProgram.id;
    rootProgramId = parentId;
    allCreatedProgramIds.push(parentId);
    programsCreated++;
  }

  let modulesCreated = 0;
  let lessonsCreated = 0;
  let assessmentsCreated = 0;

  for (const program of file.programs) {
    const areaId = areaMap[program.area?.toLowerCase() ?? ""] ?? undefined;
    const result = await importSingleProgram(
      program,
      parentId,
      areaId,
      resourceMap,
      workWeek,
    );
    programsCreated++;
    modulesCreated += result.modulesCreated;
    lessonsCreated += result.lessonsCreated;
    assessmentsCreated += result.assessmentsCreated;
    allCreatedProgramIds.push(result.programId);
    if (!rootProgramId) rootProgramId = result.programId;
  }

  const vacationsApplied =
    await applyExistingVacationsToPrograms(allCreatedProgramIds);

  return {
    programsCreated,
    modulesCreated,
    lessonsCreated,
    assessmentsCreated,
    resourcesCreated,
    vacationsApplied,
    rootProgramId: rootProgramId!,
  };
}

async function importSingleProgram(
  parsed: ParsedCourseOfStudy,
  parentId: string | undefined,
  areaId: string | undefined,
  resourceMap: Record<string, string>,
  workWeek: string[],
): Promise<{
  modulesCreated: number;
  lessonsCreated: number;
  assessmentsCreated: number;
  programId: string;
}> {
  const program = await createProgram({
    name: parsed.name,
    type: parsed.type,
    status: parsed.status ?? "planned",
    description: parsed.description ?? "",
    start_date: parsed.start_date,
    end_date: parsed.end_date,
    area: areaId || undefined,
    parent: parentId || undefined,
    meeting_days: parsed.meeting_days,
  });

  let modulesCreated = 0;
  let lessonsCreated = 0;
  let assessmentsCreated = 0;

  for (let idx = 0; idx < parsed.modules.length; idx++) {
    const mod = parsed.modules[idx];
    const createdModule = await createModule({
      program: program.id,
      title: mod.title,
      slug: mod.slug ?? slugify(mod.title),
      order: mod.order ?? idx,
      goal: mod.goal ?? "",
      start_date: mod.start_date ?? parsed.start_date,
      end_date: mod.end_date ?? parsed.end_date,
    });
    modulesCreated++;

    const modStart = mod.start_date ?? parsed.start_date;
    const modEnd = mod.end_date ?? parsed.end_date;
    const meetingDates =
      modStart && modEnd && parsed.meeting_days?.length
        ? getMeetingDates(modStart, modEnd, parsed.meeting_days, workWeek)
        : [];

    const lessonsWithDates = spreadDueDates(mod.lessons, meetingDates);
    await batchCreate(lessonsWithDates, 5, (lesson) => {
      lessonsCreated++;
      return createLesson({
        program: program.id,
        module: createdModule.id,
        title: lesson.title,
        type: lesson.type ?? "lesson",
        status: "not_started",
        // Convert plain YYYY-MM-DD to local midnight ISO so PocketBase stores
        // the correct UTC timestamp for the local calendar day.
        due_at: lesson.due_at
          ? new Date(`${lesson.due_at}T00:00:00`).toISOString()
          : undefined,
        available_on: lesson.available_on
          ? new Date(`${lesson.available_on}T00:00:00`).toISOString()
          : undefined,
        estimated_minutes: lesson.estimated_minutes,
        notes: lesson.notes ?? "",
        resource:
          lesson.resource != null
            ? (resourceMap[lesson.resource.toLowerCase()] ?? undefined)
            : undefined,
      });
    });

    for (const assessment of mod.assessments) {
      assessmentsCreated++;
      await createAssessment({
        program: program.id,
        module: createdModule.id,
        title: assessment.title,
        assessment_type: assessment.assessment_type ?? "other",
        status: "not_started",
        due_at: assessment.due_at ?? mod.end_date,
        max_score: assessment.max_score,
      });
    }
  }

  for (const lesson of parsed.lessons) {
    lessonsCreated++;
    await createLesson({
      program: program.id,
      title: lesson.title,
      type: lesson.type ?? "lesson",
      status: "not_started",
      due_at: lesson.due_at,
      available_on: lesson.available_on,
      estimated_minutes: lesson.estimated_minutes,
      notes: lesson.notes ?? "",
      resource:
        lesson.resource != null
          ? (resourceMap[lesson.resource.toLowerCase()] ?? undefined)
          : undefined,
    });
  }

  return {
    modulesCreated,
    lessonsCreated,
    assessmentsCreated,
    programId: program.id,
  };
}
