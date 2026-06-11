import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../auth/plugin.js';
import { exercisePayloadSchema } from '../schemas.js';
import type { AppContext } from '../types.js';

export async function registerExerciseRoutes(app: FastifyInstance, context: AppContext) {
  app.get('/api/exercises', async () => {
    return context.prisma.exercise.findMany({
      where: { isHidden: false },
      orderBy: [{ muscleGroup: 'asc' }, { name: 'asc' }]
    });
  });

  app.get('/api/admin/exercises', { preHandler: requireAdmin }, async () => {
    return context.prisma.exercise.findMany({
      orderBy: [{ isHidden: 'asc' }, { muscleGroup: 'asc' }, { name: 'asc' }]
    });
  });

  app.post('/api/admin/exercises', { preHandler: requireAdmin }, async (request, reply) => {
    const payload = exercisePayloadSchema.parse(request.body);
    const exercise = await context.prisma.exercise.create({ data: payload });
    return reply.code(201).send(exercise);
  });

  app.patch<{ Params: { id: string } }>('/api/admin/exercises/:id', { preHandler: requireAdmin }, async (request) => {
    const payload = exercisePayloadSchema.partial().parse(request.body);
    return context.prisma.exercise.update({
      where: { id: request.params.id },
      data: payload
    });
  });
}

