import type { FastifyInstance } from 'fastify';
import { templatePayloadSchema } from '../schemas.js';
import type { AppContext } from '../types.js';

const templateInclude = {
  exercises: {
    orderBy: { order: 'asc' as const },
    include: {
      exercise: true,
      sets: { orderBy: { order: 'asc' as const } }
    }
  }
};

export async function registerTemplateRoutes(app: FastifyInstance, context: AppContext) {
  app.get('/api/templates', async (request) => {
    return context.prisma.workoutTemplate.findMany({
      where: { userId: request.user!.id },
      orderBy: { updatedAt: 'desc' },
      include: templateInclude
    });
  });

  app.get<{ Params: { id: string } }>('/api/templates/:id', async (request, reply) => {
    const template = await context.prisma.workoutTemplate.findFirst({
      where: { id: request.params.id, userId: request.user!.id },
      include: templateInclude
    });
    if (!template) return reply.code(404).send({ message: 'Template not found' });
    return template;
  });

  app.post('/api/templates', async (request, reply) => {
    const payload = templatePayloadSchema.parse(request.body);
    const template = await context.prisma.workoutTemplate.create({
      data: {
        userId: request.user!.id,
        name: payload.name,
        notes: payload.notes,
        exercises: {
          create: payload.exercises.map((exercise) => ({
            exerciseId: exercise.exerciseId,
            order: exercise.order,
            sets: { create: exercise.sets.map((set) => ({ ...set })) }
          }))
        }
      },
      include: templateInclude
    });
    return reply.code(201).send(template);
  });

  app.patch<{ Params: { id: string } }>('/api/templates/:id', async (request, reply) => {
    const payload = templatePayloadSchema.parse(request.body);
    const existing = await context.prisma.workoutTemplate.findFirst({
      where: { id: request.params.id, userId: request.user!.id }
    });
    if (!existing) return reply.code(404).send({ message: 'Template not found' });

    const updated = await context.prisma.$transaction(async (tx) => {
      await tx.templateExercise.deleteMany({ where: { templateId: existing.id } });
      return tx.workoutTemplate.update({
        where: { id: existing.id },
        data: {
          name: payload.name,
          notes: payload.notes,
          exercises: {
            create: payload.exercises.map((exercise) => ({
              exerciseId: exercise.exerciseId,
              order: exercise.order,
              sets: { create: exercise.sets.map((set) => ({ ...set })) }
            }))
          }
        },
        include: templateInclude
      });
    });

    return updated;
  });

  app.delete<{ Params: { id: string } }>('/api/templates/:id', async (request, reply) => {
    await context.prisma.workoutTemplate.deleteMany({
      where: { id: request.params.id, userId: request.user!.id }
    });
    return reply.code(204).send();
  });
}

