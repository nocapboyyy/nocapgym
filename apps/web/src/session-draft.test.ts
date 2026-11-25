import { expect, it, vi } from 'vitest';
import { completeWorkoutRequest } from './GymScreen';
import { SessionDraft } from './session-draft';
import type { WorkoutSession } from './types';

const session: WorkoutSession = {
  id: 'first', status: 'active', templateId: null, templateNameSnapshot: null, startedAt: '', completedAt: null,
  exercises: [{ exerciseId: 'press', order: 0, sets: [{ order: 0, type: 'working', plannedWeightKg: 40,
    actualWeightKg: 40, plannedReps: 8, actualReps: 8, completed: true }] }]
};

it('retains edited values across gym subscriptions and a same-ID restore until completion', async () => {
  const draft = new SessionDraft();
  draft.restore(session);
  const listener = vi.fn();
  const leaveGym = draft.subscribe(listener);
  const exercise = session.exercises[0];
  const edited = { ...session, exercises: [{ ...exercise, sets: [{ ...exercise.sets[0], actualWeightKg: 55 }] }] };
  draft.write(edited);
  leaveGym();
  draft.restore({ ...session });
  const returnToGym = draft.subscribe(listener);
  expect(draft.read()).toBe(edited);
  const post = vi.fn().mockResolvedValue({ ...edited, status: 'completed' });
  await completeWorkoutRequest({ session: draft.read()!, post, applyToTemplate: false });
  expect(post).toHaveBeenCalledWith('/api/sessions/first/complete', { applyToTemplate: false, exercises: edited.exercises });
  draft.restore(null);
  expect(draft.read()).toBeNull();
  expect(listener).toHaveBeenCalledTimes(2);
  returnToGym();
});

it('replaces the draft when a different session starts', () => {
  const draft = new SessionDraft();
  draft.restore(session);
  draft.write({ ...session, exercises: [] });
  const replacement = { ...session, id: 'second' };
  draft.restore(replacement);
  expect(draft.read()).toBe(replacement);
});
