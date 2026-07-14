import { describe, expect, it } from 'vitest';
import { buildExerciseProgress } from '../src/domain/progress.js';

describe('progress calculation', () => {
  it('uses only working completed sets and picks the best set per session', () => {
    const progress = buildExerciseProgress([
      {
        sessionId: 'session-1',
        completedAt: new Date('2026-06-01T10:00:00Z'),
        sets: [
          { type: 'warmup', actualWeightKg: 80, actualReps: 8, completed: true },
          { type: 'working', actualWeightKg: 100, actualReps: 5, completed: true },
          { type: 'working', actualWeightKg: 95, actualReps: 8, completed: true }
        ]
      },
      {
        sessionId: 'session-2',
        completedAt: new Date('2026-06-08T10:00:00Z'),
        sets: [
          { type: 'working', actualWeightKg: 105, actualReps: 4, completed: false },
          { type: 'working', actualWeightKg: 102.5, actualReps: 6, completed: true }
        ]
      }
    ]);

    expect(progress).toEqual([
      {
        sessionId: 'session-1',
        date: '2026-06-01',
        bestWeightKg: 100,
        bestReps: 5,
        sets: [
          { weightKg: 100, reps: 5 },
          { weightKg: 95, reps: 8 }
        ]
      },
      {
        sessionId: 'session-2',
        date: '2026-06-08',
        bestWeightKg: 102.5,
        bestReps: 6,
        sets: [{ weightKg: 102.5, reps: 6 }]
      }
    ]);
  });

  it('keeps separate stable identifiers for two sessions completed on the same day', () => {
    const progress = buildExerciseProgress([
      {
        sessionId: 'morning-session',
        completedAt: new Date('2026-06-01T08:00:00Z'),
        sets: [{ type: 'working', actualWeightKg: 50, actualReps: 10, completed: true }]
      },
      {
        sessionId: 'evening-session',
        completedAt: new Date('2026-06-01T18:00:00Z'),
        sets: [{ type: 'working', actualWeightKg: 55, actualReps: 8, completed: true }]
      }
    ]);

    expect(progress.map((point) => point.sessionId)).toEqual(['morning-session', 'evening-session']);
    expect(progress.map((point) => point.date)).toEqual(['2026-06-01', '2026-06-01']);
  });
});
