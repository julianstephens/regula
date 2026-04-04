export type ProgramType = "year" | "term" | "block" | "custom";
export type ProgramStatus = "planned" | "active" | "completed" | "archived";

export type ItemType =
  | "reading"
  | "writing"
  | "memorization"
  | "exercise"
  | "review"
  | "quiz"
  | "exam"
  | "paper"
  | "other";
export type ItemStatus =
  | "planned"
  | "available"
  | "in_progress"
  | "completed"
  | "deferred"
  | "cancelled";

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
  block_weeks?: number;
  parent: string;
  owner: string;
  created: string;
  updated: string;
  expand?: {
    parent?: Program;
    "regula_programs(parent)"?: Program[];
  };
}

export interface UserSettings {
  id: string;
  block_weeks: number;
  owner: string;
  created: string;
  updated: string;
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
    "study_items(resource)"?: StudyItem[];
  };
}

export interface StudyItem {
  id: string;
  title: string;
  item_type: ItemType;
  status: ItemStatus;
  area: string;
  program: string;
  resource: string;
  due_date: string;
  scheduled_date: string;
  completion_date: string;
  estimated_minutes: number;
  notes: string;
  owner: string;
  created: string;
  updated: string;
  expand?: {
    area?: Area;
    program?: Program;
    resource?: Resource;
  };
}

export interface StudySession {
  id: string;
  study_items: string[];
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
    study_items?: StudyItem[];
    area?: Area;
  };
}

export interface ItemEvent {
  id: string;
  study_item: string;
  event_type: EventType;
  notes: string;
  owner: string;
  created: string;
  updated: string;
  expand?: { study_item?: StudyItem; };
}
