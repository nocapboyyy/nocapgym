import cors from '@fastify/cors';
import Fastify from 'fastify';
import { readConfig } from './config.js';
import { prisma as defaultPrisma } from './db.js';
import { registerAuth } from './auth/plugin.js';
import { registerExerciseRoutes } from './routes/exercises.js';
import { registerSessionRoutes } from './routes/sessions.js';
import { registerTemplateRoutes } from './routes/templates.js';
import type { AppContext } from './types.js';

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

  app.setErrorHandler((error: unknown, _request, reply) => {
    if (error && typeof error === 'object' && 'issues' in error) {
      return reply.code(400).send({ message: 'Validation error', issues: error.issues });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    app.log.error(error);
    return reply.code(500).send({ message });
  });

  return app;
}
