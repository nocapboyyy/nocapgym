import { describe, expect, it } from 'vitest';
import { sessionSetSchema, templateSetSchema } from '../src/schemas.js';

const sessionSet = {
  type: 'working',
  plannedWeightKg: null,
  plannedReps: null,
  actualWeightKg: null,
  actualReps: null,
  completed: false,
  order: 0
};

describe('workout numeric validation', () => {
  it('allows empty actual reps for an incomplete set', () => {
    expect(sessionSetSchema.parse(sessionSet).actualReps).toBeNull();
  });

  it('requires positive actual reps for a completed set', () => {
    const result = sessionSetSchema.safeParse({ ...sessionSet, completed: true });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        path: ['actualReps'],
        message: 'Для завершённого подхода укажите количество повторений'
      });
    }
  });

  it('rejects zero target reps in a template', () => {
    expect(
      templateSetSchema.safeParse({ type: 'working', targetWeightKg: 0, targetReps: 0, order: 0 }).success
    ).toBe(false);
  });
});
