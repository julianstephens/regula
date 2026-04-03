import pb from "@/lib/pocketbase";
import type { SessionOutcome, StudySession } from "@/types/domain";
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
  const parts: string[] = [];
  if (filters.studyItem) parts.push(`study_item = "${filters.studyItem}"`);
  if (filters.area) parts.push(`area = "${filters.area}"`);
  if (filters.dateFrom) parts.push(`started_at >= "${filters.dateFrom}"`);
  if (filters.dateTo) parts.push(`started_at <= "${filters.dateTo}"`);
  const filter = parts.join(" && ");

  return pb.collection("study_sessions").getFullList({
    sort: "-started_at",
    filter,
    expand: "study_item,area",
  }) as Promise<StudySession[]>;
}

export async function startSession(studyItemId: string): Promise<StudySession> {
  // Auto-promote available items to in_progress
  const item = (await pb
    .collection("study_items")
    .getOne(studyItemId)) as import("@/types/domain").StudyItem;
  if (item.status === "available") {
    await pb
      .collection("study_items")
      .update(studyItemId, { status: "in_progress" });
    const { createEvent } = await import("./itemEventService");
    await createEvent(studyItemId, "started");
  }

  return pb.collection("study_sessions").create({
    study_item: studyItemId,
    area: item.area,
    started_at: new Date().toISOString(),
    owner: pb.authStore.record!.id,
  }) as Promise<StudySession>;
}

export async function endSession(
  sessionId: string,
  outcome: SessionOutcome,
  notes?: string,
): Promise<StudySession> {
  const endedAt = new Date().toISOString();
  const session = await (pb
    .collection("study_sessions")
    .getOne(sessionId) as Promise<StudySession>);
  const startedAt = new Date(session.started_at);
  const durationMinutes = Math.round(
    (Date.now() - startedAt.getTime()) / 60_000,
  );

  const updated = await (pb.collection("study_sessions").update(sessionId, {
    ended_at: endedAt,
    outcome,
    duration_minutes: durationMinutes,
    notes: notes ?? "",
  }) as Promise<StudySession>);

  if (outcome === "completed") {
    await completeItem(session.study_item);
  }

  return updated;
}

export async function logSession(
  data: Partial<StudySession>,
): Promise<StudySession> {
  const session = await (pb.collection("study_sessions").create({
    ...data,
    owner: pb.authStore.record!.id,
  }) as Promise<StudySession>);

  if (data.outcome === "completed" && data.study_item) {
    await completeItem(data.study_item);
  }

  return session;
}
