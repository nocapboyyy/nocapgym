import cors from '@fastify/cors';
import Fastify from 'fastify';
import { ZodError } from 'zod';
import { readConfig } from './config.js';
import { prisma as defaultPrisma } from './db.js';
import { registerAuth } from './auth/plugin.js';
import { registerExerciseRoutes } from './routes/exercises.js';
import { registerSessionRoutes } from './routes/sessions.js';
import { registerTemplateRoutes } from './routes/templates.js';
import { registerUserRoutes } from './routes/users.js';
import type { AppContext } from './types.js';
import { ApplicationError, mapPrismaError } from './errors.js';

export async function buildServer(overrides: Partial<AppContext> = {}) {
  const context: AppContext = {
    prisma: overrides.prisma ?? defaultPrisma,
    config: overrides.config ?? readConfig()
  };

  const app = Fastify({ logger: true });
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'x-telegram-init-data', 'x-dev-telegram-id', 'x-dev-first-name', 'x-dev-username']
  });
  await registerAuth(app, context);

  app.get('/api/health', async () => ({ ok: true }));
  app.get('/api/me', async (request) => ({
    user: request.user,
    isAdmin: request.isAdmin ?? false
  }));

  await registerExerciseRoutes(app, context);
  await registerTemplateRoutes(app, context);
  await registerSessionRoutes(app, context);
  await registerUserRoutes(app, context);

  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Некорректные данные',
        issues: error.issues
      });
    }

    if (error instanceof ApplicationError) {
      return reply.code(error.statusCode).send({ code: error.code, message: error.message });
    }

    const prismaError = mapPrismaError(error);
    if (prismaError) {
      request.log.warn({ err: error }, 'Handled database error');
      return reply.code(prismaError.statusCode).send({ code: prismaError.code, message: prismaError.message });
    }

    if (hasClientErrorStatus(error)) {
      const statusCode = error.statusCode;
      return reply.code(statusCode).send({
        code: statusCode === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
        message: statusCode === 404 ? 'Ресурс не найден' : 'Некорректный запрос'
      });
    }

    request.log.error({ err: error }, 'Unhandled request error');
    return reply.code(500).send({ code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера' });
  });

  return app;
}

function hasClientErrorStatus(error: unknown): error is { statusCode: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof error.statusCode === 'number' &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  );
}
