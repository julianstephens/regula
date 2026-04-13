import pb from "@/lib/pocketbase";
import { getSettings } from "@/lib/services/settingsService";

export const DEFAULT_QUOTA_BYTES = 524_288_000; // 500 MB

export async function getStorageUsage(): Promise<{
  used: number;
  quota: number;
  percent: number;
}> {
  const settings = await getSettings();
  const used = settings.storage_used_bytes ?? 0;
  const quota = settings.storage_quota_bytes ?? DEFAULT_QUOTA_BYTES;
  const percent = quota > 0 ? (used / quota) * 100 : 0;
  return { used, quota, percent };
}

export async function checkQuota(fileSizeBytes: number): Promise<void> {
  const { used, quota } = await getStorageUsage();
  if (used + fileSizeBytes > quota) {
    const remaining = Math.max(0, quota - used);
    throw new Error(
      `Not enough storage. You have ${(remaining / 1_048_576).toFixed(1)} MB remaining.`,
    );
  }
}

export async function checkQuotaForReplacement(
  newSizeBytes: number,
  oldSizeBytes: number,
): Promise<void> {
  const { used, quota } = await getStorageUsage();
  const effectiveUsed = used - (oldSizeBytes ?? 0);
  if (effectiveUsed + newSizeBytes > quota) {
    const remaining = Math.max(0, quota - effectiveUsed);
    throw new Error(
      `Not enough storage. You have ${(remaining / 1_048_576).toFixed(1)} MB remaining after releasing the current file.`,
    );
  }
}

export async function incrementStorageUsed(bytes: number): Promise<void> {
  const settings = await getSettings();
  const current = settings.storage_used_bytes ?? 0;
  await pb.collection("regula_user_settings").update(settings.id, {
    storage_used_bytes: Math.max(0, current + bytes),
  });
}

export async function decrementStorageUsed(bytes: number): Promise<void> {
  const settings = await getSettings();
  const current = settings.storage_used_bytes ?? 0;
  await pb.collection("regula_user_settings").update(settings.id, {
    storage_used_bytes: Math.max(0, current - bytes),
  });
}
