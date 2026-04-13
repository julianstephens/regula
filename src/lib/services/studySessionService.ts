import pb from "@/lib/pocketbase";
import type { SessionOutcome, SessionType, StudySession } from "@/types/domain";
import { completeLesson } from "./lessonService";

export interface SessionFilters {
  lesson?: string;
  area?: string;
  program?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function listSessions(
  filters: SessionFilters = {},
): Promise<StudySession[]> {
  const parts: string[] = ['ended_at != ""'];
  if (filters.lesson) parts.push(`lessons ~ "${filters.lesson}"`);
  if (filters.area) parts.push(`area = "${filters.area}"`);
  if (filters.program) parts.push(`lessons.program ?= "${filters.program}"`);
  if (filters.dateFrom) parts.push(`ended_at >= "${filters.dateFrom}"`);
  if (filters.dateTo) parts.push(`ended_at <= "${filters.dateTo}"`);
  const filter = parts.join(" && ");

  return pb.collection("regula_study_sessions").getFullList({
    sort: "-started_at",
    filter,
    expand: "lessons,area",
  }) as Promise<StudySession[]>;
}

export async function getOpenSession(): Promise<StudySession | null> {
  const results = (await pb.collection("regula_study_sessions").getFullList({
    filter: 'started_at != "" && ended_at = ""',
    sort: "-started_at",
    expand: "lessons",
  })) as StudySession[];
  return results[0] ?? null;
}

export async function startSession(lessonIds: string[]): Promise<StudySession> {
  const { createEvent } = await import("./itemEventService");

  for (const id of lessonIds) {
    const lesson = (await pb
      .collection("regula_lessons")
      .getOne(id)) as import("@/types/domain").Lesson;
    if (lesson.status === "not_started") {
      await pb.collection("regula_lessons").update(id, { status: "active" });
      await createEvent(id, "started");
    }
  }

  return pb.collection("regula_study_sessions").create({
    lessons: lessonIds,
    started_at: new Date().toISOString(),
    owner: pb.authStore.record!.id,
  }) as Promise<StudySession>;
}

export async function endSession(
  sessionId: string,
  outcome: SessionOutcome,
  notes?: string,
  sessionType?: SessionType,
): Promise<StudySession> {
  const endedAt = new Date().toISOString();
  const session = await (pb
    .collection("regula_study_sessions")
    .getOne(sessionId) as Promise<StudySession>);
  const startedAt = new Date(session.started_at);
  const durationMinutes = Math.round(
    (Date.now() - startedAt.getTime()) / 60_000,
  );

  const updated = await (pb
    .collection("regula_study_sessions")
    .update(sessionId, {
      ended_at: endedAt,
      outcome,
      duration_minutes: durationMinutes,
      notes: notes ?? "",
      ...(sessionType ? { session_type: sessionType } : {}),
    }) as Promise<StudySession>);

  if (outcome === "completed") {
    const lessonIds = ([] as string[]).concat(session.lessons ?? []);
    for (const lessonId of lessonIds) {
      try {
        await completeLesson(lessonId);
      } catch (e) {
        console.warn(`Failed to complete lesson ${lessonId}:`, e);
      }
    }
  }

  return updated;
}

export async function logSession(
  data: Partial<StudySession>,
): Promise<StudySession> {
  const session = await (pb.collection("regula_study_sessions").create({
    ...data,
    owner: pb.authStore.record!.id,
  }) as Promise<StudySession>);

  if (data.outcome === "completed" && data.lessons?.length) {
    const lessonIds = ([] as string[]).concat(data.lessons);
    for (const lessonId of lessonIds) {
      await completeLesson(lessonId);
    }
  }

  return session;
}

export async function deleteSession(id: string): Promise<void> {
  await pb.collection("regula_study_sessions").delete(id);
}
