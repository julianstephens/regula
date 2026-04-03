import pb from "@/lib/pocketbase";
import type { EventType, ItemEvent } from "@/types/domain";

export async function createEvent(
  studyItemId: string,
  eventType: EventType,
  notes?: string,
): Promise<ItemEvent> {
  return pb.collection("regula_item_events").create({
    study_item: studyItemId,
    event_type: eventType,
    notes: notes ?? "",
    owner: pb.authStore.record!.id,
  }) as Promise<ItemEvent>;
}
