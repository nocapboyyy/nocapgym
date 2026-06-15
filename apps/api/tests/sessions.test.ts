import { describe, expect, it, vi } from 'vitest';
import { buildServer } from '../src/server.js';

describe('session routes', () => {
  it('deletes only the authenticated user session', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const app = await buildServer({
      config: {
        botToken: 'dev-token',
        adminTelegramIds: '',
        port: 4000,
        allowDevAuth: true
      },
      prisma: {
        user: {
          upsert: vi.fn().mockResolvedValue({
            id: 'user-1',
            telegramId: '1001',
            firstName: 'Dev',
            lastName: null,
            username: 'dev_user',
            createdAt: new Date(),
            updatedAt: new Date()
          })
        },
        workoutSession: { deleteMany }
      } as any
    });

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/sessions/session-1',
      headers: { 'x-dev-telegram-id': '1001' }
    });

    expect(response.statusCode).toBe(204);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: 'session-1', userId: 'user-1' }
    });

    await app.close();
  });
});
