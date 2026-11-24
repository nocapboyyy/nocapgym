import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { ApplicationError } from '../errors.js';
import type { AppContext } from '../types.js';

const instant = z.string().datetime({ offset: true }).pipe(z.coerce.date());
const boundarySchema = z.object({ id: z.string().min(1), completedAt: instant.nullable() });
const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).regex(/^[A-Za-z0-9_-]+$/).optional()
});
const rangeQuery = z.object({ from: instant, to: instant }).refine(({ from, to }) =>
  to > from && to.getTime() - from.getTime() <= 43 * 86_400_000
);

function afterCursor(token: string): Prisma.WorkoutSessionWhereInput {
  let boundary;
  try {
    boundary = boundarySchema.parse(JSON.parse(Buffer.from(token, 'base64url').toString('utf8')));
  } catch {
    throw new ApplicationError(400, 'VALIDATION_ERROR', 'Некорректный курсор истории');
  }
  const { completedAt, id } = boundary;
  const sameDate = { completedAt, id: { lt: id } };
  if (!completedAt) return sameDate;
  return { OR: [sameDate, { completedAt: { lt: completedAt } }, { completedAt: null }] };
}

export async function registerHistoryRoutes(app: FastifyInstance, { prisma }: AppContext) {
  app.get('/api/history/page', async request => {
    const { cursor, limit } = pageQuery.parse(request.query);
    const rows = await prisma.workoutSession.findMany({
      where: { userId: request.user!.id, status: 'completed', ...(cursor && afterCursor(cursor)) },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true, startedAt: true, completedAt: true, templateNameSnapshot: true,
        template: { select: { id: true, name: true } },
        exercises: { orderBy: { order: 'asc' }, select: { exerciseId: true, exercise: { select: { name: true } } } }
      }
    });
    const items = rows.slice(0, limit).map(row => ({
      id: row.id, startedAt: row.startedAt, completedAt: row.completedAt,
      planTitle: row.templateNameSnapshot?.trim() || row.template?.name.trim() || 'План не найден',
      ...(row.template && !row.templateNameSnapshot?.trim() && { titleTemplateId: row.template.id }),
      exerciseIds: row.exercises.map(item => item.exerciseId),
      exerciseNames: row.exercises.map(item => item.exercise.name)
    }));
    let nextCursor: string | null = null;
    if (rows.length > limit) {
      const { id, completedAt } = items[limit - 1];
      nextCursor = Buffer.from(JSON.stringify({ id, completedAt })).toString('base64url');
    }
    return { items, nextCursor };
  });

  app.get('/api/history/calendar', async request => {
    const { from, to } = rangeQuery.parse(request.query);
    const items = await prisma.workoutSession.findMany({
      where: { userId: request.user!.id, status: 'completed', startedAt: { gte: from, lt: to } },
      select: { id: true, startedAt: true }
    });
    return { items };
  });

  app.get('/api/progress/exercises', async request => {
    const items = await prisma.exercise.findMany({
      where: { sessionExercises: { some: {
        session: { userId: request.user!.id, status: 'completed', completedAt: { not: null } },
        sets: { some: { type: 'working', completed: true, actualWeightKg: { not: null }, actualReps: { not: null } } }
      } } },
      select: { id: true, name: true }
    });
    return { items };
  });
}
