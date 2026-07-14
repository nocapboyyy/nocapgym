export type SessionSetProgressInput = {
  type: 'warmup' | 'working';
  actualWeightKg: number | null;
  actualReps: number | null;
  completed: boolean;
};

export type SessionProgressInput = {
  sessionId: string;
  completedAt: Date;
  sets: SessionSetProgressInput[];
};

export type ExerciseProgressPoint = {
  sessionId: string;
  date: string;
  bestWeightKg: number;
  bestReps: number;
  sets: Array<{ weightKg: number; reps: number }>;
};

export function buildExerciseProgress(sessions: SessionProgressInput[]): ExerciseProgressPoint[] {
  return sessions
    .map((session) => {
      const workingSets = session.sets
        .filter(
          (set) =>
            set.type === 'working' &&
            set.completed &&
            set.actualWeightKg !== null &&
            set.actualReps !== null
        )
        .map((set) => ({ weightKg: set.actualWeightKg as number, reps: set.actualReps as number }));

      if (workingSets.length === 0) {
        return null;
      }

      const best = [...workingSets].sort((left, right) => {
        if (right.weightKg !== left.weightKg) return right.weightKg - left.weightKg;
        return right.reps - left.reps;
      })[0];

      return {
        sessionId: session.sessionId,
        date: session.completedAt.toISOString().slice(0, 10),
        bestWeightKg: best.weightKg,
        bestReps: best.reps,
        sets: workingSets
      };
    })
    .filter((point): point is ExerciseProgressPoint => point !== null);
}
