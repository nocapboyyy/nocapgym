import { createHmac } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { buildServer } from '../src/server.js';

const config = {
  botToken: 'bot-token',
  adminTelegramIds: '9001',
  port: 4000,
  allowDevAuth: true,
  telegramInitDataMaxAgeSeconds: 86_400,
  telegramInitDataClockSkewSeconds: 60
};

const authenticatedUser = {
  id: 'user-1',
  telegramId: '1001',
  firstName: 'Dev',
  lastName: null,
  username: 'dev_user',
  gender: null,
  createdAt: new Date('2026-07-14T00:00:00.000Z'),
  updatedAt: new Date('2026-07-14T00:00:00.000Z')
};

function signInitData(params: Record<string, string>, botToken: string) {
  const dataCheckString = Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secret).update(dataCheckString).digest('hex');
  return new URLSearchParams({ ...params, hash }).toString();
}

describe('API error responses', () => {
  it('returns 401 for invalid Telegram init data', async () => {
    const app = await buildServer({
      config: { ...config, allowDevAuth: false },
      prisma: {} as any
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: {
        'x-telegram-init-data': new URLSearchParams({
          user: JSON.stringify({ id: 42 }),
          hash: 'invalid'
        }).toString()
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      code: 'INVALID_TELEGRAM_AUTH',
      message: 'Недействительные данные авторизации Telegram'
    });
    await app.close();
  });

  it('returns a distinct 401 code for expired Telegram init data', async () => {
    const app = await buildServer({
      config: { ...config, allowDevAuth: false },
      prisma: {} as any
    });
    const initData = signInitData(
      {
        auth_date: String(Math.floor(Date.now() / 1000) - 86_401),
        user: JSON.stringify({ id: 42 })
      },
      config.botToken
    );

    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { 'x-telegram-init-data': initData }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      code: 'TELEGRAM_AUTH_EXPIRED',
      message: 'Сессия Telegram устарела. Закройте и снова откройте приложение'
    });
    await app.close();
  });

  it('returns a typed 403 without relying on UI restrictions', async () => {
    const app = await buildServer({
      config,
      prisma: {
        user: { upsert: vi.fn().mockResolvedValue(authenticatedUser) }
      } as any
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/exercises',
      headers: { 'x-dev-telegram-id': '1001' }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      code: 'FORBIDDEN',
      message: 'Доступ разрешён только администраторам'
    });
    await app.close();
  });

  it('returns validation details with a stable public code', async () => {
    const update = vi.fn();
    const app = await buildServer({
      config,
      prisma: {
        user: {
          upsert: vi.fn().mockResolvedValue(authenticatedUser),
          update
        }
      } as any
    });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/me',
      headers: { 'x-dev-telegram-id': '1001' },
      payload: { gender: 'other' }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Некорректные данные',
      issues: [{ path: ['gender'] }]
    });
    expect(update).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns a typed 404 for an absent user-owned resource', async () => {
    const app = await buildServer({
      config,
      prisma: {
        user: { upsert: vi.fn().mockResolvedValue(authenticatedUser) },
        workoutSession: { findFirst: vi.fn().mockResolvedValue(null) }
      } as any
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions/missing',
      headers: { 'x-dev-telegram-id': '1001' }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: 'NOT_FOUND', message: 'Тренировка не найдена' });
    await app.close();
  });

  it('maps known Prisma conflicts without exposing database metadata', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed on SecretTable', {
      code: 'P2002',
      clientVersion: Prisma.prismaVersion.client,
      meta: { modelName: 'SecretTable', target: ['internalField'] }
    });
    const app = await buildServer({
      config,
      prisma: {
        user: { upsert: vi.fn().mockResolvedValue(authenticatedUser) },
        workoutTemplate: { create: vi.fn().mockRejectedValue(prismaError) }
      } as any
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/templates',
      headers: { 'x-dev-telegram-id': '1001' },
      payload: { name: 'План', notes: null, exercises: [] }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ code: 'CONFLICT', message: 'Конфликт данных' });
    expect(response.body).not.toContain('SecretTable');
    expect(response.body).not.toContain('internalField');
    await app.close();
  });

  it('logs unknown errors but returns only a generic 500 response', async () => {
    const app = await buildServer({
      config,
      prisma: {
        user: { upsert: vi.fn().mockRejectedValue(new Error('Secret schema and query details')) }
      } as any
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { 'x-dev-telegram-id': '1001' }
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Внутренняя ошибка сервера'
    });
    expect(response.body).not.toContain('Secret schema');
    await app.close();
  });
});
