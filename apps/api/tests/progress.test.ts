import { describe, expect, it } from 'vitest';
import { buildExerciseProgress } from '../src/domain/progress.js';

describe('progress calculation', () => {
  it('uses only working completed sets and picks the best set per session', () => {
    const progress = buildExerciseProgress([
      {
        completedAt: new Date('2026-06-01T10:00:00Z'),
        sets: [
          { type: 'warmup', actualWeightKg: 80, actualReps: 8, completed: true },
          { type: 'working', actualWeightKg: 100, actualReps: 5, completed: true },
          { type: 'working', actualWeightKg: 95, actualReps: 8, completed: true }
        ]
      },
      {
        completedAt: new Date('2026-06-08T10:00:00Z'),
        sets: [
          { type: 'working', actualWeightKg: 105, actualReps: 4, completed: false },
          { type: 'working', actualWeightKg: 102.5, actualReps: 6, completed: true }
        ]
      }
    ]);

    expect(progress).toEqual([
      {
        date: '2026-06-01',
        bestWeightKg: 100,
        bestReps: 5,
        sets: [
          { weightKg: 100, reps: 5 },
          { weightKg: 95, reps: 8 }
        ]
      },
      {
        date: '2026-06-08',
        bestWeightKg: 102.5,
        bestReps: 6,
        sets: [{ weightKg: 102.5, reps: 6 }]
      }
    ]);
  });
});

