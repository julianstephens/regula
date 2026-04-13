import pb from "@/lib/pocketbase";
import type { Program, UserSettings } from "@/types/domain";

export const DEFAULT_AHEAD_WEEKS = 1;
export const DEFAULT_WORK_WEEK: string[] = ["mon", "tue", "wed", "thu", "fri"];

export async function getSettings(): Promise<UserSettings> {
  const records = (await pb
    .collection("regula_user_settings")
    .getFullList()) as UserSettings[];

  if (records.length > 0) return records[0];

  // Auto-create defaults on first call
  return pb.collection("regula_user_settings").create({
    ahead_weeks: DEFAULT_AHEAD_WEEKS,
    work_week: DEFAULT_WORK_WEEK,
    active_programs: [],
    owner: pb.authStore.record!.id,
  }) as Promise<UserSettings>;
}

export async function updateSettings(
  id: string,
  data: Partial<Pick<UserSettings, "ahead_weeks" | "work_week">>,
): Promise<UserSettings> {
  return pb
    .collection("regula_user_settings")
    .update(id, data) as Promise<UserSettings>;
}

export async function getActivePrograms(): Promise<Program[]> {
  const records = (await pb
    .collection("regula_user_settings")
    .getFullList({ expand: "active_programs" })) as (UserSettings & {
    expand?: { active_programs?: Program[] };
  })[];
  if (!records.length) return [];
  return records[0].expand?.active_programs ?? [];
}

export async function setActivePrograms(
  settingsId: string,
  programIds: string[],
): Promise<UserSettings> {
  return pb.collection("regula_user_settings").update(settingsId, {
    active_programs: programIds,
  }) as Promise<UserSettings>;
}

/**
 * If the given program is a year/term type and is the only such program,
 * automatically adds it to the user's active programs.
 */
export async function autoActivateIfFirstYearTermProgram(
  newProgramId: string,
): Promise<void> {
  const [settings, allPrograms] = await Promise.all([
    getSettings(),
    pb.collection("regula_programs").getFullList() as Promise<Program[]>,
  ]);

  const newProgram = allPrograms.find((p) => p.id === newProgramId);
  if (!newProgram || (newProgram.type !== "year" && newProgram.type !== "term"))
    return;

  const yearTermPrograms = allPrograms.filter(
    (p) => p.type === "year" || p.type === "term",
  );
  if (yearTermPrograms.length !== 1) return;

  const alreadyActive: string[] = settings.active_programs ?? [];
  if (alreadyActive.includes(newProgramId)) return;

  await setActivePrograms(settings.id, [...alreadyActive, newProgramId]);
}
