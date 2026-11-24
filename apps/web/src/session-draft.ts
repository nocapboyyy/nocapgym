import type { Exercise, WorkoutSession } from './types';

export class SessionDraft {
  private session: WorkoutSession | null = null;
  private listeners = new Set<() => void>();

  read = () => this.session;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  restore(session: WorkoutSession | null) {
    // Reopening the same workout must preserve locally edited sets.
    if (session?.id !== this.session?.id) this.write(session);
  }

  write = (session: WorkoutSession | null) => {
    this.session = session;
    this.listeners.forEach(listener => listener());
  };

  updateExercise(exercise: Exercise) {
    if (this.session) this.write({
      ...this.session,
      exercises: this.session.exercises.map(row => row.exerciseId === exercise.id ? { ...row, exercise } : row)
    });
  }
}
