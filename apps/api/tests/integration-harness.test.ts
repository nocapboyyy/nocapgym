import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createIntegrationTestHarness,
  integrationAdminTelegramId,
  type IntegrationTestHarness
} from './helpers/integration.js';

describe('integration test harness', () => {
  let harness: IntegrationTestHarness;

  beforeEach(async () => {
    harness = await createIntegrationTestHarness();
  });

  afterEach(async () => {
    if (harness) await harness.close();
  });

  it('applies migrations and isolates personal data for two authenticated users', async () => {
    const exercise = await harness.prisma.exercise.create({
      data: {
        name: 'Жим лёжа',
        muscleGroup: 'chest',
        equipment: 'Штанга'
      }
    });

    const createResponse = await harness.app.inject({
      method: 'POST',
      url: '/api/templates',
      headers: harness.authHeaders('1001'),
      payload: {
        name: 'Грудь',
        notes: null,
        exercises: [
          {
            exerciseId: exercise.id,
            order: 0,
            sets: [{ type: 'working', targetWeightKg: 50, targetReps: 8, order: 0 }]
          }
        ]
      }
    });
    const otherUserResponse = await harness.app.inject({
      method: 'GET',
      url: '/api/templates',
      headers: harness.authHeaders('1002')
    });

    expect(createResponse.statusCode).toBe(201);
    expect(otherUserResponse.statusCode).toBe(200);
    expect(otherUserResponse.json()).toEqual([]);
    await expect(harness.prisma.user.count()).resolves.toBe(2);
  });

  it('keeps admin authorization enforced by the backend', async () => {
    const regularUserResponse = await harness.app.inject({
      method: 'GET',
      url: '/api/admin/exercises',
      headers: harness.authHeaders('1001')
    });
    const adminResponse = await harness.app.inject({
      method: 'GET',
      url: '/api/admin/exercises',
      headers: harness.authHeaders(integrationAdminTelegramId)
    });

    expect(regularUserResponse.statusCode).toBe(403);
    expect(adminResponse.statusCode).toBe(200);
    expect(adminResponse.json()).toEqual([]);
  });

  it('creates the indexes used by history, progress, and ordered relations', async () => {
    const indexes = await harness.prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT name FROM sqlite_master WHERE type = 'index'`
    );
    const names = indexes.map((index) => index.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'WorkoutTemplate_userId_updatedAt_idx',
        'WorkoutSession_userId_status_completedAt_idx',
        'WorkoutSession_templateId_idx',
        'SessionExercise_sessionId_order_idx',
        'SessionExercise_exerciseId_sessionId_idx',
        'SessionSet_sessionExerciseId_order_idx'
      ])
    );

    const queryPlan = await harness.prisma.$queryRawUnsafe<Array<{ detail: string }>>(
      `EXPLAIN QUERY PLAN
       SELECT * FROM "WorkoutSession"
       WHERE "userId" = ? AND "status" = 'completed'
       ORDER BY "completedAt" DESC`,
      'user-1'
    );
    expect(queryPlan.some((row) => row.detail.includes('WorkoutSession_userId_status_completedAt_idx'))).toBe(true);
  });
});

describe('session snapshot migration', () => {
  it('backfills the plan name for existing linked sessions', async () => {
    const harness = await createIntegrationTestHarness({
      beforeMigration: async (migrationName, prisma) => {
        if (migrationName !== '20260714190000_session_template_snapshot_and_indexes') return;

        await prisma.$executeRawUnsafe(
          `INSERT INTO "User" ("id", "telegramId", "gender", "createdAt", "updatedAt")
           VALUES ('legacy-user', '77', 'male', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        );
        await prisma.$executeRawUnsafe(
          `INSERT INTO "WorkoutTemplate" ("id", "userId", "name", "createdAt", "updatedAt")
           VALUES ('legacy-template', 'legacy-user', 'Старый план', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        );
        await prisma.$executeRawUnsafe(
          `INSERT INTO "WorkoutSession" ("id", "userId", "templateId", "startedAt", "completedAt", "status")
           VALUES ('legacy-session', 'legacy-user', 'legacy-template', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'completed')`
        );
      }
    });

    try {
      await expect(
        harness.prisma.workoutSession.findUniqueOrThrow({ where: { id: 'legacy-session' } })
      ).resolves.toMatchObject({ templateNameSnapshot: 'Старый план' });
    } finally {
      await harness.close();
    }
  });
});
