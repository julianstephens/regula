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
  type: "year" | "term" | "block" | "custom";
  status: "planned" | "active" | "completed" | "archived";
  start_date: string;
  end_date: string;
  block_weeks?: number;
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

export interface StudyItemsRecord extends RecordModel {
  title: string;
  item_type:
    | "reading"
    | "writing"
    | "memorization"
    | "exercise"
    | "review"
    | "quiz"
    | "exam"
    | "paper"
    | "other";
  status:
    | "planned"
    | "available"
    | "in_progress"
    | "completed"
    | "deferred"
    | "cancelled";
  area: string;
  program: string;
  resource: string;
  due_date: string;
  scheduled_date: string;
  completion_date: string;
  estimated_minutes: number;
  notes: string;
  owner: string;
}

export interface StudySessionsRecord extends RecordModel {
  study_item: string;
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
  study_item: string;
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
  block_weeks: number;
  owner: string;
}

export type CollectionRecords = {
  areas: AreasRecord;
  programs: ProgramsRecord;
  resources: ResourcesRecord;
  study_items: StudyItemsRecord;
  study_sessions: StudySessionsRecord;
  item_events: ItemEventsRecord;
  user_settings: UserSettingsRecord;
};
