import { z } from 'zod';

export const setTypeSchema = z.enum(['warmup', 'working']);

export const templateSetSchema = z.object({
  id: z.string().optional(),
  type: setTypeSchema,
  targetWeightKg: z.coerce.number().nonnegative(),
  targetReps: z.coerce.number().int().positive(),
  order: z.coerce.number().int().nonnegative()
});

export const templateExerciseSchema = z.object({
  id: z.string().optional(),
  exerciseId: z.string(),
  order: z.coerce.number().int().nonnegative(),
  sets: z.array(templateSetSchema)
});

export const templatePayloadSchema = z.object({
  name: z.string().trim().min(1),
  notes: z.string().trim().optional().nullable(),
  exercises: z.array(templateExerciseSchema)
});

export const exercisePayloadSchema = z.object({
  name: z.string().trim().min(1),
  muscleGroup: z.string().trim().min(1),
  equipment: z.string().trim().min(1),
  techniqueNote: z.string().trim().optional().nullable(),
  isHidden: z.boolean().optional()
});

export const sessionSetSchema = z.object({
  id: z.string().optional(),
  type: setTypeSchema,
  plannedWeightKg: z.coerce.number().nonnegative().optional().nullable(),
  plannedReps: z.coerce.number().int().positive().optional().nullable(),
  actualWeightKg: z.coerce.number().nonnegative().optional().nullable(),
  actualReps: z.coerce.number().int().positive().optional().nullable(),
  completed: z.boolean().default(false),
  order: z.coerce.number().int().nonnegative()
});

export const sessionExerciseSchema = z.object({
  id: z.string().optional(),
  exerciseId: z.string(),
  order: z.coerce.number().int().nonnegative(),
  sets: z.array(sessionSetSchema)
});

export const sessionPatchSchema = z.object({
  exercises: z.array(sessionExerciseSchema)
});

