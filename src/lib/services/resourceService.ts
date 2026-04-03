import pb from "@/lib/pocketbase";
import type { Resource } from "@/types/domain";

export async function listResources(
  resourceType?: string,
): Promise<Resource[]> {
  const filter = resourceType ? `resource_type = "${resourceType}"` : "";
  return pb.collection("regula_resources").getFullList({
    sort: "title",
    filter,
    expand: "area,study_items(resource)",
  }) as Promise<Resource[]>;
}

export async function createResource(
  data: Partial<Resource>,
): Promise<Resource> {
  return pb.collection("regula_resources").create({
    ...data,
    owner: pb.authStore.record!.id,
  }) as Promise<Resource>;
}

export async function updateResource(
  id: string,
  data: Partial<Resource>,
): Promise<Resource> {
  return pb.collection("regula_resources").update(id, data) as Promise<Resource>;
}
