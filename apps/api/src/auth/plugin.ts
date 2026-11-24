import type { FastifyInstance } from 'fastify';
import { forbidden, isPrismaErrorCode, unauthorized } from '../errors.js';
import {
  ExpiredTelegramInitDataError,
  getTelegramUserFromInitData,
  InvalidTelegramInitDataError,
  isAdminTelegramId,
  type TelegramUser
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

    const user = await resolveUser(context.prisma, telegramUser);
    request.user = user;
    request.isAdmin = isAdminTelegramId(user.telegramId, context.config.adminTelegramIds);
  });
}

async function resolveUser(prisma: AppContext['prisma'], telegram: TelegramUser) {
  const where = { telegramId: String(telegram.id) };
  const profile = {
    firstName: telegram.first_name ?? null,
    lastName: telegram.last_name ?? null,
    username: telegram.username ?? null
  };

  let user = await prisma.user.findUnique({ where });
  if (!user) {
    try {
      return await prisma.user.create({ data: { ...where, ...profile } });
    } catch (error) {
      if (!isPrismaErrorCode(error, 'P2002')) throw error;
      // Another first request may have created this account after our read.
      user = await prisma.user.findUnique({ where });
      if (!user) throw error;
    }
  }

  if (user.firstName === profile.firstName && user.lastName === profile.lastName && user.username === profile.username) {
    return user;
  }
  return prisma.user.update({ where, data: profile });
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
