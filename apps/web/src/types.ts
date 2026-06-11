export type SetType = 'warmup' | 'working';

export type User = {
  id: string;
  telegramId: string;
  firstName: string | null;
  username: string | null;
};

export type Exercise = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  techniqueNote: string | null;
  isHidden: boolean;
};

export type TemplateSet = {
  id?: string;
  type: SetType;
  targetWeightKg: number;
  targetReps: number;
  order: number;
};

export type TemplateExercise = {
  id?: string;
  exerciseId: string;
  order: number;
  exercise?: Exercise;
  sets: TemplateSet[];
};

export type WorkoutTemplate = {
  id: string;
  name: string;
  notes: string | null;
  exercises: TemplateExercise[];
};

export type SessionSet = {
  id?: string;
  type: SetType;
  plannedWeightKg: number | null;
  plannedReps: number | null;
  actualWeightKg: number | null;
  actualReps: number | null;
  completed: boolean;
  order: number;
};

export type SessionExercise = {
  id?: string;
  exerciseId: string;
  order: number;
  exercise?: Exercise;
  sets: SessionSet[];
};

export type WorkoutSession = {
  id: string;
  templateId: string | null;
  startedAt: string;
  completedAt: string | null;
  status: 'active' | 'completed';
  exercises: SessionExercise[];
};

export type ProgressPoint = {
  date: string;
  bestWeightKg: number;
  bestReps: number;
  sets: Array<{ weightKg: number; reps: number }>;
};

