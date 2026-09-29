// Mirrors backend/routers/qplanner_router.py. Fields stay snake_case so there is
// one spelling of every name across the wire, same as features/roadmap.

export type TaskKind =
  | 'learn_video'
  | 'read_slides'
  | 'practice_quiz'
  | 'revise_flashcards';

export type SprintStatus = 'locked' | 'active' | 'completed';
export type DriftStatus = 'ahead' | 'on_track' | 'behind';
export type Emphasis = 'light' | 'normal' | 'deep';

export interface Envelope<T> {
  data: T;
  meta: unknown;
  error: unknown;
}

export interface PlanTask {
  task_id: string;
  topic_slug: string;
  title: string;
  kind: TaskKind;
  minutes: number;
  ref: Record<string, unknown>;
}

export interface PlanDay {
  date: string;              // YYYY-MM-DD
  sprint_index: number | null;
  tasks: PlanTask[];
}

export interface SprintQuizResult {
  attempt_id: string;
  score_pct: number;
  passed: boolean;
  submitted_at: string;
}

export interface PlanSprint {
  index: number;
  title: string;
  focus_line: string;
  why_it_matters: string;
  start_date: string;
  end_date: string;
  topic_slugs: string[];
  planned_minutes: number;
  status: SprintStatus;
  quiz: SprintQuizResult | null;
}

export interface Feasibility {
  total_minutes: number;
  weeks_available: number;
  weeks_needed: number;
  required_weekly_minutes: number;
  suggested_weekly_minutes: number;
  feasible: boolean;
}

export interface Drift {
  status: DriftStatus;
  expected: number;
  completed: number;
  total: number;
  delta: number;
}

export interface Plan {
  id: string;
  firebase_uid: string;
  status: 'active' | 'archived' | 'completed';
  preset_slug: string;
  goal_label: string;
  target_domains: string[] | null;
  target_slugs: string[];
  start_date: string;
  deadline: string;
  weekly_minutes: number;
  study_days: number[];
  ai_generated: boolean;
  strategy_note: string;
  personalized_tips: string[];
  emphasis: Record<string, Emphasis>;
  sprints: PlanSprint[];
  days: PlanDay[];
  completed_tasks: string[];
  feasibility: Feasibility;
  drift: Drift;
  today: PlanDay;
  next_up: PlanDay | null;
  created_at: string;
  updated_at: string;
}

export interface Preset {
  slug: string;
  label: string;
  tagline: string;
  target_domains: string[] | null;
  default_weeks: number;
  default_weekly_minutes: number;
}

export interface PreviewTopic {
  slug: string;
  title: string;
  domain: string;
  minutes: number;
}

export interface PlanPreview {
  goal_label: string;
  topic_count: number;
  already_completed: number;
  sprint_count: number;
  total_minutes: number;
  start_date: string;
  end_date: string;
  topics: PreviewTopic[];
  sprints: { index: number; topic_slugs: string[]; planned_minutes: number }[];
  feasibility: Feasibility;
}

export type SubjectLevel = 'zero' | 'basics' | 'revision';

export interface PlanRequest {
  preset_slug: string;
  deadline?: string | null;  // YYYY-MM-DD; omitted = finish when the schedule does
  start_date?: string;
  name?: string;
  weekly_minutes?: number;
  study_days?: number[];     // 0 = Monday .. 6 = Sunday
  day_minutes?: number[];    // 7 values; replaces weekly_minutes + study_days
  target_domains?: string[] | null;
  domain_levels?: Record<string, SubjectLevel>;
}

export interface SprintQuizOption {
  id: string;
  text: string;
}

// Mirrors backend/services/quiz_seed.py: the question text is `prompt`, options are
// {id, text} objects, and the grader compares the chosen option's `id`.
export interface SprintQuizQuestion {
  _id: string;
  prompt: string;
  type?: string;
  options: SprintQuizOption[];
  difficulty?: string;
  concept?: string;
}

export interface SprintQuizPaper {
  sprint_index: number;
  sprint_title: string;
  topic_slugs: string[];
  questions: SprintQuizQuestion[];
  total_questions: number;
  pass_mark_pct: number;
}

export interface SprintQuizOutcome {
  attempt_id: string;
  score_pct: number;
  xp_earned: number;
  passed: boolean;
  pass_mark_pct: number;
  sprints: PlanSprint[];
}

export const TASK_KIND_LABEL: Record<TaskKind, string> = {
  learn_video: 'Watch',
  read_slides: 'Read',
  practice_quiz: 'Practice',
  revise_flashcards: 'Revise',
};

// 0 = Monday, matching Python's date.weekday()
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
