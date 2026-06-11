import type { FastifyInstance } from 'fastify';
import { getTelegramUserFromInitData, isAdminTelegramId } from './telegram.js';
import type { AppContext } from '../types.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: import('@prisma/client').User;
    isAdmin?: boolean;
  }
}

export async function registerAuth(app: FastifyInstance, context: AppContext) {
  app.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/api') || request.url === '/api/health') {
      return;
    }

    const telegramUser = getTelegramUser(request, context);
    if (!telegramUser) {
      return reply.code(401).send({ message: 'Telegram authorization is required' });
    }

    const user = await context.prisma.user.upsert({
      where: { telegramId: String(telegramUser.id) },
      update: {
        firstName: telegramUser.first_name ?? null,
        lastName: telegramUser.last_name ?? null,
        username: telegramUser.username ?? null
      },
      create: {
        telegramId: String(telegramUser.id),
        firstName: telegramUser.first_name ?? null,
        lastName: telegramUser.last_name ?? null,
        username: telegramUser.username ?? null
      }
    });

    request.user = user;
    request.isAdmin = isAdminTelegramId(user.telegramId, context.config.adminTelegramIds);
  });
}

export async function requireAdmin(request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) {
  if (!request.isAdmin) {
    return reply.code(403).send({ message: 'Admin access is required' });
  }
}

function getTelegramUser(request: import('fastify').FastifyRequest, context: AppContext) {
  const initData = request.headers['x-telegram-init-data'];
  if (typeof initData === 'string' && initData.length > 0) {
    return getTelegramUserFromInitData(initData, context.config.botToken);
  }

  const devId = request.headers['x-dev-telegram-id'];
  if (context.config.allowDevAuth && typeof devId === 'string' && devId.length > 0) {
    return {
      id: Number(devId),
      first_name: request.headers['x-dev-first-name']?.toString() ?? 'Dev',
      username: request.headers['x-dev-username']?.toString() ?? 'dev'
    };
  }

  return null;
}

