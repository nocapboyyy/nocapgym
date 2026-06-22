import { describe, expect, it, vi } from 'vitest';
import { buildServer } from '../src/server.js';

const config = {
  botToken: 'dev-token',
  adminTelegramIds: '',
  port: 4000,
  allowDevAuth: true
};

const authenticatedUser = {
  id: 'user-1',
  telegramId: '1001',
  firstName: 'Dev',
  lastName: null,
  username: 'dev_user',
  gender: null,
  createdAt: new Date('2026-06-22T00:00:00.000Z'),
  updatedAt: new Date('2026-06-22T00:00:00.000Z')
};

describe('user routes', () => {
  it.each(['male', 'female'] as const)('updates the authenticated user gender to %s', async (gender) => {
    const updatedUser = { ...authenticatedUser, gender };
    const update = vi.fn().mockResolvedValue(updatedUser);
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
      payload: { gender }
    });

    expect(response.statusCode).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { gender }
    });
    expect(response.json()).toEqual({
      ...updatedUser,
      createdAt: updatedUser.createdAt.toISOString(),
      updatedAt: updatedUser.updatedAt.toISOString()
    });

    await app.close();
  });

  it('rejects an invalid gender without updating the user', async () => {
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
    expect(update).not.toHaveBeenCalled();

    await app.close();
  });
});
