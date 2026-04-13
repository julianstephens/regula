import type { RecordModel } from "pocketbase";

export interface AreasRecord extends RecordModel {
  name: string;
  color: string;
  description: string;
  owner: string;
}

export interface ProgramsRecord extends RecordModel {
  name: string;
  description: string;
  type: "year" | "term" | "custom" | "course";
  status: "planned" | "active" | "completed" | "archived";
  start_date: string;
  end_date: string;
  area?: string;
  meeting_days?: string[];
  makeup_days?: string[];
  parent: string;
  owner: string;
}

export interface ResourcesRecord extends RecordModel {
  title: string;
  author: string;
  url: string;
  notes: string;
  resource_type: "book" | "article" | "video" | "podcast" | "course" | "other";
  area: string;
  owner: string;
}

export interface ModulesRecord extends RecordModel {
  program: string;
  title: string;
  slug: string;
  order: number;
  goal: string;
  start_date: string;
  end_date: string;
  owner: string;
}

export interface LessonsRecord extends RecordModel {
  title: string;
  type:
    | "lesson"
    | "reading"
    | "writing"
    | "exercise"
    | "memorization"
    | "review"
    | "other";
  status:
    | "not_started"
    | "active"
    | "blocked"
    | "submitted"
    | "completed"
    | "archived";
  program: string;
  module: string;
  resource: string;
  prerequisites: string[];
  available_on: string;
  due_at: string;
  completed_at: string;
  estimated_minutes: number;
  grade_type: "none" | "pass_fail" | "numeric" | "rubric";
  mastery_evidence: string;
  notes: string;
  owner: string;
}

export interface AssessmentsRecord extends RecordModel {
  title: string;
  assessment_type:
    | "exam"
    | "paper"
    | "essay"
    | "oral"
    | "translation"
    | "recitation"
    | "reflection"
    | "project"
    | "practicum";
  submission_mode: "written" | "oral" | "digital" | "none";
  status: "not_started" | "in_progress" | "submitted" | "graded" | "archived";
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
  grade_type: "none" | "pass_fail" | "numeric" | "rubric";
  attachment?: string;
  attachment_url?: string;
  attachment_size_bytes?: number;
  owner: string;
}

export interface ReviewsRecord extends RecordModel {
  lesson: string;
  due_at: string;
  next_review_at: string;
  interval_days: number;
  ease_factor: number;
  last_reviewed_at: string;
  status: "active" | "suspended" | "completed";
  failure_count: number;
  owner: string;
}

export interface StudySessionsRecord extends RecordModel {
  lessons: string[];
  session_type:
    | "deep_work"
    | "light_review"
    | "planning"
    | "reread"
    | "exercise"
    | "writing";
  outcome: "completed" | "partial" | "blocked" | "abandoned";
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  notes: string;
  area: string;
  owner: string;
}

export interface ItemEventsRecord extends RecordModel {
  lesson: string;
  event_type:
    | "created"
    | "scheduled"
    | "started"
    | "completed"
    | "deferred"
    | "reopened"
    | "cancelled"
    | "edited";
  notes: string;
  owner: string;
}

export interface UserSettingsRecord extends RecordModel {
  ahead_weeks?: number;
  work_week?: string[];
  active_programs: string[];
  storage_quota_bytes?: number;
  storage_used_bytes?: number;
  owner: string;
}

export interface VacationsRecord extends RecordModel {
  name: string;
  start_date: string;
  end_date: string;
  strategy: "stack" | "recovery" | "push_back";
  recovery_before_days: number;
  recovery_after_days: number;
  work_week_override_days?: string[];
  owner: string;
}

export type CollectionRecords = {
  areas: AreasRecord;
  programs: ProgramsRecord;
  resources: ResourcesRecord;
  modules: ModulesRecord;
  lessons: LessonsRecord;
  assessments: AssessmentsRecord;
  reviews: ReviewsRecord;
  study_sessions: StudySessionsRecord;
  item_events: ItemEventsRecord;
  user_settings: UserSettingsRecord;
  vacations: VacationsRecord;
};
