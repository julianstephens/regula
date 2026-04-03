import { DEFAULT_BLOCK_WEEKS } from "@/lib/blocks";
import pb from "@/lib/pocketbase";
import type { UserSettings } from "@/types/domain";

export async function getSettings(): Promise<UserSettings> {
  const records = (await pb
    .collection("user_settings")
    .getFullList()) as UserSettings[];

  if (records.length > 0) return records[0];

  // Auto-create defaults on first call
  return pb.collection("user_settings").create({
    block_weeks: DEFAULT_BLOCK_WEEKS,
    owner: pb.authStore.record!.id,
  }) as Promise<UserSettings>;
}

export async function updateSettings(
  id: string,
  data: Partial<Pick<UserSettings, "block_weeks">>,
): Promise<UserSettings> {
  return pb
    .collection("user_settings")
    .update(id, data) as Promise<UserSettings>;
}
