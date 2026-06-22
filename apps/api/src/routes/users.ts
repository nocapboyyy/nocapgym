import type { FastifyInstance } from 'fastify';
import { userGenderPayloadSchema } from '../schemas.js';
import type { AppContext } from '../types.js';

export async function registerUserRoutes(app: FastifyInstance, context: AppContext) {
  app.patch('/api/me', async (request) => {
    const payload = userGenderPayloadSchema.parse(request.body);
    return context.prisma.user.update({
      where: { id: request.user!.id },
      data: payload
    });
  });
}
