import { toPbDate } from "@/lib/dates";
import pb from "@/lib/pocketbase";
import type { CourseSession, Program } from "@/types/domain";

// Maps day abbreviation to JS Date.getDay() index (0=Sun…6=Sat)
const DAY_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

export async function generateCourseSessions(course: Program): Promise<void> {
  if (!course.start_date || !course.end_date || !course.meeting_days?.length) {
    console.log("[generateCourseSessions] skipped — missing fields", {
      start_date: course.start_date,
      end_date: course.end_date,
      meeting_days: course.meeting_days,
    });
    return;
  }

  const meetingIndices = course.meeting_days.map((d) => DAY_INDEX[d]);
  const start = new Date(course.start_date);
  const end = new Date(course.end_date);
  const ownerId = pb.authStore.record!.id;

  console.log("[generateCourseSessions] start", {
    courseId: course.id,
    start: start.toISOString(),
    end: end.toISOString(),
    meetingIndices,
    ownerId,
  });

  const current = new Date(start);
  // Advance to start of day
  current.setHours(0, 0, 0, 0);

  const creates: Promise<unknown>[] = [];

  while (current <= end) {
    if (meetingIndices.includes(current.getDay())) {
      creates.push(
        pb.collection("regula_course_sessions").create(
          {
            course: course.id,
            date: toPbDate(new Date(current)),
            notes: "",
            status: "scheduled",
            owner: ownerId,
          },
          { requestKey: null },
        ),
      );
    }
    current.setDate(current.getDate() + 1);
  }

  console.log(
    "[generateCourseSessions] firing",
    creates.length,
    "sessions in batches of 5",
  );
  for (let i = 0; i < creates.length; i += 5) {
    await Promise.all(creates.slice(i, i + 5));
  }
  console.log("[generateCourseSessions] done");
}

export async function listCourseSessions(filters?: {
  course?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<CourseSession[]> {
  const parts: string[] = [];

  if (filters?.course) {
    parts.push(`course = "${filters.course}"`);
  }
  if (filters?.dateFrom) {
    parts.push(`date >= "${filters.dateFrom}"`);
  }
  if (filters?.dateTo) {
    parts.push(`date <= "${filters.dateTo}"`);
  }

  return pb.collection("regula_course_sessions").getFullList({
    filter: parts.join(" && ") || undefined,
    sort: "date",
    expand: "course",
  }) as Promise<CourseSession[]>;
}

export async function getCourseSession(id: string): Promise<CourseSession> {
  return pb.collection("regula_course_sessions").getOne(id, {
    expand: "course",
  }) as Promise<CourseSession>;
}

export async function updateCourseSession(
  id: string,
  data: Partial<Pick<CourseSession, "notes" | "status" | "date">>,
): Promise<CourseSession> {
  return pb
    .collection("regula_course_sessions")
    .update(id, data, { requestKey: null }) as Promise<CourseSession>;
}

export async function deleteCourseSessions(courseId: string): Promise<void> {
  const sessions = await pb
    .collection("regula_course_sessions")
    .getFullList({ filter: `course = "${courseId}"` });
  await Promise.all(
    sessions.map((s) =>
      pb
        .collection("regula_course_sessions")
        .delete(s.id, { requestKey: null }),
    ),
  );
}
