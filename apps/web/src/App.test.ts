import { describe, expect, it, vi } from 'vitest';
import {
  appendExpandedExerciseDisclosureState,
  getBottomControlsHidden,
  getHistorySessionPlanTitle,
  getInitialExerciseDisclosureState,
  getKeyboardViewportState,
  getAppStartupState,
  getDragAutoScrollDelta,
  getPlansCalendarVisible,
  getProgressExercises,
  getSessionExerciseTitle,
  isSessionExerciseComplete,
  isKeyboardEditingElement,
  removeExerciseDisclosureState,
  reorderTemplateExercises,
  getSavedTemplateExercises,
  getNextTemplateSet,
  getPreviousUserTabAfterGenderChange,
  orchestrateGenderSave,
  toggleExerciseDisclosureState
} from './App';
import type { Exercise, SessionSet, WorkoutSession } from './types';

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

describe('getSessionExerciseTitle', () => {
  it('uses the currently selected catalog exercise before stale embedded data', () => {
    const oldExercise: Exercise = {
      id: 'bench', name: 'Жим лёжа', muscleGroup: 'Грудь', equipment: 'Штанга', techniqueNote: null, isHidden: false
    };
    const selectedExercise: Exercise = {
      id: 'squat', name: 'Присед', muscleGroup: 'Ноги', equipment: 'Штанга', techniqueNote: null, isHidden: false
    };

    expect(getSessionExerciseTitle({ exerciseId: 'squat', exercise: oldExercise }, [oldExercise, selectedExercise])).toBe('Присед');
  });
});

describe('getProgressExercises', () => {
  it('returns unique history exercises with completed working progress sorted by name', () => {
    const exercises: Record<string, Exercise> = {
      hidden: { id: 'hidden', name: 'Жим лёжа', muscleGroup: 'Грудь', equipment: 'Штанга', techniqueNote: null, isHidden: true },
      valid: { id: 'valid', name: 'Армейский жим', muscleGroup: 'Плечи', equipment: 'Гантели', techniqueNote: null, isHidden: false },
      warmup: { id: 'warmup', name: 'Разминка', muscleGroup: 'Ноги', equipment: 'Штанга', techniqueNote: null, isHidden: false },
      incomplete: { id: 'incomplete', name: 'Незавершённое', muscleGroup: 'Спина', equipment: 'Блок', techniqueNote: null, isHidden: false },
      missingActualWeight: { id: 'missing-actual-weight', name: 'Без веса', muscleGroup: 'Руки', equipment: 'Гантели', techniqueNote: null, isHidden: false },
      missingActualReps: { id: 'missing-actual-reps', name: 'Без повторов', muscleGroup: 'Руки', equipment: 'Гантели', techniqueNote: null, isHidden: false }
    };
    const set = (patch: Partial<SessionSet>): SessionSet => ({
      type: 'working', plannedWeightKg: null, plannedReps: null,
      actualWeightKg: 50, actualReps: 8, completed: true, order: 0, ...patch
    });
    const history: WorkoutSession[] = [{
      id: 'session-1', templateId: null, startedAt: '2026-06-01T10:00:00Z',
      completedAt: '2026-06-01T11:00:00Z', status: 'completed',
      exercises: [
        { exerciseId: 'hidden', order: 0, exercise: exercises.hidden, sets: [set({})] },
        { exerciseId: 'valid', order: 1, exercise: exercises.valid, sets: [set({})] },
        { exerciseId: 'hidden', order: 2, exercise: exercises.hidden, sets: [set({ actualWeightKg: 55 })] },
        { exerciseId: 'warmup', order: 3, exercise: exercises.warmup, sets: [set({ type: 'warmup' })] },
        { exerciseId: 'incomplete', order: 4, exercise: exercises.incomplete, sets: [set({ completed: false })] },
        { exerciseId: 'missing-actual-weight', order: 5, exercise: exercises.missingActualWeight, sets: [set({ actualWeightKg: null })] },
        { exerciseId: 'missing-actual-reps', order: 6, exercise: exercises.missingActualReps, sets: [set({ actualReps: null })] },
        { exerciseId: 'missing-exercise', order: 7, sets: [set({})] }
      ]
    }];

    expect(getProgressExercises(history)).toEqual([exercises.valid, exercises.hidden]);
  });
});

describe('getKeyboardViewportState', () => {
  it('marks the keyboard as open when the visual viewport is significantly smaller', () => {
    const state = getKeyboardViewportState({
      windowInnerHeight: 812,
      visualViewportHeight: 470,
      visualViewportOffsetTop: 0
    });

    expect(state.isKeyboardOpen).toBe(true);
    expect(state.keyboardOffset).toBe(342);
  });

  it('does not mark small viewport differences as an open keyboard', () => {
    const state = getKeyboardViewportState({
      windowInnerHeight: 812,
      visualViewportHeight: 780,
      visualViewportOffsetTop: 0
    });

    expect(state.isKeyboardOpen).toBe(false);
  });
});

describe('getBottomControlsHidden', () => {
  it('hides bottom controls when an editable field is focused even without viewport offset', () => {
    expect(getBottomControlsHidden({ isKeyboardOpen: false, isEditableFocused: true })).toBe(true);
  });

  it('keeps bottom controls visible when there is no keyboard signal or focused editor', () => {
    expect(getBottomControlsHidden({ isKeyboardOpen: false, isEditableFocused: false })).toBe(false);
  });
});

describe('isKeyboardEditingElement', () => {
  it('excludes native selects while keeping keyboard editors', () => {
    expect(isKeyboardEditingElement({ tagName: 'INPUT', isContentEditable: false })).toBe(true);
    expect(isKeyboardEditingElement({ tagName: 'TEXTAREA', isContentEditable: false })).toBe(true);
    expect(isKeyboardEditingElement({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isKeyboardEditingElement({ tagName: 'SELECT', isContentEditable: false })).toBe(false);
  });
});

describe('getPlansCalendarVisible', () => {
  it('shows the plans calendar on the templates tab only', () => {
    expect(getPlansCalendarVisible('templates')).toBe(true);
    expect(getPlansCalendarVisible('session')).toBe(false);
    expect(getPlansCalendarVisible('history')).toBe(false);
    expect(getPlansCalendarVisible('cycle')).toBe(false);
    expect(getPlansCalendarVisible('admin')).toBe(false);
  });
});

describe('getPreviousUserTabAfterGenderChange', () => {
  it('normalizes a remembered cycle tab when gender changes to male', () => {
    expect(getPreviousUserTabAfterGenderChange('cycle', 'male')).toBe('templates');
  });

  it('preserves remembered tabs that remain available', () => {
    expect(getPreviousUserTabAfterGenderChange('history', 'male')).toBe('history');
    expect(getPreviousUserTabAfterGenderChange('cycle', 'female')).toBe('cycle');
  });
});

describe('getAppStartupState', () => {
  it('uses a retry state instead of the app shell when loading failed without a user', () => {
    expect(getAppStartupState({ loading: false, user: null, loadError: 'Ошибка' })).toBe('error');
  });

  it('distinguishes loading, onboarding, and ready states', () => {
    expect(getAppStartupState({ loading: true, user: null, loadError: null })).toBe('loading');
    expect(getAppStartupState({ loading: false, user: { gender: null }, loadError: null })).toBe('onboarding');
    expect(getAppStartupState({ loading: false, user: { gender: 'female' }, loadError: null })).toBe('ready');
  });
});

describe('orchestrateGenderSave', () => {
  const updatedUser = {
    id: 'user-1',
    telegramId: '123',
    firstName: 'Ирина',
    username: null,
    gender: 'female' as const
  };

  it('commits the PATCH result before loading initial workout data', async () => {
    const events: string[] = [];

    const result = await orchestrateGenderSave({
      gender: 'female',
      shouldLoadWorkoutData: true,
      patchUser: async () => updatedUser,
      commitUser: () => events.push('commit'),
      loadWorkoutData: async () => {
        events.push('load');
        throw new Error('load failed');
      }
    });

    expect(events).toEqual(['commit', 'load']);
    expect(result).toBe('data-load-error');
  });

  it('does not commit or load when PATCH fails', async () => {
    const commitUser = vi.fn();
    const loadWorkoutData = vi.fn();

    const result = await orchestrateGenderSave({
      gender: 'female',
      shouldLoadWorkoutData: true,
      patchUser: async () => { throw new Error('patch failed'); },
      commitUser,
      loadWorkoutData
    });

    expect(result).toBe('profile-update-error');
    expect(commitUser).not.toHaveBeenCalled();
    expect(loadWorkoutData).not.toHaveBeenCalled();
  });

  it('skips workout loading for an already configured profile', async () => {
    const commitUser = vi.fn();
    const loadWorkoutData = vi.fn();

    const result = await orchestrateGenderSave({
      gender: 'female',
      shouldLoadWorkoutData: false,
      patchUser: async () => updatedUser,
      commitUser,
      loadWorkoutData
    });

    expect(result).toBe('success');
    expect(commitUser).toHaveBeenCalledWith(updatedUser);
    expect(loadWorkoutData).not.toHaveBeenCalled();
  });
});

describe('getHistorySessionPlanTitle', () => {
  it('uses the completed session template name when available', () => {
    expect(getHistorySessionPlanTitle({ template: { id: 'template-1', name: 'Грудь и трицепс' } })).toBe('Грудь и трицепс');
  });

  it('falls back when the completed session has no template', () => {
    expect(getHistorySessionPlanTitle({ template: null })).toBe('План не найден');
  });
});

describe('getDragAutoScrollDelta', () => {
  it('scrolls up near the top edge and down near the bottom edge', () => {
    expect(getDragAutoScrollDelta({ pointerY: 112, containerTop: 100, containerBottom: 500 })).toBeLessThan(0);
    expect(getDragAutoScrollDelta({ pointerY: 488, containerTop: 100, containerBottom: 500 })).toBeGreaterThan(0);
  });

  it('does not scroll in the safe middle area', () => {
    expect(getDragAutoScrollDelta({ pointerY: 300, containerTop: 100, containerBottom: 500 })).toBe(0);
  });
});

describe('getNextTemplateSet', () => {
  it('copies values from the previous template set', () => {
    const nextSet = getNextTemplateSet([
      { type: 'working', targetWeightKg: 45, targetReps: 12, order: 0 }
    ]);

    expect(nextSet).toEqual({ type: 'working', targetWeightKg: 45, targetReps: 12, order: 1 });
  });
});

describe('getSavedTemplateExercises', () => {
  it('replaces the edited exercise without changing its position', () => {
    const exercises = [
      {
        exerciseId: 'bench',
        order: 0,
        sets: [{ type: 'working' as const, targetWeightKg: 40, targetReps: 10, order: 0 }]
      },
      {
        exerciseId: 'squat',
        order: 1,
        sets: [{ type: 'working' as const, targetWeightKg: 60, targetReps: 8, order: 0 }]
      }
    ];

    const saved = getSavedTemplateExercises(exercises, {
      exerciseId: 'squat',
      order: 1,
      sets: [
        { type: 'working', targetWeightKg: 65, targetReps: 8, order: 0 },
        { type: 'working', targetWeightKg: 65, targetReps: 8, order: 1 }
      ]
    }, 1);

    expect(saved).toEqual([
      exercises[0],
      {
        exerciseId: 'squat',
        order: 1,
        sets: [
          { type: 'working', targetWeightKg: 65, targetReps: 8, order: 0 },
          { type: 'working', targetWeightKg: 65, targetReps: 8, order: 1 }
        ]
      }
    ]);
  });
});

describe('reorderTemplateExercises', () => {
  it('moves an exercise and recalculates order values', () => {
    const exercises = [
      {
        exerciseId: 'bench',
        order: 0,
        sets: [{ type: 'working' as const, targetWeightKg: 40, targetReps: 10, order: 0 }]
      },
      {
        exerciseId: 'squat',
        order: 1,
        sets: [{ type: 'working' as const, targetWeightKg: 60, targetReps: 8, order: 0 }]
      },
      {
        exerciseId: 'deadlift',
        order: 2,
        sets: [{ type: 'working' as const, targetWeightKg: 80, targetReps: 5, order: 0 }]
      }
    ];

    expect(reorderTemplateExercises(exercises, 0, 2)).toEqual([
      { ...exercises[1], order: 0 },
      { ...exercises[2], order: 1 },
      { ...exercises[0], order: 2 }
    ]);
  });
});
