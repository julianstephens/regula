import pb from "@/lib/pocketbase";
import type { ItemStatus, StudyItem } from "@/types/domain";
import { createEvent } from "./itemEventService";

export interface StudyItemFilters {
  status?: ItemStatus;
  area?: string;
  program?: string;
  sort?: string;
}

export async function listStudyItems(
  filters: StudyItemFilters = {},
): Promise<StudyItem[]> {
  const parts: string[] = [];
  if (filters.status) parts.push(`status = "${filters.status}"`);
  if (filters.area) parts.push(`area = "${filters.area}"`);
  if (filters.program) parts.push(`program = "${filters.program}"`);
  const filter = parts.join(" && ");

  return pb.collection("regula_study_items").getFullList({
    sort: filters.sort ?? "due_date",
    filter,
    expand: "area,program,resource",
  }) as Promise<StudyItem[]>;
}

export async function getStudyItem(id: string): Promise<StudyItem> {
  return pb.collection("regula_study_items").getOne(id, {
    expand: "area,program,resource",
  }) as Promise<StudyItem>;
}

export async function createStudyItem(
  data: Partial<StudyItem>,
): Promise<StudyItem> {
  const item = await (pb.collection("regula_study_items").create({
    ...data,
    status: data.status ?? "planned",
    owner: pb.authStore.record!.id,
  }) as Promise<StudyItem>);
  await createEvent(item.id, "created");
  return item;
}

export async function updateStudyItem(
  id: string,
  data: Partial<StudyItem>,
): Promise<StudyItem> {
  const item = await (pb
    .collection("regula_study_items")
    .update(id, data) as Promise<StudyItem>);
  await createEvent(id, "edited");
  return item;
}

export async function changeStatus(
  id: string,
  status: ItemStatus,
): Promise<StudyItem> {
  const item = await (pb
    .collection("regula_study_items")
    .update(id, { status }) as Promise<StudyItem>);

  const eventMap: Record<ItemStatus, Parameters<typeof createEvent>[1]> = {
    planned: "created",
    available: "created",
    in_progress: "started",
    completed: "completed",
    deferred: "deferred",
    cancelled: "cancelled",
  };
  await createEvent(id, eventMap[status]);
  return item;
}

export async function completeItem(id: string): Promise<StudyItem> {
  const item = await (pb.collection("regula_study_items").update(id, {
    status: "completed",
    completion_date: new Date().toISOString(),
  }) as Promise<StudyItem>);
  await createEvent(id, "completed");
  return item;
}

export async function deleteStudyItemsByProgram(
  programId: string,
): Promise<void> {
  const items = await pb
    .collection("regula_study_items")
    .getFullList({ filter: `program = "${programId}"` });
  await Promise.all(
    items.map((item) => pb.collection("regula_study_items").delete(item.id)),
  );
}
