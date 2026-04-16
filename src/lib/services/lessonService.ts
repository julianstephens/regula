import pb from "@/lib/pocketbase";
import type { Lesson, LessonStatus } from "@/types/domain";
import { createEvent } from "./itemEventService";

export interface LessonFilters {
  status?: LessonStatus;
  statuses?: LessonStatus[];
  program?: string;
  programIds?: string[];
  module?: string;
  sort?: string;
  dueBefore?: string;
  dueAfter?: string;
  availableAfter?: string;
  availableBefore?: string;
  calendarStart?: string;
  calendarEnd?: string;
  expand?: string;
}

export async function listLessons(
  filters: LessonFilters = {},
): Promise<Lesson[]> {
  const parts: string[] = [];
  if (filters.status) parts.push(`status = "${filters.status}"`);
  if (filters.statuses?.length) {
    parts.push(
      `(${filters.statuses.map((s) => `status = "${s}"`).join(" || ")})`,
    );
  }
  if (filters.program) parts.push(`program = "${filters.program}"`);
  if (filters.programIds?.length) {
    parts.push(
      `(${filters.programIds.map((id) => `program = "${id}"`).join(" || ")})`,
    );
  }
  if (filters.module) parts.push(`module = "${filters.module}"`);
  if (filters.dueAfter) parts.push(`due_at >= "${filters.dueAfter}"`);
  if (filters.dueBefore) parts.push(`due_at <= "${filters.dueBefore}"`);
  if (filters.availableAfter)
    parts.push(`available_on >= "${filters.availableAfter}"`);
  if (filters.availableBefore)
    parts.push(`available_on <= "${filters.availableBefore}"`);
  if (filters.calendarStart && filters.calendarEnd) {
    parts.push(
      `((available_on >= "${filters.calendarStart}" && available_on <= "${filters.calendarEnd}") || (available_on = "" && due_at >= "${filters.calendarStart}" && due_at <= "${filters.calendarEnd}"))`,
    );
  }
  const filter = parts.join(" && ");

  return pb.collection("regula_lessons").getFullList({
    sort: filters.sort ?? "due_at",
    filter,
    expand: filters.expand ?? "program,module,resource",
  }) as Promise<Lesson[]>;
}

export async function getLesson(id: string): Promise<Lesson> {
  return pb.collection("regula_lessons").getOne(id, {
    expand: "program,module,resource,prerequisites",
  }) as Promise<Lesson>;
}

export async function createLesson(data: Partial<Lesson>): Promise<Lesson> {
  const lesson = await (pb.collection("regula_lessons").create(
    {
      ...data,
      status: data.status ?? "not_started",
      owner: pb.authStore.record!.id,
    },
    { requestKey: null },
  ) as Promise<Lesson>);
  await createEvent(lesson.id, "created");
  return lesson;
}

export async function updateLesson(
  id: string,
  data: Partial<Lesson>,
): Promise<Lesson> {
  const lesson = await (pb
    .collection("regula_lessons")
    .update(id, data) as Promise<Lesson>);
  await createEvent(id, "edited");
  return lesson;
}

export async function changeStatus(
  id: string,
  status: LessonStatus,
): Promise<Lesson> {
  const payload: Record<string, unknown> = { status };
  if (status === "completed") payload.completed_at = new Date().toISOString();
  const lesson = await (pb
    .collection("regula_lessons")
    .update(id, payload) as Promise<Lesson>);

  const eventMap: Record<LessonStatus, Parameters<typeof createEvent>[1]> = {
    not_started: "created",
    active: "started",
    blocked: "deferred",
    submitted: "deferred",
    completed: "completed",
    archived: "cancelled",
  };
  await createEvent(id, eventMap[status]);
  return lesson;
}

export async function completeLesson(id: string): Promise<Lesson> {
  const lesson = await changeStatus(id, "completed");
  return lesson;
}

export async function listLessonsByPrograms(
  programIds: string[],
): Promise<Lesson[]> {
  if (programIds.length === 0) return [];
  const filter = programIds.map((id) => `program = "${id}"`).join(" || ");
  return pb.collection("regula_lessons").getFullList({
    sort: "program,due_at",
    filter,
    expand: "resource",
  }) as Promise<Lesson[]>;
}

export async function deleteLessonsByProgram(programId: string): Promise<void> {
  const lessons = await pb
    .collection("regula_lessons")
    .getFullList({ filter: `program = "${programId}"` });
  await Promise.all(
    lessons.map((lesson) => pb.collection("regula_lessons").delete(lesson.id)),
  );
}

export async function deleteLesson(id: string): Promise<void> {
  await pb.collection("regula_lessons").delete(id);
}
