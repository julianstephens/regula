import type {
  AssessmentType,
  LessonType,
  ProgramStatus,
  ProgramType,
} from "@/types/domain";
import { parseAllDocuments } from "yaml";

export interface ParsedCourseLesson {
  title: string;
  type: LessonType;
  due_at?: string;
  available_on?: string;
  estimated_minutes?: number;
  notes?: string;
  resource?: string;
}

export interface ParsedCourseAssessment {
  title: string;
  assessment_type: AssessmentType;
  prompt?: string;
  due_at?: string;
  max_score?: number;
}

export interface ParsedCourseModule {
  title: string;
  slug?: string;
  order?: number;
  goal?: string;
  start_date?: string;
  end_date?: string;
  lessons: ParsedCourseLesson[];
  assessments: ParsedCourseAssessment[];
}

export interface ParsedCourseOfStudy {
  name: string;
  type: ProgramType;
  status: ProgramStatus;
  description?: string;
  start_date?: string;
  end_date?: string;
  area?: string;
  meeting_days?: string[];
  modules: ParsedCourseModule[];
  lessons: ParsedCourseLesson[];
}

function parseLesson(raw: Record<string, unknown>): ParsedCourseLesson {
  return {
    title: String(raw.title ?? ""),
    type: (raw.type as LessonType) ?? "lesson",
    due_at: raw.due_at != null ? String(raw.due_at) : undefined,
    available_on:
      raw.available_on != null ? String(raw.available_on) : undefined,
    estimated_minutes:
      raw.estimated_minutes != null ? Number(raw.estimated_minutes) : undefined,
    notes: raw.notes != null ? String(raw.notes) : undefined,
    resource: raw.resource != null ? String(raw.resource) : undefined,
  };
}

function parseAssessment(raw: Record<string, unknown>): ParsedCourseAssessment {
  return {
    title: String(raw.title ?? ""),
    assessment_type:
      ((raw.assessment_type ?? raw.type) as AssessmentType) ?? "exam",
    prompt: raw.prompt != null ? String(raw.prompt) : undefined,
    due_at: raw.due_at != null ? String(raw.due_at) : undefined,
    max_score: raw.max_score != null ? Number(raw.max_score) : undefined,
  };
}

function parseModule(raw: Record<string, unknown>): ParsedCourseModule {
  return {
    title: String(raw.title ?? ""),
    slug: raw.slug != null ? String(raw.slug) : undefined,
    order: raw.order != null ? Number(raw.order) : undefined,
    goal: raw.goal != null ? String(raw.goal) : undefined,
    start_date: raw.start_date != null ? String(raw.start_date) : undefined,
    end_date: raw.end_date != null ? String(raw.end_date) : undefined,
    lessons: Array.isArray(raw.lessons)
      ? (raw.lessons as Record<string, unknown>[]).map(parseLesson)
      : [],
    assessments: Array.isArray(raw.assessments)
      ? (raw.assessments as Record<string, unknown>[]).map(parseAssessment)
      : [],
  };
}

export interface ParsedCourseOfStudyFile {
  parent?: ParsedCourseOfStudy;
  programs: ParsedCourseOfStudy[];
}

function parseSingleDocument(
  filename: string,
  raw: Record<string, unknown>,
): ParsedCourseOfStudy {
  if (!raw || typeof raw !== "object") {
    throw new Error(`"${filename}" does not contain a valid YAML object.`);
  }

  if (!raw.name || typeof raw.name !== "string" || !raw.name.trim()) {
    throw new Error(`"${filename}" is missing required field: name`);
  }

  if (!raw.type || typeof raw.type !== "string" || !raw.type.trim()) {
    throw new Error(`"${filename}" is missing required field: type`);
  }

  const validTypes: ProgramType[] = ["year", "term", "custom", "course"];
  if (!validTypes.includes(raw.type as ProgramType)) {
    throw new Error(
      `"${filename}" has invalid type "${raw.type}". Must be one of: ${validTypes.join(", ")}`,
    );
  }

  return {
    name: raw.name.trim(),
    type: raw.type as ProgramType,
    status: (raw.status as ProgramStatus) ?? "planned",
    description: raw.description != null ? String(raw.description) : undefined,
    start_date: raw.start_date != null ? String(raw.start_date) : undefined,
    end_date: raw.end_date != null ? String(raw.end_date) : undefined,
    area: raw.area != null ? String(raw.area) : undefined,
    meeting_days: Array.isArray(raw.meeting_days)
      ? (raw.meeting_days as string[]).map(String)
      : undefined,
    modules: Array.isArray(raw.modules)
      ? (raw.modules as Record<string, unknown>[]).map(parseModule)
      : [],
    lessons: Array.isArray(raw.lessons)
      ? (raw.lessons as Record<string, unknown>[]).map(parseLesson)
      : [],
  };
}

export function parseCourseOfStudyFile(
  filename: string,
  content: string,
): ParsedCourseOfStudyFile {
  let docs: ReturnType<typeof parseAllDocuments>;
  try {
    docs = parseAllDocuments(content);
  } catch (err) {
    throw new Error(
      `Failed to parse "${filename}" as YAML: ${(err as Error).message}`,
    );
  }

  if (docs.length === 0) {
    throw new Error(`"${filename}" does not contain any YAML documents.`);
  }

  const parsed = docs.map((doc, i) => {
    if (doc.errors.length > 0) {
      throw new Error(
        `Document ${i + 1} in "${filename}" has parse errors: ${doc.errors[0].message}`,
      );
    }
    const raw = doc.toJSON() as Record<string, unknown>;
    return parseSingleDocument(filename, raw);
  });

  if (parsed.length === 1) {
    return { programs: parsed };
  }

  return { parent: parsed[0], programs: parsed.slice(1) };
}
