import { apiClient } from '@/lib/apiClient';
import type { TimelineEvent } from './educatorAnalytics';

export interface TeacherClassroomItem {
  id: string; name: string; institution: string; status: 'active' | 'archived'; join_code: string; members: number; is_owner: boolean;
}
export interface StudentClassroomItem { id: string; name: string; institution: string; teacher: string; joined_at: string }
export type ClassroomList =
  | { as: 'teacher'; classrooms: TeacherClassroomItem[] }
  | { as: 'student'; classrooms: StudentClassroomItem[] };

export interface ClassroomDetail {
  id: string; name: string; description: string; institution: string; allowed_email_domains: string[];
  status: 'active' | 'archived'; join_code: string; join_link: string; is_owner: boolean;
  teachers: { uid: string; name: string; email: string; role: 'owner' | 'co-teacher' }[];
  pending_invites: string[];
}

export interface LearningSummary {
  xp_total: number; current_streak: number; longest_streak: number; quizzes_taken: number;
  avg_quiz_score: number | null; topics_completed: number; pre_score: number | null; post_score: number | null;
  improvement: number | null; last_active: string | null; at_risk: boolean;
}

export interface ClassroomAnalytics {
  kpis: { members: number; active_7d: number; avg_quiz_score: number | null; avg_improvement: number | null; topics_completed: number; at_risk: number };
  active_students_by_day: Record<string, number>;
  weak_topics: { topic_slug: string; title: string; avg_score: number; attempts: number }[];
  students: (LearningSummary & { student_uid: string; name: string; joined_at: string })[];
}

export interface ClassroomJourney {
  scope: 'classroom';
  student: { uid: string; name: string };
  classroom: { id: string; name: string };
  joined_at: string;
  summary: LearningSummary;
  courses: { title: string; completed: number; total: number }[];
  timeline: TimelineEvent[];
  activity_days: Record<string, number>;
}

export interface JoinPreview {
  name: string; description: string; institution: string; teacher: string; status: string; already_member: boolean;
  is_student: boolean; email_allowed: boolean; allowed_email_domains: string[];
  consent_version: string; shared: string[]; never_shared: string[];
}

export const listClassrooms = async () => (await apiClient.get<ClassroomList>('/api/classrooms')).data;
export const createClassroom = async (name: string, description: string) =>
  (await apiClient.post<{ id: string; join_code: string }>('/api/classrooms', { name, description })).data;
export const getClassroom = async (id: string) => (await apiClient.get<ClassroomDetail>(`/api/classrooms/${id}`)).data;
export const updateClassroom = (id: string, patch: { name?: string; status?: 'active' | 'archived'; rotate_code?: boolean }) =>
  apiClient.patch(`/api/classrooms/${id}`, patch);
export const addCoTeacher = (id: string, email: string) => apiClient.post(`/api/classrooms/${id}/co-teachers`, { email });
export const removeCoTeacher = (id: string, uid: string) => apiClient.delete(`/api/classrooms/${id}/co-teachers/${uid}`);
export const inviteStudents = async (id: string, emails: string[]) =>
  (await apiClient.post<{ invited: string[]; rejected: { email: string; reason: string }[] }>(`/api/classrooms/${id}/invites`, { emails })).data;
export const removeMember = (id: string, uid: string) => apiClient.delete(`/api/classrooms/${id}/members/${encodeURIComponent(uid)}`);
export const getClassroomAnalytics = async (id: string) => (await apiClient.get<ClassroomAnalytics>(`/api/classrooms/${id}/analytics`)).data;
export const getClassroomJourney = async (id: string, uid: string) =>
  (await apiClient.get<ClassroomJourney>(`/api/classrooms/${id}/students/${encodeURIComponent(uid)}/journey`)).data;
export const previewJoin = async (code: string) => (await apiClient.get<JoinPreview>(`/api/classrooms/join/${encodeURIComponent(code)}`)).data;
export const joinClassroom = async (code: string, consentVersion: string) =>
  (await apiClient.post<{ id: string; name: string }>('/api/classrooms/join', { code, consent: true, consent_version: consentVersion })).data;
export const leaveClassroom = (id: string) => apiClient.post(`/api/classrooms/${id}/leave`);
