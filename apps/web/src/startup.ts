import { api } from './api';
import type { User, WorkoutSession } from './types';

export function readActiveSession() {
  return api.get<WorkoutSession | null>('/api/sessions/active');
}

export async function readStartup() {
  const profile = await api.get<{ user: User; isAdmin: boolean }>('/api/me');
  const session = profile.user.gender === null ? null : await readActiveSession();
  return { ...profile, session };
}
