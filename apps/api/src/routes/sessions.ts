import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildUserExportPayload } from '../domain/backup.js';
import { buildExerciseProgress } from '../domain/progress.js';
import { sessionPatchSchema } from '../schemas.js';
import type { AppContext } from '../types.js';

const sessionInclude = {
  exercises: {
    orderBy: { order: 'asc' as const },
    include: {
      exercise: true,
      sets: { orderBy: { order: 'asc' as const } }
    }
  },
  template: true
};

export async function registerSessionRoutes(app: FastifyInstance, context: AppContext) {
  app.post('/api/sessions/start', async (request, reply) => {
    const payload = z.object({ templateId: z.string() }).parse(request.body);
    const template = await context.prisma.workoutTemplate.findFirst({
      where: { id: payload.templateId, userId: request.user!.id },
      include: {
        exercises: {
          orderBy: { order: 'asc' },
          include: { sets: { orderBy: { order: 'asc' } } }
        }
      }
    });
    if (!template) return reply.code(404).send({ message: 'Template not found' });

    const session = await context.prisma.workoutSession.create({
      data: {
        userId: request.user!.id,
        templateId: template.id,
        exercises: {
          create: template.exercises.map((exercise) => ({
            exerciseId: exercise.exerciseId,
            order: exercise.order,
            sets: {
              create: exercise.sets.map((set) => ({
                type: set.type,
                plannedWeightKg: set.targetWeightKg,
                plannedReps: set.targetReps,
                actualWeightKg: set.targetWeightKg,
                actualReps: set.targetReps,
                completed: false,
                order: set.order
              }))
            }
          }))
        }
      },
      include: sessionInclude
    });
    return reply.code(201).send(session);
  });

  app.get<{ Params: { id: string } }>('/api/sessions/:id', async (request, reply) => {
    const session = await context.prisma.workoutSession.findFirst({
      where: { id: request.params.id, userId: request.user!.id },
      include: sessionInclude
    });
    if (!session) return reply.code(404).send({ message: 'Session not found' });
    return session;
  });

  app.patch<{ Params: { id: string } }>('/api/sessions/:id', async (request, reply) => {
    const payload = sessionPatchSchema.parse(request.body);
    const existing = await context.prisma.workoutSession.findFirst({
      where: { id: request.params.id, userId: request.user!.id }
    });
    if (!existing) return reply.code(404).send({ message: 'Session not found' });

    const session = await context.prisma.$transaction(async (tx) => {
      await tx.sessionExercise.deleteMany({ where: { sessionId: existing.id } });
      return tx.workoutSession.update({
        where: { id: existing.id },
        data: {
          exercises: {
            create: payload.exercises.map((exercise) => ({
              exerciseId: exercise.exerciseId,
              order: exercise.order,
              sets: { create: exercise.sets.map((set) => ({ ...set })) }
            }))
          }
        },
        include: sessionInclude
      });
    });
    return session;
  });

  app.post<{ Params: { id: string } }>('/api/sessions/:id/complete', async (request, reply) => {
    const existing = await context.prisma.workoutSession.findFirst({
      where: { id: request.params.id, userId: request.user!.id }
    });
    if (!existing) return reply.code(404).send({ message: 'Session not found' });

    return context.prisma.workoutSession.update({
      where: { id: existing.id },
      data: { status: 'completed', completedAt: new Date() },
      include: sessionInclude
    });
  });

  app.post<{ Params: { id: string } }>('/api/sessions/:id/apply-to-template', async (request, reply) => {
    const session = await context.prisma.workoutSession.findFirst({
      where: { id: request.params.id, userId: request.user!.id },
      include: sessionInclude
    });
    if (!session || !session.templateId) return reply.code(404).send({ message: 'Template session not found' });

    await context.prisma.$transaction(async (tx) => {
      await tx.templateExercise.deleteMany({ where: { templateId: session.templateId! } });
      await tx.workoutTemplate.update({
        where: { id: session.templateId! },
        data: {
          exercises: {
            create: session.exercises.map((exercise) => ({
              exerciseId: exercise.exerciseId,
              order: exercise.order,
              sets: {
                create: exercise.sets.map((set) => ({
                  type: set.type,
                  targetWeightKg: set.actualWeightKg ?? set.plannedWeightKg ?? 0,
                  targetReps: set.actualReps ?? set.plannedReps ?? 1,
                  order: set.order
                }))
              }
            }))
          }
        }
      });
    });

    return { ok: true };
  });

  app.get('/api/history', async (request) => {
    return context.prisma.workoutSession.findMany({
      where: { userId: request.user!.id, status: 'completed' },
      orderBy: { completedAt: 'desc' },
      include: sessionInclude
    });
  });

  app.get<{ Params: { exerciseId: string } }>('/api/progress/exercises/:exerciseId', async (request) => {
    const sessionExercises = await context.prisma.sessionExercise.findMany({
      where: {
        exerciseId: request.params.exerciseId,
        session: { userId: request.user!.id, status: 'completed', completedAt: { not: null } }
      },
      orderBy: { session: { completedAt: 'asc' } },
      include: {
        session: true,
        sets: { orderBy: { order: 'asc' } }
      }
    });

    return buildExerciseProgress(
      sessionExercises.map((exercise) => ({
        completedAt: exercise.session.completedAt!,
        sets: exercise.sets.map((set) => ({
          type: set.type,
          actualWeightKg: set.actualWeightKg,
          actualReps: set.actualReps,
          completed: set.completed
        }))
      }))
    );
  });

  app.get('/api/export', async (request) => {
    const [templates, sessions] = await Promise.all([
      context.prisma.workoutTemplate.findMany({
        where: { userId: request.user!.id },
        include: {
          exercises: { include: { sets: true } }
        }
      }),
      context.prisma.workoutSession.findMany({
        where: { userId: request.user!.id },
        include: {
          exercises: { include: { sets: true } }
        }
      })
    ]);

    return buildUserExportPayload({
      user: {
        telegramId: request.user!.telegramId,
        firstName: request.user!.firstName,
        username: request.user!.username
      },
      templates,
      sessions
    });
  });

  app.post('/api/import', async (request) => {
    const payload = z
      .object({
        version: z.literal(1),
        templates: z.array(z.any()).default([]),
        sessions: z.array(z.any()).default([])
      })
      .parse(request.body);

    await context.prisma.$transaction(async (tx) => {
      await tx.workoutTemplate.deleteMany({ where: { userId: request.user!.id } });
      await tx.workoutSession.deleteMany({ where: { userId: request.user!.id } });

      for (const template of payload.templates) {
        await tx.workoutTemplate.create({
          data: {
            name: template.name,
            notes: template.notes ?? null,
            userId: request.user!.id,
            exercises: {
              create: (template.exercises ?? []).map((exercise: any) => ({
                exerciseId: exercise.exerciseId,
                order: exercise.order,
                sets: {
                  create: (exercise.sets ?? []).map((set: any) => ({
                    type: set.type,
                    targetWeightKg: set.targetWeightKg,
                    targetReps: set.targetReps,
                    order: set.order
                  }))
                }
              }))
            }
          }
        });
      }

      for (const session of payload.sessions) {
        await tx.workoutSession.create({
          data: {
            userId: request.user!.id,
            startedAt: session.startedAt ? new Date(session.startedAt) : new Date(),
            completedAt: session.completedAt ? new Date(session.completedAt) : null,
            status: session.status === 'completed' ? 'completed' : 'active',
            exercises: {
              create: (session.exercises ?? []).map((exercise: any) => ({
                exerciseId: exercise.exerciseId,
                order: exercise.order,
                sets: {
                  create: (exercise.sets ?? []).map((set: any) => ({
                    type: set.type,
                    plannedWeightKg: set.plannedWeightKg ?? null,
                    plannedReps: set.plannedReps ?? null,
                    actualWeightKg: set.actualWeightKg ?? null,
                    actualReps: set.actualReps ?? null,
                    completed: Boolean(set.completed),
                    order: set.order
                  }))
                }
              }))
            }
          }
        });
      }
    });

    return { ok: true };
  });
}
