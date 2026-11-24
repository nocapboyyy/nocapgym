import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from './types';
import { getExerciseCountLabel, parseOptionalNumberInput } from './workout-fields';
import { getSessionCompletionValidationError } from './GymScreen';
import { getTemplateExerciseValidationError, getTemplateDraftValidationError } from './PlansScreen';

describe('getExerciseCountLabel', () => {
  it('uses Russian plural forms for exercise counts', () => {
    expect(getExerciseCountLabel(1)).toBe('1 упражнение');
    expect(getExerciseCountLabel(2)).toBe('2 упражнения');
    expect(getExerciseCountLabel(5)).toBe('5 упражнений');
  });
});

describe('numeric workout input validation', () => {
  it('represents an empty optional number as null instead of zero', () => {
    expect(parseOptionalNumberInput('')).toBeNull();
    expect(parseOptionalNumberInput('12')).toBe(12);
  });

  it('rejects empty or zero target reps before adding an exercise to a plan', () => {
    const exercise = {
      exerciseId: 'bench',
      order: 0,
      sets: [{ type: 'working' as const, targetWeightKg: 0, targetReps: null, order: 0 }]
    };

    expect(getTemplateExerciseValidationError(exercise)).toBe(
      'Количество повторений должно быть целым числом больше нуля.'
    );
    expect(getTemplateDraftValidationError({ name: 'Грудь', exercises: [exercise] })).toBe(
      'Количество повторений должно быть целым числом больше нуля.'
    );
  });

  it('allows null reps for incomplete sets but rejects them for completed sets', () => {
    const session: WorkoutSession = {
      id: 'session-1',
      templateId: null,
      templateNameSnapshot: null,
      startedAt: '2026-07-14T10:00:00Z',
      completedAt: null,
      status: 'active',
      exercises: [
        {
          exerciseId: 'bench',
          order: 0,
          sets: [
            {
              type: 'working',
              plannedWeightKg: null,
              plannedReps: null,
              actualWeightKg: null,
              actualReps: null,
              completed: false,
              order: 0
            }
          ]
        }
      ]
    };

    expect(getSessionCompletionValidationError(session)).toBeNull();
    session.exercises[0].sets[0].completed = true;
    expect(getSessionCompletionValidationError(session)).toBe(
      'Для каждого завершённого подхода укажите повторы больше нуля.'
    );
  });
});
