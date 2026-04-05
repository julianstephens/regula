import pb from "@/lib/pocketbase";
import type { SessionOutcome, SessionType, StudySession } from "@/types/domain";
import { completeItem } from "./studyItemService";

export interface SessionFilters {
  studyItem?: string;
  area?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function listSessions(
  filters: SessionFilters = {},
): Promise<StudySession[]> {
  const parts: string[] = ['ended_at != ""'];
  if (filters.studyItem) parts.push(`study_items ~ "${filters.studyItem}"`);
  if (filters.area) parts.push(`area = "${filters.area}"`);
  if (filters.dateFrom) parts.push(`ended_at >= "${filters.dateFrom}"`);
  if (filters.dateTo) parts.push(`ended_at <= "${filters.dateTo}"`);
  const filter = parts.join(" && ");

  return pb.collection("regula_study_sessions").getFullList({
    sort: "-started_at",
    filter,
    expand: "study_items,area",
  }) as Promise<StudySession[]>;
}

export async function getOpenSession(): Promise<StudySession | null> {
  const results = (await pb.collection("regula_study_sessions").getFullList({
    filter: 'started_at != "" && ended_at = ""',
    sort: "-started_at",
    expand: "study_items",
  })) as StudySession[];
  return results[0] ?? null;
}

export async function startSession(
  studyItemIds: string[],
): Promise<StudySession> {
  const { createEvent } = await import("./itemEventService");
  let areaId = "";

  for (const id of studyItemIds) {
    const item = (await pb
      .collection("regula_study_items")
      .getOne(id)) as import("@/types/domain").StudyItem;
    if (!areaId) areaId = item.area;
    if (item.status === "available" || item.status === "planned") {
      await pb
        .collection("regula_study_items")
        .update(id, { status: "in_progress" });
      await createEvent(id, "started");
    }
  }

  return pb.collection("regula_study_sessions").create({
    study_items: studyItemIds,
    area: areaId,
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
    const itemIds = ([] as string[]).concat(session.study_items ?? []);
    for (const itemId of itemIds) {
      try {
        await completeItem(itemId);
      } catch (e) {
        console.warn(`Failed to complete item ${itemId}:`, e);
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

  if (data.outcome === "completed" && data.study_items?.length) {
    const itemIds = ([] as string[]).concat(data.study_items);
    for (const itemId of itemIds) {
      await completeItem(itemId);
    }
  }

  return session;
}
