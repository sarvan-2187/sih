export type Role = 'learner' | 'educator' | 'researcher' | 'admin';

// Educators and researchers share educator features once their identity is verified.
export const STAFF_ROLES: Role[] = ['educator', 'researcher'];

export const isStaff = (role?: string | null) => role === 'educator' || role === 'researcher';

// Email signup signs the user out until they verify their email, so the role picked at signup
// must survive until their first login. Stored per browser; cleared once onboarding completes.
const SIGNUP_ROLE_KEY = 'qrious_signup_role';

export function rememberSignupRole(role: string) {
  try { localStorage.setItem(SIGNUP_ROLE_KEY, role); } catch { /* storage unavailable: fall back to login toggle */ }
}

export function clearSignupRole() {
  try { localStorage.removeItem(SIGNUP_ROLE_KEY); } catch { /* ignore */ }
}

/** Onboarding route for a signed-in user without a profile. A staff role picked at signup wins over `fallbackRole`. */
export function onboardingPath(fallbackRole?: string | null) {
  let stored: string | null = null;
  try { stored = localStorage.getItem(SIGNUP_ROLE_KEY); } catch { /* ignore */ }
  const role = isStaff(stored) ? stored : fallbackRole;
  return isStaff(role) ? `/onboarding/faculty?role=${role}` : '/onboarding/learner';
}
