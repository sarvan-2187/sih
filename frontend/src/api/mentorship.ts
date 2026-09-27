import { apiClient } from '@/lib/apiClient';

export interface MentorCard {
  uid: string;
  full_name: string;
  institution?: string;
  designation?: string;
  department?: string;
  research_areas: string[];
  orcid?: string | null;
  email?: string;
}

export interface Mentorship {
  id: string;
  as: 'mentor' | 'mentee';
  counterpart: MentorCard;
  topic: string;
  message: string;
  status: 'pending' | 'accepted' | 'declined';
  response_note: string | null;
  created_at: string;
  responded_at: string | null;
}

export interface MentorshipMessage {
  id: string;
  sender_uid: string;
  body: string;
  created_at: string;
}

export const listMentors = async (q = '') => (await apiClient.get<MentorCard[]>('/api/mentors', { params: { q } })).data;
export const listMentorships = async () => (await apiClient.get<Mentorship[]>('/api/mentorships')).data;
export const requestMentorship = (mentor_uid: string, topic: string, message: string) =>
  apiClient.post('/api/mentorships', { mentor_uid, topic, message });
export const respondToMentorship = (id: string, accept: boolean, note = '') =>
  apiClient.post(`/api/mentorships/${id}/respond`, { accept, note });
export const listMessages = async (id: string) =>
  (await apiClient.get<MentorshipMessage[]>(`/api/mentorships/${id}/messages`)).data;
export const sendMessage = async (id: string, body: string) =>
  (await apiClient.post<MentorshipMessage>(`/api/mentorships/${id}/messages`, { body })).data;
