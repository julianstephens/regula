import { logger } from "@/lib/logger";
import pb from "@/lib/pocketbase";
import type { SessionOutcome, SessionType, StudySession } from "@/types/domain";
import { completeLesson } from "./lessonService";

export interface SessionFilters {
  lesson?: string;
  area?: string;
  program?: string;
  programIds?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export async function listSessions(
  filters: SessionFilters = {},
): Promise<StudySession[]> {
  logger.debug("listSessions: Fetching sessions", { filters });

  const parts: string[] = ['ended_at != ""'];
  if (filters.lesson) parts.push(`lessons ~ "${filters.lesson}"`);
  if (filters.area) parts.push(`area = "${filters.area}"`);
  if (filters.program) parts.push(`lessons.program ?= "${filters.program}"`);
  if (filters.programIds?.length) {
    parts.push(
      `(${filters.programIds.map((id) => `lessons.program ?= "${id}"`).join(" || ")})`,
    );
  }
  if (filters.dateFrom) parts.push(`ended_at >= "${filters.dateFrom}"`);
  if (filters.dateTo) parts.push(`ended_at <= "${filters.dateTo}"`);
  const filter = parts.join(" && ");

  const sessions = (await pb.collection("regula_study_sessions").getFullList({
    sort: "-started_at",
    filter,
    expand: "lessons,area",
  })) as StudySession[];

  logger.debug("listSessions: Retrieved sessions", { count: sessions.length });
  return sessions;
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
  logger.info("startSession: Beginning session start", {
    lessonCount: lessonIds.length,
  });

  const { createEvent } = await import("./itemEventService");

  // Validate that all lessons exist and belong to the same program
  const lessons = await Promise.all(
    lessonIds.map(
      async (id) =>
        (await pb
          .collection("regula_lessons")
          .getOne(id)) as import("@/types/domain").Lesson,
    ),
  );

  const programs = new Set(lessons.map((l) => l.program));
  if (programs.size > 1) {
    logger.error("startSession: Lessons from different programs", {
      lessonCount: lessonIds.length,
      programCount: programs.size,
    });
    throw new Error(
      "All lessons in a session must belong to the same program.",
    );
  }

  // Update lesson statuses and create events
  for (const id of lessonIds) {
    const lesson = lessons.find((l) => l.id === id);
    if (lesson?.status === "not_started") {
      logger.debug("startSession: Updating lesson status to active", {
        lessonId: id,
      });
      await pb.collection("regula_lessons").update(id, { status: "active" });
      await createEvent(id, "started");
    }
  }

  // Create and return session with expanded relations
  const session = (await pb.collection("regula_study_sessions").create({
    lessons: lessonIds,
    started_at: new Date().toISOString(),
    owner: pb.authStore.record!.id,
  })) as StudySession;

  logger.info("startSession: Session created", {
    sessionId: session.id,
    lessonCount: lessonIds.length,
  });

  // Fetch with expanded relations for proper cache updates
  const expandedSession = (await pb
    .collection("regula_study_sessions")
    .getOne(session.id, { expand: "lessons,area" })) as StudySession;
  logger.info("startSession: Session started successfully", {
    sessionId: expandedSession.id,
  });
  return expandedSession;
}

export async function endSession(
  sessionId: string,
  outcome: SessionOutcome,
  notes?: string,
  sessionType?: SessionType,
): Promise<StudySession> {
  logger.info("endSession: Ending session", { sessionId, outcome });

  const endedAt = new Date().toISOString();
  const session = (await pb
    .collection("regula_study_sessions")
    .getOne(sessionId)) as StudySession;
  const startedAt = new Date(session.started_at);
  const durationMinutes = Math.round(
    (Date.now() - startedAt.getTime()) / 60_000,
  );

  logger.debug("endSession: Session duration calculated", {
    sessionId,
    durationMinutes,
  });

  // Update session with end time and outcome
  await pb.collection("regula_study_sessions").update(sessionId, {
    ended_at: endedAt,
    outcome,
    duration_minutes: durationMinutes,
    notes: notes ?? "",
    ...(sessionType ? { session_type: sessionType } : {}),
  });

  // Fetch updated session with expanded relations
  const updated = (await pb
    .collection("regula_study_sessions")
    .getOne(sessionId, { expand: "lessons,area" })) as StudySession;

  logger.info("endSession: Session updated in database", {
    sessionId,
    outcome,
    durationMinutes,
  });

  if (outcome === "completed") {
    const lessonIds = ([] as string[]).concat(session.lessons ?? []);
    logger.debug("endSession: Completing lessons", {
      sessionId,
      lessonCount: lessonIds.length,
    });

    for (const lessonId of lessonIds) {
      try {
        await completeLesson(lessonId);
        logger.debug("endSession: Lesson completed", { sessionId, lessonId });
      } catch (e) {
        logger.warn(
          `endSession: Failed to complete lesson ${lessonId}`,
          e instanceof Error ? e : new Error(String(e)),
        );
      }
    }
  }

  logger.info("endSession: Session ended successfully", {
    sessionId,
    outcome,
    durationMinutes,
  });
  return updated;
}

export async function logSession(
  data: Partial<StudySession>,
): Promise<StudySession> {
  logger.info("logSession: Starting to log a session", {
    lessonCount: Array.isArray(data.lessons) ? data.lessons.length : 0,
    outcome: data.outcome,
    durationMinutes: data.duration_minutes,
  });

  // Validate duration_minutes is not negative
  if (data.duration_minutes != null && data.duration_minutes < 0) {
    logger.error("logSession: Invalid duration (negative)", {
      durationMinutes: data.duration_minutes,
    });
    throw new Error(
      "Session duration cannot be negative. End time must be after start time.",
    );
  }

  // Validate that all lessons belong to the same program
  if (data.lessons?.length) {
    logger.debug("logSession: Validating lessons belong to same program", {
      lessonCount: data.lessons.length,
    });

    const lessons = await Promise.all(
      (data.lessons as string[]).map(
        async (id) =>
          (await pb
            .collection("regula_lessons")
            .getOne(id)) as import("@/types/domain").Lesson,
      ),
    );

    const programs = new Set(lessons.map((l) => l.program));
    if (programs.size > 1) {
      logger.error("logSession: Lessons belong to different programs", {
        lessonCount: data.lessons.length,
        programCount: programs.size,
      });
      throw new Error(
        "All lessons in a session must belong to the same program.",
      );
    }
    logger.debug("logSession: Lesson validation passed", {
      programCount: programs.size,
    });
  }

  // Create session with owner
  logger.debug("logSession: Creating session record in database", {
    lessonCount: Array.isArray(data.lessons) ? data.lessons.length : 0,
  });

  const session = (await pb.collection("regula_study_sessions").create({
    ...data,
    owner: pb.authStore.record!.id,
  })) as StudySession;

  // Fetch session with expanded relations for proper cache updates
  logger.debug("logSession: Fetching session with expanded relations", {
    sessionId: session.id,
  });
  const expandedSession = (await pb
    .collection("regula_study_sessions")
    .getOne(session.id, { expand: "lessons,area" })) as StudySession;

  // Complete associated lessons if session outcome is "completed"
  if (data.outcome === "completed" && data.lessons?.length) {
    logger.info("logSession: Completing associated lessons", {
      sessionId: session.id,
      lessonCount: data.lessons.length,
    });

    const lessonIds = ([] as string[]).concat(data.lessons);
    for (const lessonId of lessonIds) {
      try {
        await completeLesson(lessonId);
        logger.debug("logSession: Lesson completed", {
          sessionId: session.id,
          lessonId,
        });
      } catch (e) {
        logger.error(
          "logSession: Failed to complete lesson",
          e instanceof Error ? e : new Error(String(e)),
        );
        throw e;
      }
    }
  }

  logger.info("logSession: Session logged successfully", {
    sessionId: session.id,
    lessonCount: Array.isArray(data.lessons) ? data.lessons.length : 0,
    outcome: data.outcome,
  });

  return expandedSession;
}

export async function deleteSession(id: string): Promise<void> {
  logger.info("deleteSession: Deleting session", { sessionId: id });
  await pb.collection("regula_study_sessions").delete(id);
  logger.info("deleteSession: Session deleted successfully", { sessionId: id });
}
