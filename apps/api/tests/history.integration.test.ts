import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createIntegrationTestHarness, type IntegrationTestHarness } from './helpers/integration.js';

describe('compact history reads', () => {
  let h: IntegrationTestHarness;
  const day = new Date('2026-01-01T23:00:00Z');
  const next = new Date('2026-01-02T23:00:00Z');
  const get = (url: string, user = '1') => h.app.inject({ url, headers: h.authHeaders(user) });

  beforeEach(async () => {
    h = await createIntegrationTestHarness();
    for (const id of ['1', '2']) await h.prisma.user.create({ data: { id, telegramId: id } });
  });
  afterEach(async () => { await h.close(); });

  it('continues after deleted boundaries, including undated imported sessions', async () => {
    await h.prisma.workoutSession.createMany({ data: ['d', 'c', 'b', 'a', 'other'].map(id => ({
      id, userId: id === 'other' ? '2' : '1', status: 'completed', completedAt: ['a','b'].includes(id) ? null : day
    })) });
    let url = '/api/history/page?limit=1';
    for (const id of ['d', 'c', 'b', 'a']) {
      const response = await get(url);
      expect(response.statusCode).toBe(200);
      const { items, nextCursor } = response.json();
      expect(items).toEqual([{ id, startedAt: expect.any(String), completedAt: ['a','b'].includes(id) ? null : day.toISOString(), planTitle: 'План не найден', exerciseIds: [], exerciseNames: [] }]);
      await h.prisma.workoutSession.delete({ where: { id } });
      if (id === 'a') expect(nextCursor).toBeNull();
      url = '/api/history/page?limit=1&cursor=' + nextCursor;
    }
    expect((await get('/api/history/page')).json()).toEqual({ items: [], nextCursor: null });
  });

  it('selects calendar markers by local interval and options by qualifying personal sets', async () => {
    const calendar = '/api/history/calendar?from=' + day.toISOString() + '&to=' + next.toISOString();
    for (const [id, owner, startedAt, type, done] of [
      ['hidden', '1', day, 'working', true], ['warm', '1', next, 'warmup', true],
      ['unfinished', '1', next, 'working', false], ['foreign', '2', day, 'working', true]
    ] as const) {
      await h.prisma.exercise.create({ data: { id, name: id, equipment: '', isHidden: true } });
      await h.prisma.workoutSession.create({ data: {
        id, userId: owner, status: 'completed', startedAt, completedAt: next,
        templateNameSnapshot: 'Старый план',
        exercises: { create: { order: 0, exerciseId: id, sets: { create: {
          order: 0, type, completed: done, actualWeightKg: 0, actualReps: 3
        } } } }
      } });
    }
    expect((await get(calendar)).json()).toEqual({ items: [{ id: 'hidden', startedAt: day.toISOString() }] });
    expect((await get('/api/progress/exercises')).json()).toEqual({ items: [{ id: 'hidden', name: 'hidden' }] });
    expect((await get('/api/history/page')).json().items).toContainEqual(expect.objectContaining({
      id: 'hidden', planTitle: 'Старый план', exerciseNames: ['hidden']
    }));
  });

  it('keeps the snapshot after a plan rename or removal and falls back for legacy rows', async () => {
    const plan = await h.prisma.workoutTemplate.create({ data: { userId: '1', name: 'Первый' } });
    await h.prisma.workoutSession.createMany({ data: ['snapshot', 'legacy'].map(id => ({
      id, userId: '1', templateId: plan.id, status: 'completed', completedAt: day,
      templateNameSnapshot: id === 'snapshot' ? 'Первый' : null
    })) });
    await h.prisma.workoutTemplate.update({ where: { id: plan.id }, data: { name: 'Второй' } });
    const titles = async () => (await get('/api/history/page')).json().items.map(
      (item: { planTitle: string }) => item.planTitle
    );
    expect(await titles()).toEqual(['Первый', 'Второй']);
    await h.prisma.workoutTemplate.delete({ where: { id: plan.id } });
    expect(await titles()).toEqual(['Первый', 'План не найден']);
  });

  it('rejects malformed cursors, page sizes and date ranges', async () => {
    for (const path of ['page?cursor=bad', 'page?limit=51', 'page?limit=0', 'calendar?from=x',
      'calendar?from=2026-01-01T00:00:00Z&to=2027-01-01T00:00:00Z',
      'calendar?from=2026-01-01T00:00:00Z&to=2026-01-01T00:00:00Z']) {
      expect((await get('/api/history/' + path)).statusCode).toBe(400);
    }
  });
});
