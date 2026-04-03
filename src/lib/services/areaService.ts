import pb from "@/lib/pocketbase";
import type { Area } from "@/types/domain";

export async function listAreas(): Promise<Area[]> {
  return pb.collection("regula_areas").getFullList({ sort: "name" }) as Promise<
    Area[]
  >;
}

export async function createArea(
  data: Omit<Area, "id" | "created" | "updated" | "owner">,
): Promise<Area> {
  return pb.collection("regula_areas").create({
    ...data,
    owner: pb.authStore.record!.id,
  }) as Promise<Area>;
}

export async function updateArea(
  id: string,
  data: Partial<Area>,
): Promise<Area> {
  return pb.collection("regula_areas").update(id, data) as Promise<Area>;
}
