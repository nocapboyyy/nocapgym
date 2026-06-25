import { describe, expect, it, vi } from 'vitest';
import { buildServer } from '../src/server.js';

const config = {
  botToken: 'dev-token',
  adminTelegramIds: '1001',
  port: 4000,
  allowDevAuth: true
};

const adminUser = {
  id: 'user-1',
  telegramId: '1001',
  firstName: 'Dev',
  lastName: null,
  username: 'dev_user',
  gender: null,
  createdAt: new Date('2026-06-22T00:00:00.000Z'),
  updatedAt: new Date('2026-06-22T00:00:00.000Z')
};

describe('exercise admin routes', () => {
  it('creates an exercise with a predefined muscle group', async () => {
    const exercise = {
      id: 'exercise-1',
      name: 'Жим лёжа',
      muscleGroup: 'chest',
      equipment: 'Штанга',
      techniqueNote: null,
      isHidden: false,
      createdAt: new Date('2026-06-25T00:00:00.000Z'),
      updatedAt: new Date('2026-06-25T00:00:00.000Z')
    };
    const create = vi.fn().mockResolvedValue(exercise);
    const app = await buildServer({
      config,
      prisma: {
        user: { upsert: vi.fn().mockResolvedValue(adminUser) },
        exercise: { create }
      } as any
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/exercises',
      headers: { 'x-dev-telegram-id': '1001' },
      payload: {
        name: 'Жим лёжа',
        muscleGroup: 'chest',
        equipment: 'Штанга',
        techniqueNote: null
      }
    });

    expect(response.statusCode).toBe(201);
    expect(create).toHaveBeenCalledWith({
      data: {
        name: 'Жим лёжа',
        muscleGroup: 'chest',
        equipment: 'Штанга',
        techniqueNote: null
      }
    });

    await app.close();
  });

  it('rejects a custom muscle group without creating an exercise', async () => {
    const create = vi.fn();
    const app = await buildServer({
      config,
      prisma: {
        user: { upsert: vi.fn().mockResolvedValue(adminUser) },
        exercise: { create }
      } as any
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/exercises',
      headers: { 'x-dev-telegram-id': '1001' },
      payload: {
        name: 'Авторская тяга',
        muscleGroup: 'custom',
        equipment: 'Блок',
        techniqueNote: null
      }
    });

    expect(response.statusCode).toBe(400);
    expect(create).not.toHaveBeenCalled();

    await app.close();
  });

  it('allows hide-only exercise updates without a muscle group', async () => {
    const exercise = {
      id: 'exercise-1',
      name: 'Жим лёжа',
      muscleGroup: null,
      equipment: 'Штанга',
      techniqueNote: null,
      isHidden: true,
      createdAt: new Date('2026-06-25T00:00:00.000Z'),
      updatedAt: new Date('2026-06-25T00:00:00.000Z')
    };
    const update = vi.fn().mockResolvedValue(exercise);
    const app = await buildServer({
      config,
      prisma: {
        user: { upsert: vi.fn().mockResolvedValue(adminUser) },
        exercise: { update }
      } as any
    });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/admin/exercises/exercise-1',
      headers: { 'x-dev-telegram-id': '1001' },
      payload: { isHidden: true }
    });

    expect(response.statusCode).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'exercise-1' },
      data: { isHidden: true }
    });

    await app.close();
  });
});
