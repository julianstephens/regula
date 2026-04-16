import pb from "@/lib/pocketbase";
import { decrementStorageUsed } from "@/lib/services/storageService";
import type { Assessment, AssessmentStatus } from "@/types/domain";

export interface AssessmentFilters {
  status?: AssessmentStatus;
  program?: string;
  module?: string;
  lesson?: string;
  sort?: string;
  dueAfter?: string;
  dueBefore?: string;
}

export async function listAssessments(
  filters: AssessmentFilters = {},
): Promise<Assessment[]> {
  const parts: string[] = [];
  if (filters.status) parts.push(`status = "${filters.status}"`);
  if (filters.program) parts.push(`program = "${filters.program}"`);
  if (filters.module) parts.push(`module = "${filters.module}"`);
  if (filters.lesson) parts.push(`lesson = "${filters.lesson}"`);
  if (filters.dueAfter) parts.push(`due_at >= "${filters.dueAfter}"`);
  if (filters.dueBefore) parts.push(`due_at <= "${filters.dueBefore}"`);
  const filter = parts.join(" && ");

  return pb.collection("regula_assessments").getFullList({
    sort: filters.sort ?? "due_at",
    filter,
    expand: "lesson,module,program",
  }) as Promise<Assessment[]>;
}

export async function getAssessment(id: string): Promise<Assessment> {
  return pb.collection("regula_assessments").getOne(id, {
    expand: "lesson,module,program",
  }) as Promise<Assessment>;
}

export async function createAssessment(
  data: Partial<Assessment>,
  attachmentFile?: File,
): Promise<Assessment> {
  return pb.collection("regula_assessments").create(
    {
      ...data,
      status: data.status ?? "not_started",
      owner: pb.authStore.record!.id,
      ...(attachmentFile && {
        attachment: attachmentFile,
        attachment_size_bytes: attachmentFile.size,
      }),
    },
    { requestKey: null },
  ) as Promise<Assessment>;
}

export async function updateAssessment(
  id: string,
  data: Partial<Assessment>,
  attachmentFile?: File,
): Promise<Assessment> {
  return pb.collection("regula_assessments").update(id, {
    ...data,
    ...(attachmentFile && {
      attachment: attachmentFile,
      attachment_size_bytes: attachmentFile.size,
    }),
  }) as Promise<Assessment>;
}

export async function deleteAttachment(
  assessmentId: string,
  currentSizeBytes: number,
): Promise<Assessment> {
  const record = (await pb
    .collection("regula_assessments")
    .update(assessmentId, {
      attachment: null,
      attachment_size_bytes: 0,
      attachment_url: "",
    })) as Assessment;
  await decrementStorageUsed(currentSizeBytes);
  return record;
}

export async function deleteAssessment(id: string): Promise<void> {
  await pb.collection("regula_assessments").delete(id);
}

export async function gradeAssessment(
  id: string,
  data: {
    score: number;
    max_score: number;
    passed: boolean;
    feedback?: string;
  },
): Promise<Assessment> {
  return pb.collection("regula_assessments").update(id, {
    status: "graded",
    completed_at: new Date().toISOString(),
    score: data.score,
    max_score: data.max_score,
    passed: data.passed,
    ...(data.feedback !== undefined ? { feedback: data.feedback } : {}),
  }) as Promise<Assessment>;
}
