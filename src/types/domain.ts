export type ProgramType = "year" | "term" | "custom" | "course";
export type ProgramStatus = "planned" | "active" | "completed" | "archived";

export type LessonType =
  | "lesson"
  | "reading"
  | "writing"
  | "exercise"
  | "memorization"
  | "review"
  | "other";
export type LessonStatus =
  | "not_started"
  | "active"
  | "blocked"
  | "submitted"
  | "completed"
  | "archived";

export type AssessmentType =
  | "exam"
  | "paper"
  | "essay"
  | "oral"
  | "translation"
  | "recitation"
  | "reflection"
  | "project"
  | "practicum";
export type SubmissionMode = "written" | "oral" | "digital" | "none";
export type AssessmentStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "graded"
  | "archived";

export type GradeType = "none" | "pass_fail" | "numeric" | "rubric";
export type ReviewStatus = "active" | "suspended" | "completed";

export type SessionType =
  | "deep_work"
  | "light_review"
  | "planning"
  | "reread"
  | "exercise"
  | "writing";
export type SessionOutcome = "completed" | "partial" | "blocked" | "abandoned";

export type EventType =
  | "created"
  | "scheduled"
  | "started"
  | "completed"
  | "deferred"
  | "reopened"
  | "cancelled"
  | "edited";

export type ResourceType =
  | "book"
  | "article"
  | "video"
  | "podcast"
  | "course"
  | "other";

export interface Area {
  id: string;
  name: string;
  color: string;
  description: string;
  owner: string;
  created: string;
  updated: string;
}

export interface Program {
  id: string;
  name: string;
  description: string;
  type: ProgramType;
  status: ProgramStatus;
  start_date: string;
  end_date: string;
  area?: string;
  meeting_days?: string[];
  makeup_days?: string[];
  parent: string;
  owner: string;
  created: string;
  updated: string;
  expand?: {
    parent?: Program;
    area?: Area;
    regula_programs_via_parent?: Program[];
  };
}

export interface Module {
  id: string;
  program: string;
  title: string;
  slug: string;
  order: number;
  goal: string;
  start_date: string;
  end_date: string;
  owner: string;
  created: string;
  updated: string;
  expand?: { program?: Program };
}

export interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  status: LessonStatus;
  program: string;
  module: string;
  resource: string;
  prerequisites: string[];
  available_on: string;
  due_at: string;
  completed_at: string;
  estimated_minutes: number;
  grade_type: GradeType;
  mastery_evidence: string;
  notes: string;
  owner: string;
  created: string;
  updated: string;
  expand?: {
    program?: Program;
    module?: Module;
    resource?: Resource;
    prerequisites?: Lesson[];
  };
}

export interface Assessment {
  id: string;
  title: string;
  assessment_type: AssessmentType;
  submission_mode: SubmissionMode;
  status: AssessmentStatus;
  lesson: string;
  module: string;
  program: string;
  prompt: string;
  metadata_json: string;
  score: number;
  max_score: number;
  weight: number;
  passed: boolean;
  feedback: string;
  due_at: string;
  submitted_at: string;
  completed_at: string;
  grade_type: GradeType;
  attachment: string;
  attachment_url: string;
  attachment_size_bytes: number;
  owner: string;
  created: string;
  updated: string;
  expand?: {
    lesson?: Lesson;
    module?: Module;
    program?: Program;
  };
}

export interface Review {
  id: string;
  lesson: string;
  due_at: string;
  next_review_at: string;
  interval_days: number;
  ease_factor: number;
  last_reviewed_at: string;
  status: ReviewStatus;
  failure_count: number;
  owner: string;
  created: string;
  updated: string;
  expand?: { lesson?: Lesson };
}

export interface UserSettings {
  id: string;
  ahead_weeks: number;
  work_week: string[];
  active_programs: string[];
  storage_quota_bytes: number;
  storage_used_bytes: number;
  owner: string;
  created: string;
  updated: string;
  expand?: { active_programs?: Program[] };
}

export interface Resource {
  id: string;
  title: string;
  author: string;
  url: string;
  notes: string;
  resource_type: ResourceType;
  area: string;
  owner: string;
  created: string;
  updated: string;
  expand?: {
    area?: Area;
    regula_lessons_via_resource?: Lesson[];
  };
}

export interface StudySession {
  id: string;
  lessons: string[];
  session_type: SessionType;
  outcome: SessionOutcome;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  notes: string;
  area: string;
  owner: string;
  created: string;
  updated: string;
  expand?: {
    lessons?: Lesson[];
    area?: Area;
  };
}

export interface ItemEvent {
  id: string;
  lesson: string;
  event_type: EventType;
  notes: string;
  owner: string;
  created: string;
  updated: string;
  expand?: { lesson?: Lesson };
}

export type VacationStrategy = "stack" | "recovery" | "push_back";

export interface Vacation {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  strategy: VacationStrategy;
  recovery_before_days: number;
  recovery_after_days: number;
  work_week_override_days?: string[];
  owner: string;
  created: string;
  updated: string;
}
