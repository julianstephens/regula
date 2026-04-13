import pb from "@/lib/pocketbase";
import type { EventType, ItemEvent } from "@/types/domain";

export async function listEvents(lessonId: string): Promise<ItemEvent[]> {
  return pb.collection("regula_item_events").getFullList({
    filter: `lesson = "${lessonId}"`,
    sort: "created",
  }) as Promise<ItemEvent[]>;
}

export async function createEvent(
  lessonId: string,
  eventType: EventType,
  notes?: string,
): Promise<ItemEvent> {
  return pb.collection("regula_item_events").create(
    {
      lesson: lessonId,
      event_type: eventType,
      notes: notes ?? "",
      owner: pb.authStore.record!.id,
    },
    { requestKey: null },
  ) as Promise<ItemEvent>;
}
