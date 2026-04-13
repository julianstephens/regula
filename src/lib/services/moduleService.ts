import pb from "@/lib/pocketbase";
import type { Module } from "@/types/domain";

export interface ModuleFilters {
  program?: string;
  programIds?: string[];
  sort?: string;
}

export async function listModules(
  filters: ModuleFilters = {},
): Promise<Module[]> {
  const parts: string[] = [];
  if (filters.program) parts.push(`program = "${filters.program}"`);
  if (filters.programIds?.length) {
    parts.push(
      `(${filters.programIds.map((id) => `program = "${id}"`).join(" || ")})`,
    );
  }
  const filter = parts.join(" && ");

  return pb.collection("regula_modules").getFullList({
    sort: filters.sort ?? "order,created",
    filter,
    expand: "program",
  }) as Promise<Module[]>;
}

export async function getModule(id: string): Promise<Module> {
  return pb.collection("regula_modules").getOne(id, {
    expand: "program",
  }) as Promise<Module>;
}

export async function createModule(data: Partial<Module>): Promise<Module> {
  return pb.collection("regula_modules").create(
    {
      ...data,
      owner: pb.authStore.record!.id,
    },
    { requestKey: null },
  ) as Promise<Module>;
}

export async function updateModule(
  id: string,
  data: Partial<Module>,
): Promise<Module> {
  return pb.collection("regula_modules").update(id, data) as Promise<Module>;
}

export async function deleteModule(id: string): Promise<void> {
  await pb.collection("regula_modules").delete(id);
}
