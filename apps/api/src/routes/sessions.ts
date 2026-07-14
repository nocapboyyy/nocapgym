import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildUserExportPayload } from '../domain/backup.js';
import { buildExerciseProgress } from '../domain/progress.js';
import { conflict, isPrismaErrorCode, notFound } from '../errors.js';
import { sessionCompleteSchema, sessionPatchSchema } from '../schemas.js';
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
  app.get('/api/sessions/active', async (request) => {
    return context.prisma.workoutSession.findFirst({
      where: { userId: request.user!.id, status: 'active' },
      include: sessionInclude
    });
  });

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
    if (!template) throw notFound('План не найден');

    const activeSession = await context.prisma.workoutSession.findFirst({
      where: { userId: request.user!.id, status: 'active' },
      include: sessionInclude
    });
    if (activeSession) return activeSession;

    try {
      const session = await context.prisma.workoutSession.create({
        data: {
          userId: request.user!.id,
          templateId: template.id,
          templateNameSnapshot: template.name,
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
    } catch (error) {
      if (isPrismaErrorCode(error, 'P2002')) {
        const concurrentSession = await context.prisma.workoutSession.findFirst({
          where: { userId: request.user!.id, status: 'active' },
          include: sessionInclude
        });
        if (concurrentSession) return concurrentSession;
      }
      throw error;
    }
  });

  app.get<{ Params: { id: string } }>('/api/sessions/:id', async (request) => {
    const session = await context.prisma.workoutSession.findFirst({
      where: { id: request.params.id, userId: request.user!.id },
      include: sessionInclude
    });
    if (!session) throw notFound('Тренировка не найдена');
    return session;
  });

  app.patch<{ Params: { id: string } }>('/api/sessions/:id', async (request) => {
    const payload = sessionPatchSchema.parse(request.body);
    const existing = await context.prisma.workoutSession.findFirst({
      where: { id: request.params.id, userId: request.user!.id }
    });
    if (!existing) throw notFound('Тренировка не найдена');
    if (existing.status !== 'active') throw conflict('Завершённую тренировку нельзя изменить');

    const session = await context.prisma.$transaction(async (tx) => {
      const activeSession = await tx.workoutSession.findFirst({
        where: { id: existing.id, userId: request.user!.id, status: 'active' }
      });
      if (!activeSession) throw conflict('Завершённую тренировку нельзя изменить');

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

  app.delete<{ Params: { id: string } }>('/api/sessions/:id', async (request, reply) => {
    await context.prisma.workoutSession.deleteMany({
      where: { id: request.params.id, userId: request.user!.id }
    });
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>('/api/sessions/:id/complete', async (request) => {
    const payload = sessionCompleteSchema.parse(request.body);

    return context.prisma.$transaction(async (tx) => {
      const transition = await tx.workoutSession.updateMany({
        where: { id: request.params.id, userId: request.user!.id, status: 'active' },
        data: { status: 'completed', completedAt: new Date() }
      });
      const existing = await tx.workoutSession.findFirst({
        where: { id: request.params.id, userId: request.user!.id },
        include: sessionInclude
      });
      if (!existing) throw notFound('Тренировка не найдена');
      if (transition.count === 0) return existing;

      await tx.sessionExercise.deleteMany({ where: { sessionId: existing.id } });
      const completed = await tx.workoutSession.update({
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

      if (payload.applyToTemplate) {
        if (!completed.templateId) throw conflict('У тренировки нет исходного плана');
        const ownedTemplate = await tx.workoutTemplate.findFirst({
          where: { id: completed.templateId, userId: request.user!.id }
        });
        if (!ownedTemplate) throw conflict('Исходный план тренировки недоступен');

        await tx.templateExercise.deleteMany({ where: { templateId: completed.templateId } });
        await tx.workoutTemplate.update({
          where: { id: completed.templateId },
          data: {
            exercises: {
              create: completed.exercises.map((exercise) => ({
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
      }

      return completed;
    });
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
        sessionId: exercise.session.id,
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
            templateNameSnapshot: session.templateNameSnapshot ?? null,
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
