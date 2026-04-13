import pb from "@/lib/pocketbase";
import type { Program } from "@/types/domain";

export async function listPrograms(): Promise<Program[]> {
  return pb.collection("regula_programs").getFullList({
    sort: "-created",
    expand: "parent,area",
  }) as Promise<Program[]>;
}

export async function getProgram(id: string): Promise<Program> {
  return pb.collection("regula_programs").getOne(id, {
    expand: "parent,regula_programs_via_parent",
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
  await pb.collection("regula_programs").delete(id);
}

export async function deleteProgramWithChildren(id: string): Promise<void> {
  // Explicitly delete all child programs first (PocketBase parent field has cascadeDelete: false)
  // requestKey: null disables PocketBase auto-cancellation, which would otherwise cancel parallel
  // getFullList calls for the same collection when recursing into multiple children simultaneously.
  const children = await pb
    .collection("regula_programs")
    .getFullList({ filter: `parent = "${id}"`, requestKey: null });
  await Promise.all(children.map((c) => deleteProgramWithChildren(c.id)));

  // Explicitly delete all program content (don't rely solely on PocketBase cascade)
  const [modules, lessons, assessments] = await Promise.all([
    pb.collection("regula_modules").getFullList({
      filter: `program = "${id}"`,
      fields: "id",
      requestKey: null,
    }),
    pb.collection("regula_lessons").getFullList({
      filter: `program = "${id}"`,
      fields: "id",
      requestKey: null,
    }),
    pb.collection("regula_assessments").getFullList({
      filter: `program = "${id}"`,
      fields: "id",
      requestKey: null,
    }),
  ]);

  // Delete in order to avoid cascade race conditions:
  // assessments first (modules cascade-delete assessments; do ours first)
  await Promise.all(
    assessments.map((r) => pb.collection("regula_assessments").delete(r.id)),
  );
  // lessons next (lesson cascade-deletes reviews and item_events)
  await Promise.all(
    lessons.map((r) => pb.collection("regula_lessons").delete(r.id)),
  );
  // modules last (their assessments are already gone)
  await Promise.all(
    modules.map((r) => pb.collection("regula_modules").delete(r.id)),
  );

  await pb.collection("regula_programs").delete(id);
}
