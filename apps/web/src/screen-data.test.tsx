import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HistoryPanel } from './HistoryPanel';
import { api } from './api';
import { calendarPath, calendarRange } from './calendar-range';
import { ScreenData, ScreenDataContext } from './screen-data';
import { readStartup } from './startup';

afterEach(() => { vi.restoreAllMocks(); });

describe('screen requests', () => {
  it.each([
    [null, false, null], ['male', false, null], ['female', true, null], ['male', false, { id: 'active' }]
  ] as const)('loads startup for gender %s and admin %s', async (gender, isAdmin, session) => {
    const get = vi.spyOn(api, 'get').mockResolvedValueOnce({ user: { gender }, isAdmin }).mockResolvedValueOnce(session);
    expect((await readStartup()).session).toEqual(session);
    expect(get.mock.calls.flat()).toEqual(gender ? ['/api/me', '/api/sessions/active'] : ['/api/me']);
  });

  it('requests the visible month, progress options and just the requested history pages', () => {
    const store = new ScreenData();
    const read = vi.spyOn(store, 'read');
    renderToStaticMarkup(<ScreenDataContext.Provider value={store}>
      <HistoryPanel cursors={['next']} selectedExerciseId="" onNext={() => {}} onSelectExercise={() => {}} onDeleteSession={() => {}} />
    </ScreenDataContext.Provider>);
    expect(new Set(read.mock.calls.flat())).toEqual(new Set([
      calendarPath(new Date(), 'month'), '/api/progress/exercises', '/api/history/page', '/api/history/page?cursor=next'
    ]));
  });

  it('reuses loaded pages, isolates accounts and ignores superseded reads', async () => {
    let finish!: (value: unknown) => void;
    const get = vi.spyOn(api, 'get')
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockResolvedValueOnce('new');
    const store = new ScreenData();
    const path = '/api/history/page';
    const first = store.load(path);
    await store.load(path);
    store.invalidate('/api/history/');
    await store.load(path);
    finish('old');
    await first;
    await store.load(path);
    expect(store.read(path)).toEqual({ state: 'ready', data: 'new' });
    expect(get).toHaveBeenCalledTimes(2);
    expect(new ScreenData().read(path)).toBeUndefined();
  });

  it('retries a failed range independently', async () => {
    const get = vi.spyOn(api, 'get').mockRejectedValueOnce(Error()).mockResolvedValueOnce([]);
    const store = new ScreenData();
    const path = calendarPath(new Date(), 'week');
    await store.load(path);
    expect(store.read(path)?.state).toBe('error');
    store.retry(path);
    await store.load(path);
    expect(store.read(path)?.state).toBe('ready');
    expect(get.mock.calls.flat()).toEqual([path, path]);
  });

  it('uses local midnight at both ends of week and six-week grid across a year boundary', () => {
    const date = new Date(2027, 0, 1, 23);
    expect(calendarRange(date, 'week')).toEqual({ start: new Date(2026, 11, 28), end: new Date(2027, 0, 4) });
    expect(calendarRange(date, 'month')).toEqual({ start: new Date(2026, 11, 28), end: new Date(2027, 1, 8) });
  });
});
