import { apiClient } from '@/lib/apiClient';

export interface StudentSummary {
  completed: number;
  total: number;
  progress_pct: number;
  last_active: string | null;
  at_risk: boolean;
}

export interface AnalyticsOverview {
  courses: { id: string; title: string; status: string; lessons: number }[];
  kpis: { enrollments: number; students: number; active_7d: number; avg_progress_pct: number; completed: number; at_risk: number };
  enrollments_by_day: Record<string, number>;
  lesson_funnel: { lesson_id: string; title: string; module_title: string; completed: number; completed_pct: number }[] | null;
}

export interface StudentRow extends StudentSummary {
  student_uid: string;
  name: string;
  course_id: string;
  course_title: string;
  enrolled_at: string | null;
}

export interface TimelineEvent {
  type: 'enrolled' | 'lesson_completed' | 'course_completed' | string;
  at: string | null;
  title: string;
  detail?: string | null;
}

export interface StudentJourney {
  scope: 'course' | 'classroom';
  student: { uid: string; name: string };
  course: { id: string; title: string };
  enrolled_at: string | null;
  summary: StudentSummary;
  modules: { title: string; completed: number; total: number }[];
  timeline: TimelineEvent[];
  activity_days: Record<string, number>;
}

const params = (courseId: string) => (courseId === 'all' ? {} : { course_id: courseId });

export const getAnalyticsOverview = async (courseId: string) =>
  (await apiClient.get<AnalyticsOverview>('/api/educator/analytics/overview', { params: params(courseId) })).data;
export const getStudentRows = async (courseId: string) =>
  (await apiClient.get<StudentRow[]>('/api/educator/analytics/students', { params: params(courseId) })).data;
export const getStudentJourney = async (courseId: string, uid: string) =>
  (await apiClient.get<StudentJourney>(`/api/educator/analytics/courses/${courseId}/students/${encodeURIComponent(uid)}`)).data;

/** Backend datetimes are naive UTC ISO strings; mark them as UTC before parsing. */
export function parseUtc(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export function timeAgo(value: string | null | undefined): string {
  const date = parseUtc(value);
  if (!date) return '—';
  const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
  if (days === 0) return 'today';
  if (Math.abs(days) < 30) return rtf.format(days, 'day');
  return rtf.format(Math.round(days / 30), 'month');
}
