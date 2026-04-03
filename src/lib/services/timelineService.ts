import pb from "@/lib/pocketbase";
import type { ItemEvent, StudySession } from "@/types/domain";

export type TimelineEntry =
  | { kind: "event"; data: ItemEvent; timestamp: string }
  | { kind: "session"; data: StudySession; timestamp: string };

export async function listTimeline(limit = 50): Promise<TimelineEntry[]> {
  const [events, sessions] = await Promise.all([
    pb.collection("item_events").getFullList({
      sort: "-created",
      expand: "study_item",
      perPage: limit,
    }) as Promise<ItemEvent[]>,
    pb.collection("study_sessions").getFullList({
      sort: "-started_at",
      expand: "study_items,area",
      perPage: limit,
    }) as Promise<StudySession[]>,
  ]);

  const entries: TimelineEntry[] = [
    ...events.map(
      (e): TimelineEntry => ({
        kind: "event",
        data: e,
        // Use the item's due_date as the canonical position on the timeline.
        // Fall back to the event's created time only if no due_date is set.
        timestamp: e.expand?.study_item?.due_date ?? e.created,
      }),
    ),
    ...sessions.map(
      (s): TimelineEntry => ({
        kind: "session",
        data: s,
        timestamp: s.started_at ?? s.created,
      }),
    ),
  ];

  entries.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return entries.slice(0, limit);
}
