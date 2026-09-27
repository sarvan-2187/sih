import { apiClient } from '@/lib/apiClient';

export type VerificationStatus = 'unsubmitted' | 'pending' | 'approved' | 'rejected';
export type Requirement = 'profile' | 'institutional_email' | 'id_check' | 'orcid' | 'orcid_or_proof';

export interface VerificationProfile {
  institution: string;
  designation: string;
  department: string;
  research_areas: string[];
  profile_url: string;
}

export interface Verification {
  role?: string;
  status: VerificationStatus;
  profile?: VerificationProfile;
  email_check?: { email: string; verified_at: string | null; code_sent: boolean };
  orcid?: { orcid: string; name: string; employments: { organization: string; role: string | null; current: boolean }[]; works_count: number };
  id_check?: { session_id: string; status: string; full_name?: string; checked_at?: string };
  has_proof?: boolean;
  name_match?: boolean | null;
  submitted_at?: string;
  reviewed_at?: string;
  rejection_reason?: string | null;
  missing: Requirement[];
}

/** Readable message from a FastAPI error (detail may be a string, an object, or a validation list). */
export function apiErrorMessage(err: any, fallback = 'Something went wrong'): string {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (detail?.message) return detail.message;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return fallback;
}

export const getMyVerification = async () => (await apiClient.get<Verification>('/api/verification/me')).data;
export const saveProfile = (profile: VerificationProfile) => apiClient.put('/api/verification/profile', profile);
export const sendEmailCode = (email: string) => apiClient.post('/api/verification/email/send', { email });
export const confirmEmailCode = (code: string) => apiClient.post('/api/verification/email/confirm', { code });
export const startOrcid = async () => (await apiClient.get<{ url: string }>('/api/verification/orcid/start')).data.url;
export const startIdCheck = async () => (await apiClient.post<{ url: string }>('/api/verification/didit/session')).data.url;
export const refreshIdCheck = async () => (await apiClient.post<Verification>('/api/verification/didit/refresh')).data;
export const submitVerification = () => apiClient.post('/api/verification/submit');

export async function uploadProof(file: File) {
  const { upload_url } = (await apiClient.post<{ upload_url: string }>('/api/verification/proof/upload-url')).data;
  const res = await fetch(upload_url, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: file });
  if (!res.ok) throw new Error('Upload failed');
  await apiClient.post('/api/verification/proof/confirm');
}

// ---------- admin ----------

export interface VerificationRequest {
  uid: string;
  email: string;
  full_name: string;
  role: 'educator' | 'researcher';
  verification: Verification;
  missing: Requirement[];
}

export const listVerificationRequests = async (status: VerificationStatus) =>
  (await apiClient.get<VerificationRequest[]>('/api/admin/verifications', { params: { status } })).data;
export const getProofUrl = async (uid: string) =>
  (await apiClient.get<{ url: string }>(`/api/admin/verifications/${uid}/proof`)).data.url;
export const decideVerification = (uid: string, decision: 'approve' | 'reject', reason = '') =>
  apiClient.post(`/api/admin/verifications/${uid}/decision`, { decision, reason });
