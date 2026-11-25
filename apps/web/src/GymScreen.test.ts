import { describe, expect, it, vi } from 'vitest';
import type { Exercise, SessionExercise, SessionSet, WorkoutSession } from './types';
import { isSessionExerciseComplete, getInitialExerciseDisclosureState, toggleExerciseDisclosureState, appendExpandedExerciseDisclosureState, removeExerciseDisclosureState, normalizeSessionExercises, getSessionExerciseTitle, completeWorkoutRequest } from './GymScreen';

describe('isSessionExerciseComplete', () => {
  const set = (completed: boolean): SessionSet => ({
    type: 'working',
    plannedWeightKg: null,
    plannedReps: null,
    actualWeightKg: 50,
    actualReps: 8,
    completed,
    order: 0
  });

  it('requires at least one set', () => {
    expect(isSessionExerciseComplete({ sets: [] })).toBe(false);
  });

  it('requires every existing set to be complete', () => {
    expect(isSessionExerciseComplete({ sets: [set(true), set(false)] })).toBe(false);
    expect(isSessionExerciseComplete({ sets: [set(true), set(true)] })).toBe(true);
  });
});

describe('active workout disclosure state', () => {
  it('opens only the first exercise initially', () => {
    expect(getInitialExerciseDisclosureState(3)).toEqual([true, false, false]);
    expect(getInitialExerciseDisclosureState(0)).toEqual([]);
  });

  it('toggles cards independently', () => {
    expect(toggleExerciseDisclosureState([true, false, true], 1)).toEqual([true, true, true]);
  });

  it('opens a newly appended exercise', () => {
    expect(appendExpandedExerciseDisclosureState([true, false])).toEqual([true, false, true]);
  });

  it('removes only the matching disclosure entry', () => {
    expect(removeExerciseDisclosureState([true, false, true], 1)).toEqual([true, true]);
  });
});

describe('normalizeSessionExercises', () => {
  it('closes order gaps after removing a session exercise', () => {
    const exercises: SessionExercise[] = [
      { exerciseId: 'bench', order: 0, sets: [] },
      { exerciseId: 'squat', order: 2, sets: [] }
    ];

    expect(normalizeSessionExercises(exercises).map((exercise) => exercise.order)).toEqual([0, 1]);
  });
});

describe('active workout API orchestration', () => {
  const activeSession: WorkoutSession = {
    id: 'session-1',
    templateId: 'template-1',
    templateNameSnapshot: 'План',
    startedAt: '2026-07-14T10:00:00.000Z',
    completedAt: null,
    status: 'active',
    exercises: []
  };

  it('completes and applies a workout with one atomic API request', async () => {
    const completed = { ...activeSession, status: 'completed' as const, completedAt: '2026-07-14T11:00:00.000Z' };
    const post = vi.fn().mockResolvedValue(completed);

    await expect(
      completeWorkoutRequest({ session: activeSession, applyToTemplate: true, post })
    ).resolves.toEqual(completed);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/api/sessions/session-1/complete', {
      exercises: [],
      applyToTemplate: true
    });
  });
});

describe('getSessionExerciseTitle', () => {
  it('uses the currently selected catalog exercise before stale embedded data', () => {
    const oldExercise: Exercise = {
      id: 'bench', name: 'Жим лёжа', muscleGroup: 'chest', equipment: 'Штанга', techniqueNote: null, isHidden: false
    };
    const selectedExercise: Exercise = {
      id: 'squat', name: 'Присед', muscleGroup: 'legs', equipment: 'Штанга', techniqueNote: null, isHidden: false
    };

    expect(getSessionExerciseTitle({ exerciseId: 'squat', exercise: oldExercise }, [oldExercise, selectedExercise])).toBe('Присед');
  });
});
