import pb from "@/lib/pocketbase";
import type { Review, ReviewStatus } from "@/types/domain";

const DEFAULT_EASE_FACTOR = 2.5;
const DEFAULT_INTERVAL_DAYS = 1;

export interface ReviewFilters {
  status?: ReviewStatus;
  lesson?: string;
  dueBefore?: string;
  sort?: string;
}

export async function listReviews(
  filters: ReviewFilters = {},
): Promise<Review[]> {
  const parts: string[] = [];
  if (filters.status) parts.push(`status = "${filters.status}"`);
  if (filters.lesson) parts.push(`lesson = "${filters.lesson}"`);
  if (filters.dueBefore) parts.push(`due_at <= "${filters.dueBefore}"`);
  const filter = parts.join(" && ");

  return pb.collection("regula_reviews").getFullList({
    sort: filters.sort ?? "due_at",
    filter,
    expand: "lesson",
  }) as Promise<Review[]>;
}

export async function getReview(id: string): Promise<Review> {
  return pb.collection("regula_reviews").getOne(id, {
    expand: "lesson",
  }) as Promise<Review>;
}

export async function createReview(data: Partial<Review>): Promise<Review> {
  return pb.collection("regula_reviews").create(
    {
      ease_factor: DEFAULT_EASE_FACTOR,
      interval_days: DEFAULT_INTERVAL_DAYS,
      status: "active",
      failure_count: 0,
      ...data,
      owner: pb.authStore.record!.id,
    },
    { requestKey: null },
  ) as Promise<Review>;
}

export async function updateReview(
  id: string,
  data: Partial<Review>,
): Promise<Review> {
  return pb.collection("regula_reviews").update(id, data) as Promise<Review>;
}

export async function deleteReview(id: string): Promise<void> {
  await pb.collection("regula_reviews").delete(id);
}

/**
 * Records a review outcome and schedules the next review using a simplified
 * SM-2 spaced repetition algorithm.
 *
 * @param lessonId   The lesson being reviewed
 * @param outcome    "pass" advances the interval; "fail" resets it to 1 day
 */
export async function createNextReview(
  lessonId: string,
  outcome: "pass" | "fail",
): Promise<Review> {
  const now = new Date();

  // Find existing active review for this lesson, or use defaults
  const existing = await pb
    .collection("regula_reviews")
    .getFullList({
      filter: `lesson = "${lessonId}" && status = "active"`,
      sort: "-created",
    })
    .then((r) => (r[0] as unknown as Review | undefined) ?? null);

  let intervalDays = existing?.interval_days ?? DEFAULT_INTERVAL_DAYS;
  let easeFactor = existing?.ease_factor ?? DEFAULT_EASE_FACTOR;
  let failureCount = existing?.failure_count ?? 0;

  if (outcome === "pass") {
    intervalDays = Math.round(intervalDays * easeFactor);
    easeFactor = Math.max(1.3, easeFactor + 0.1);
  } else {
    failureCount += 1;
    intervalDays = 1;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  }

  const nextReviewDate = new Date(now);
  nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);
  const nextReviewAt = nextReviewDate.toISOString();

  // Mark the existing review as completed if present
  if (existing) {
    await pb.collection("regula_reviews").update(existing.id, {
      status: "completed",
      last_reviewed_at: now.toISOString(),
      next_review_at: nextReviewAt,
    });
  }

  // Create the next scheduled review
  return createReview({
    lesson: lessonId,
    due_at: nextReviewAt,
    interval_days: intervalDays,
    ease_factor: easeFactor,
    failure_count: failureCount,
    status: "active",
  });
}
