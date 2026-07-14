import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorkoutSession, WorkoutTemplate } from '@prisma/client';
import { createIntegrationTestHarness, type IntegrationTestHarness } from './helpers/integration.js';

describe('session lifecycle integration', () => {
  let harness: IntegrationTestHarness;

  beforeEach(async () => {
    harness = await createIntegrationTestHarness();
  });

  afterEach(async () => {
    if (harness) await harness.close();
  });

  it('restores one active session and isolates it between users during concurrent starts', async () => {
    const template = await createTemplate(harness, '1001');

    const starts = await Promise.all([
      harness.app.inject({
        method: 'POST',
        url: '/api/sessions/start',
        headers: harness.authHeaders('1001'),
        payload: { templateId: template.id }
      }),
      harness.app.inject({
        method: 'POST',
        url: '/api/sessions/start',
        headers: harness.authHeaders('1001'),
        payload: { templateId: template.id }
      })
    ]);

    expect(starts.map((response) => response.statusCode).sort()).toEqual([200, 201]);
    expect(starts[0].json().id).toBe(starts[1].json().id);
    await expect(
      harness.prisma.workoutSession.count({ where: { userId: template.userId, status: 'active' } })
    ).resolves.toBe(1);

    const restored = await harness.app.inject({
      method: 'GET',
      url: '/api/sessions/active',
      headers: harness.authHeaders('1001')
    });
    const otherUser = await harness.app.inject({
      method: 'GET',
      url: '/api/sessions/active',
      headers: harness.authHeaders('1002')
    });

    expect(restored.statusCode).toBe(200);
    expect(restored.json().id).toBe(starts[0].json().id);
    expect(otherUser.statusCode).toBe(200);
    expect(otherUser.json()).toBeNull();
  });

  it('replaces an active workout when another plan is started without changing completed history', async () => {
    const firstTemplate = await createTemplate(harness, '1001');
    const firstSession = await startSession(harness, '1001', firstTemplate.id);
    const completion = await harness.app.inject({
      method: 'POST',
      url: `/api/sessions/${firstSession.id}/complete`,
      headers: harness.authHeaders('1001'),
      payload: { exercises: firstSession.exercises, applyToTemplate: false }
    });
    expect(completion.statusCode).toBe(200);

    const secondTemplate = await createTemplate(harness, '1001');
    const activeBeforeReplacement = await startSession(harness, '1001', firstTemplate.id);
    const replacement = await harness.app.inject({
      method: 'POST',
      url: '/api/sessions/start',
      headers: harness.authHeaders('1001'),
      payload: { templateId: secondTemplate.id }
    });

    expect(replacement.statusCode).toBe(201);
    expect(replacement.json()).toMatchObject({ templateId: secondTemplate.id, status: 'active' });
    expect(replacement.json().id).not.toBe(activeBeforeReplacement.id);
    await expect(
      harness.prisma.workoutSession.findUnique({ where: { id: activeBeforeReplacement.id } })
    ).resolves.toBeNull();
    await expect(
      harness.prisma.workoutSession.count({ where: { userId: firstTemplate.userId, status: 'active' } })
    ).resolves.toBe(1);
    await expect(
      harness.prisma.workoutSession.count({ where: { userId: firstTemplate.userId, status: 'completed' } })
    ).resolves.toBe(1);
  });

  it('keeps the current workout when the same plan is started again', async () => {
    const template = await createTemplate(harness, '1001');
    const started = await startSession(harness, '1001', template.id);

    const repeatedStart = await harness.app.inject({
      method: 'POST',
      url: '/api/sessions/start',
      headers: harness.authHeaders('1001'),
      payload: { templateId: template.id }
    });

    expect(repeatedStart.statusCode).toBe(200);
    expect(repeatedStart.json().id).toBe(started.id);
  });

  it('completes once, updates the owned template atomically, and rejects later edits', async () => {
    const template = await createTemplate(harness, '1001');
    const started = await startSession(harness, '1001', template.id);
    const exercises = started.exercises.map((exercise: any) => ({
      exerciseId: exercise.exerciseId,
      order: exercise.order,
      sets: exercise.sets.map((set: any) => ({
        type: set.type,
        plannedWeightKg: set.plannedWeightKg,
        plannedReps: set.plannedReps,
        actualWeightKg: 62.5,
        actualReps: 10,
        completed: true,
        order: set.order
      }))
    }));

    const firstCompletion = await harness.app.inject({
      method: 'POST',
      url: `/api/sessions/${started.id}/complete`,
      headers: harness.authHeaders('1001'),
      payload: { exercises, applyToTemplate: true }
    });

    expect(firstCompletion.statusCode).toBe(200);
    expect(firstCompletion.json()).toMatchObject({ status: 'completed' });
    const firstCompletedAt = firstCompletion.json().completedAt;
    const updatedTemplate = await harness.prisma.workoutTemplate.findUniqueOrThrow({
      where: { id: template.id },
      include: { exercises: { include: { sets: true } } }
    });
    expect(updatedTemplate.exercises[0].sets[0]).toMatchObject({ targetWeightKg: 62.5, targetReps: 10 });

    const repeatedCompletion = await harness.app.inject({
      method: 'POST',
      url: `/api/sessions/${started.id}/complete`,
      headers: harness.authHeaders('1001'),
      payload: { exercises: [], applyToTemplate: true }
    });
    const editCompleted = await harness.app.inject({
      method: 'PATCH',
      url: `/api/sessions/${started.id}`,
      headers: harness.authHeaders('1001'),
      payload: { exercises: [] }
    });

    expect(repeatedCompletion.statusCode).toBe(200);
    expect(repeatedCompletion.json().completedAt).toBe(firstCompletedAt);
    expect(editCompleted.statusCode).toBe(409);
    expect(editCompleted.json()).toEqual({
      code: 'CONFLICT',
      message: 'Завершённую тренировку нельзя изменить'
    });
  });

  it('rolls back the state transition when final session data cannot be saved', async () => {
    const template = await createTemplate(harness, '1001');
    const started = await startSession(harness, '1001', template.id);

    const response = await harness.app.inject({
      method: 'POST',
      url: `/api/sessions/${started.id}/complete`,
      headers: harness.authHeaders('1001'),
      payload: {
        exercises: [{ exerciseId: 'missing-exercise', order: 0, sets: [] }],
        applyToTemplate: true
      }
    });

    expect(response.statusCode).toBe(409);
    await expect(
      harness.prisma.workoutSession.findUniqueOrThrow({ where: { id: started.id } })
    ).resolves.toMatchObject({ status: 'active', completedAt: null });
    await expect(
      harness.prisma.sessionExercise.count({ where: { sessionId: started.id } })
    ).resolves.toBe(1);
  });

  it('cannot apply completion results to another user template', async () => {
    const ownTemplate = await createTemplate(harness, '1001');
    const otherTemplate = await createTemplate(harness, '1002');
    const started = await startSession(harness, '1001', ownTemplate.id);
    await harness.prisma.workoutSession.update({
      where: { id: started.id },
      data: { templateId: otherTemplate.id }
    });

    const response = await harness.app.inject({
      method: 'POST',
      url: `/api/sessions/${started.id}/complete`,
      headers: harness.authHeaders('1001'),
      payload: { exercises: started.exercises, applyToTemplate: true }
    });

    expect(response.statusCode).toBe(409);
    await expect(
      harness.prisma.workoutSession.findUniqueOrThrow({ where: { id: started.id } })
    ).resolves.toMatchObject({ status: 'active', completedAt: null });
  });

  it('keeps the historical plan name after the live template is renamed or deleted', async () => {
    const template = await createTemplate(harness, '1001');
    const started = await startSession(harness, '1001', template.id);
    expect(started.templateNameSnapshot).toBe('План 1001');

    const completed = await harness.app.inject({
      method: 'POST',
      url: `/api/sessions/${started.id}/complete`,
      headers: harness.authHeaders('1001'),
      payload: { exercises: started.exercises, applyToTemplate: false }
    });
    expect(completed.statusCode).toBe(200);

    await harness.prisma.workoutTemplate.update({
      where: { id: template.id },
      data: { name: 'Новое название' }
    });
    const renamedHistory = await harness.app.inject({
      method: 'GET',
      url: '/api/history',
      headers: harness.authHeaders('1001')
    });
    expect(renamedHistory.json()[0]).toMatchObject({
      templateNameSnapshot: 'План 1001',
      template: { name: 'Новое название' }
    });

    await harness.prisma.workoutTemplate.delete({ where: { id: template.id } });
    const deletedHistory = await harness.app.inject({
      method: 'GET',
      url: '/api/history',
      headers: harness.authHeaders('1001')
    });
    expect(deletedHistory.json()[0]).toMatchObject({
      templateId: null,
      templateNameSnapshot: 'План 1001',
      template: null
    });
  });
});

async function createTemplate(harness: IntegrationTestHarness, telegramId: string) {
  const exercise = await harness.prisma.exercise.create({
    data: { name: `Жим ${telegramId}`, muscleGroup: 'chest', equipment: 'Штанга' }
  });
  const response = await harness.app.inject({
    method: 'POST',
    url: '/api/templates',
    headers: harness.authHeaders(telegramId),
    payload: {
      name: `План ${telegramId}`,
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
  expect(response.statusCode).toBe(201);
  return response.json() as WorkoutTemplate;
}

async function startSession(harness: IntegrationTestHarness, telegramId: string, templateId: string) {
  const response = await harness.app.inject({
    method: 'POST',
    url: '/api/sessions/start',
    headers: harness.authHeaders(telegramId),
    payload: { templateId }
  });
  expect(response.statusCode).toBe(201);
  return response.json() as WorkoutSession & { exercises: any[] };
}
