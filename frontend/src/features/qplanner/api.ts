import { apiClient } from '@/lib/apiClient';
import type {
  Drift,
  Envelope,
  Plan,
  PlanPreview,
  PlanRequest,
  Preset,
  SprintQuizOutcome,
  SprintQuizPaper,
} from './types/qplanner.types';

// Returns the whole { data, meta, error } envelope, like features/roadmap/api.ts,
// because that is what every /api/v1/* endpoint sends. Errors are thrown and caught
// in the page with apiErrorMessage.

export const fetchPresets = async (): Promise<Envelope<Preset[]>> =>
  (await apiClient.get<Envelope<Preset[]>>('/api/v1/qplanner/presets')).data;

/** Deterministic and cheap -- safe to call on every slider move. */
export const previewPlan = async (request: PlanRequest): Promise<Envelope<PlanPreview>> =>
  (await apiClient.post<Envelope<PlanPreview>>('/api/v1/qplanner/plan/preview', request)).data;

export const createPlan = async (request: PlanRequest): Promise<Envelope<Plan>> =>
  (await apiClient.post<Envelope<Plan>>('/api/v1/qplanner/plan', request)).data;

export const fetchPlan = async (): Promise<Envelope<Plan>> =>
  (await apiClient.get<Envelope<Plan>>('/api/v1/qplanner/plan')).data;

export const setTaskComplete = async (
  taskId: string,
  complete: boolean,
): Promise<Envelope<{ task_id: string; completed: boolean; drift: Drift }>> => {
  const action = complete ? 'complete' : 'uncomplete';
  return (
    await apiClient.post(`/api/v1/qplanner/plan/tasks/${encodeURIComponent(taskId)}/${action}`)
  ).data;
};

export const fetchSprintQuiz = async (index: number): Promise<Envelope<SprintQuizPaper>> =>
  (await apiClient.get<Envelope<SprintQuizPaper>>(`/api/v1/qplanner/plan/sprints/${index}/quiz`)).data;

export const submitSprintQuiz = async (
  index: number,
  answers: { question_id: string; selected: unknown; time_taken_s?: number }[],
): Promise<Envelope<SprintQuizOutcome>> =>
  (await apiClient.post<Envelope<SprintQuizOutcome>>(
    `/api/v1/qplanner/plan/sprints/${index}/quiz`,
    { answers },
  )).data;

/** Drift never reshuffles the plan on its own; this is the learner asking. */
export const replan = async (request?: PlanRequest): Promise<Envelope<Plan>> =>
  (await apiClient.post<Envelope<Plan>>('/api/v1/qplanner/plan/replan', request ?? null)).data;

export const archivePlan = async (): Promise<Envelope<{ archived: string }>> =>
  (await apiClient.delete<Envelope<{ archived: string }>>('/api/v1/qplanner/plan')).data;
