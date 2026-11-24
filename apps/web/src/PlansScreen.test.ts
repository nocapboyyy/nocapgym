import { describe, expect, it } from 'vitest';
import { getNextTemplateSet, getSavedTemplateExercises, reorderTemplateExercises, getDragAutoScrollDelta } from './PlansScreen';

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
