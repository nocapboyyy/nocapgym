import { afterEach, expect, it, vi } from 'vitest';
import { api } from './api';
import { ScreenData } from './screen-data';
import type { HistoryCard, WorkoutSession } from './types';
import { recordCompletion, recordDeletion, recordTemplate } from './workout-cache';

const storeWith = async (values: Record<string, unknown>) => {
  const store = new ScreenData();
  vi.spyOn(api, 'get').mockImplementation(async path => values[path]);
  for (const path of Object.keys(values)) await store.load(path);
  return store;
};
afterEach(() => vi.restoreAllMocks());

const first = '/api/history/page';
const second = first + '?cursor=boundary';
const calendar = '/api/history/calendar?from=2026-01-01&to=2026-01-08';
const startedAt = '2026-01-02T10:00:00.000Z';
const session: WorkoutSession = {
  id: 'z', startedAt, completedAt: startedAt, status: 'completed', templateId: null,
  templateNameSnapshot: 'План', exercises: []
};
const card: HistoryCard = { id: 'a', startedAt, completedAt: startedAt, exerciseNames: [], exerciseIds: ['squat'], planTitle: 'План' };
const options = '/api/progress/exercises';

it('leaves cold history for its first GET and adds one card to an already loaded empty page', async () => {
  const store = new ScreenData();
  recordCompletion(store, session);
  expect(store.read(first)).toBeUndefined();
  vi.spyOn(api, 'get').mockResolvedValue({ items: [], nextCursor: null });
  await store.load(first);
  recordCompletion(store, session);
  recordCompletion(store, session);
  expect(store.read(first)).toMatchObject({ data: { items: [{ id: 'z' }], nextCursor: null } });
});

it('preserves page boundaries, removes by ID, and keeps the other workout on the same day', async () => {
  const store = await storeWith({
    [first]: { items: [card], nextCursor: 'boundary' },
    [second]: { items: [{ ...card, id: 'older' }], nextCursor: null },
    [calendar]: { items: [{ id: card.id, startedAt }] },
    [options]: { items: [{ id: 'squat', name: 'Присед' }] },
    [options + '/squat']: [{ sessionId: card.id }]
  });
  recordCompletion(store, session);
  recordDeletion(store, card);
  recordDeletion(store, { ...card, id: 'older' });
  expect(store.read(first)).toMatchObject({ data: { items: [{ id: 'z' }], nextCursor: 'boundary' } });
  expect(store.read(second)).toMatchObject({ data: { items: [], nextCursor: null } });
  expect(store.read(calendar)).toMatchObject({ data: { items: [{ id: 'z', startedAt }] } });
  expect(store.read(options + '/squat')).toMatchObject({ data: [] });
  expect(store.read(options)).toBeUndefined();
  vi.mocked(api.get).mockRejectedValueOnce(Error()).mockResolvedValueOnce({ items: [] });
  await store.load(options);
  expect(store.read(options)?.state).toBe('error');
  store.retry(options);
  await store.load(options);
  expect(store.read(options)).toMatchObject({ data: { items: [] } });
});

it('updates template ordering and legacy titles while preserving snapshot titles', async () => {
  const plan = { id: 'p', name: 'Новое имя', notes: null, exercises: [], updatedAt: startedAt };
  const store = await storeWith({
    '/api/templates/summary': { items: [{ ...plan, id: 'later', updatedAt: '2027' }, { ...plan, name: 'Старое имя' }] },
    [first]: { items: [card, { ...card, id: 'legacy', titleTemplateId: 'p' }], nextCursor: null }
  });
  recordTemplate(store, 'p', plan);
  expect(store.read('/api/templates/summary')).toMatchObject({ data: { items: [{ id: 'later' }, { id: plan.id, name: plan.name, exercises: [] }] } });
  expect(store.read(first)).toMatchObject({ data: { items: [{ planTitle: 'План' }, { planTitle: plan.name }] } });
  recordTemplate(store, 'p');
  expect(store.read('/api/templates/summary')).toMatchObject({ data: { items: [{ id: 'later' }] } });
  expect(store.read(first)).toMatchObject({ data: { items: [{ planTitle: 'План' }, { planTitle: 'План не найден' }] } });
});

it('rejects an old page response after a confirmed deletion', async () => {
  const store = new ScreenData();
  let finish!: (value: unknown) => void;
  vi.spyOn(api, 'get').mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce({ items: [], nextCursor: null });
  const oldRequest = store.load(first);
  recordDeletion(store, card);
  await store.load(first);
  finish({ items: [card], nextCursor: null });
  await oldRequest;
  expect(store.read(first)).toMatchObject({ data: { items: [] } });
});
