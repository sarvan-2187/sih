import { apiClient } from '@/lib/apiClient';

/** Backend wraps every response as { data, meta, error } - see routers/qrating.py. */
interface Envelope<T, M = unknown> {
  data: T;
  meta: M | null;
  error: string | null;
}

export type Pillar = 'simulation' | 'algorithmic' | 'hardware';
export type RoundPhase = 'scheduled' | 'live' | 'ended' | 'finalized';
export type Verdict =
  | 'accepted'
  | 'wrong_answer'
  | 'constraint_violated'
  | 'runtime_error'
  | 'timeout'
  | 'invalid_submission';

export interface RoundSummary {
  id: string;
  round_number: number;
  title: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  task_count: number;
  phase: RoundPhase;
  season_id: string | null;
}

export interface RoundDetail extends RoundSummary {
  registered: boolean;
  seconds_until_start: number;
  seconds_remaining: number;
}

export interface TaskConstraints {
  num_qubits?: number;
  max_gates?: number;
  max_depth?: number;
  max_two_qubit_gates?: number;
  allowed_gates?: string[];
  min_fidelity?: number;
}

export interface RoundTask {
  slug: string;
  label: string;
  pillar: Pillar;
  title: string;
  points: number;
  statement_md: string;
  examples: { label: string; detail: string }[];
  constraints: TaskConstraints;
  entry_point?: string;
  /** Only present in the practice archive, never during a live round. */
  difficulty?: number;
}

export interface SubmissionResult {
  verdict: Verdict;
  score: number;
  detail: string;
  is_rated: boolean;
  attempt_no: number;
  elapsed_seconds: number;
  submission_id: string;
  fidelity?: number;
  ideal_fidelity?: number;
  depth?: number;
  two_qubit_gates?: number;
  tests_passed?: number;
  tests_total?: number;
}

export interface StandingsRow {
  firebase_uid: string;
  display_name: string;
  is_you: boolean;
  rank: number;
  score: number;
  penalty_seconds: number;
  per_task: {
    task_id: string;
    points: number;
    solved: boolean;
    solved_at: number | null;
    wrong_attempts: number;
  }[];
  rating_delta?: number;
  new_rating?: number;
}

export interface LedgerEntry {
  round_number: number;
  old_rating: number;
  new_rating: number;
  delta: number;
  rank: number;
  participants: number;
  score: number;
  mode: 'peer' | 'difficulty';
  at: string;
}

export interface MyRating {
  rating: number;
  rd: number;
  peak_rating: number;
  rounds_played: number;
  pillar_ratings: Partial<Record<Pillar, number>>;
  contest_streak: { current: number; longest: number; last_round_number: number | null };
  is_public: boolean;
  handle?: string | null;
  tier: string;
  colour: string;
  next_tier: string | null;
  next_tier_at: number | null;
  progress_pct: number;
  history: LedgerEntry[];
}

export interface LadderRung {
  tier: string;
  colour: string;
  from_rating: number;
  to_rating: number | null;
}

export interface LeaderboardRow {
  rank: number;
  firebase_uid: string;
  display_name: string;
  rating: number;
  rounds_played: number;
  is_you: boolean;
  tier: string;
  colour: string;
}

export interface PublicProfile {
  handle: string;
  display_name: string;
  rating: number;
  rd: number;
  peak_rating: number;
  rounds_played: number;
  pillar_ratings: Partial<Record<Pillar, number>>;
  tier: string;
  colour: string;
  ledger: LedgerEntry[];
}

export interface SubmissionPayload {
  task_slug: string;
  round_id?: string;
  gates?: Record<string, unknown>[];
  num_qubits?: number;
  qasm?: string;
  source_code?: string;
}

const BASE = '/api/v1/qrating';

export const listRounds = async () => {
  const { data } = await apiClient.get<
    Envelope<RoundSummary[], { total: number; next_round: RoundSummary | null; live_round: RoundSummary | null }>
  >(`${BASE}/rounds`);
  return data;
};

export const getRound = async (roundId: string) =>
  (await apiClient.get<Envelope<RoundDetail>>(`${BASE}/rounds/${roundId}`)).data.data;

export const registerForRound = async (roundId: string) =>
  (await apiClient.post<Envelope<{ registered: boolean; newly_registered: boolean }>>(
    `${BASE}/rounds/${roundId}/register`,
  )).data.data;

export const getRoundTasks = async (roundId: string) =>
  (await apiClient.get<Envelope<RoundTask[]>>(`${BASE}/rounds/${roundId}/tasks`)).data.data;

export const submitSolution = async (payload: SubmissionPayload) =>
  (await apiClient.post<Envelope<SubmissionResult>>(`${BASE}/submissions`, payload)).data.data;

export const getStandings = async (roundId: string) => {
  const { data } = await apiClient.get<
    Envelope<StandingsRow[], { phase: RoundPhase; total: number; your_row: StandingsRow | null }>
  >(`${BASE}/rounds/${roundId}/standings`);
  return data;
};

export const getMyRating = async () => {
  const { data } = await apiClient.get<Envelope<MyRating, { unrated: boolean; ladder: LadderRung[] }>>(
    `${BASE}/me`,
  );
  return data;
};

export const getLeaderboard = async (limit = 50) =>
  (await apiClient.get<Envelope<LeaderboardRow[]>>(`${BASE}/leaderboard`, { params: { limit } })).data.data;

export const getPublicProfile = async (handle: string) =>
  (await apiClient.get<Envelope<PublicProfile>>(`${BASE}/public/${handle}`)).data.data;

export const updateRatingSettings = async (body: { handle?: string; is_public?: boolean }) =>
  (await apiClient.patch<Envelope<MyRating>>(`${BASE}/me/settings`, body)).data.data;

export const getPracticeTasks = async () =>
  (await apiClient.get<Envelope<RoundTask[]>>(`${BASE}/tasks/practice`)).data.data;

export interface HardwareRun {
  status: 'queued' | 'running' | 'completed' | 'failed';
  device_id?: string;
  counts: Record<string, number> | null;
  error_message: string | null;
  hardware_verified: boolean;
  newly_unlocked_badges: { badge_id: string; title: string; description: string }[];
}

export interface QbraidDevice {
  id: string;
  name?: string;
  is_simulator: boolean;
  status: string;
}

/** Optional, and never part of the score - see routers/qrating.py. */
export const runOnHardware = async (submissionId: string, deviceId: string, shots = 1024) =>
  (await apiClient.post<Envelope<{ job_id: string; status: string; already_submitted: boolean }>>(
    `${BASE}/submissions/${submissionId}/hardware`,
    { device_id: deviceId, shots },
  )).data.data;

export const checkHardwareRun = async (submissionId: string) =>
  (await apiClient.get<Envelope<HardwareRun>>(`${BASE}/submissions/${submissionId}/hardware`)).data
    .data;

/** Device catalogue comes from the existing qBraid router, not from Q-Rating. */
export const listHardwareDevices = async () =>
  (await apiClient.get<QbraidDevice[]>('/api/v1/qbraid/devices')).data;
