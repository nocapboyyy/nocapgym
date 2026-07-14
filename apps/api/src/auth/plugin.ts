import type { FastifyInstance } from 'fastify';
import { forbidden, unauthorized } from '../errors.js';
import {
  ExpiredTelegramInitDataError,
  getTelegramUserFromInitData,
  InvalidTelegramInitDataError,
  isAdminTelegramId
} from './telegram.js';
import type { AppContext } from '../types.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: import('@prisma/client').User;
    isAdmin?: boolean;
  }
}

export async function registerAuth(app: FastifyInstance, context: AppContext) {
  app.addHook('preHandler', async (request) => {
    if (!request.url.startsWith('/api') || request.url === '/api/health') {
      return;
    }

    let telegramUser;
    try {
      telegramUser = getTelegramUser(request, context);
    } catch (error) {
      if (error instanceof ExpiredTelegramInitDataError) {
        throw unauthorized(
          'TELEGRAM_AUTH_EXPIRED',
          'Сессия Telegram устарела. Закройте и снова откройте приложение'
        );
      }
      if (error instanceof InvalidTelegramInitDataError) {
        throw unauthorized('INVALID_TELEGRAM_AUTH', 'Недействительные данные авторизации Telegram');
      }
      throw error;
    }
    if (!telegramUser) {
      throw unauthorized('AUTH_REQUIRED', 'Требуется авторизация через Telegram');
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

export async function requireAdmin(request: import('fastify').FastifyRequest) {
  if (!request.isAdmin) {
    throw forbidden('Доступ разрешён только администраторам');
  }
}

function getTelegramUser(request: import('fastify').FastifyRequest, context: AppContext) {
  const initData = request.headers['x-telegram-init-data'];
  if (typeof initData === 'string' && initData.length > 0) {
    return getTelegramUserFromInitData(initData, context.config.botToken, {
      maxAgeSeconds: context.config.telegramInitDataMaxAgeSeconds,
      clockSkewSeconds: context.config.telegramInitDataClockSkewSeconds
    });
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
