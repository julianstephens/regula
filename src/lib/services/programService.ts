import pb from "@/lib/pocketbase";
import type { Program } from "@/types/domain";
import { deleteStudyItemsByProgram } from "./studyItemService";

export async function listPrograms(): Promise<Program[]> {
  return pb.collection("regula_programs").getFullList({
    sort: "-created",
    expand: "parent",
  }) as Promise<Program[]>;
}

export async function getProgram(id: string): Promise<Program> {
  return pb.collection("regula_programs").getOne(id, {
    expand: "parent,programs(parent)",
  }) as Promise<Program>;
}

export async function createProgram(data: Partial<Program>): Promise<Program> {
  return pb.collection("regula_programs").create({
    ...data,
    owner: pb.authStore.record!.id,
  }) as Promise<Program>;
}

export async function updateProgram(
  id: string,
  data: Partial<Program>,
): Promise<Program> {
  return pb.collection("regula_programs").update(id, data) as Promise<Program>;
}

export async function deleteProgram(id: string): Promise<void> {
  await deleteStudyItemsByProgram(id);
  await pb.collection("regula_programs").delete(id);
}

export async function deleteProgramWithChildren(id: string): Promise<void> {
  const children = await pb
    .collection("regula_programs")
    .getFullList({ filter: `parent = "${id}"` });
  await Promise.all(children.map((c) => deleteProgramWithChildren(c.id)));
  await deleteStudyItemsByProgram(id);
  await pb.collection("regula_programs").delete(id);
}
