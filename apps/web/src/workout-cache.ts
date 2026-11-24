import type { ScreenData } from './screen-data';
import type { CalendarMarker, PlanList, HistoryCard, HistoryPage, ProgressPoint, WorkoutSession, WorkoutTemplate } from './types';

const firstPage = '/api/history/page';
const options = '/api/progress/exercises';

function newestFirst(left: HistoryCard, right: HistoryCard) {
  const a = left.completedAt ?? '';
  const b = right.completedAt ?? '';
  if (a !== b) return a > b ? -1 : 1;
  return left.id === right.id ? 0 : left.id > right.id ? -1 : 1;
}

function updateCalendar(store: ScreenData, marker: CalendarMarker, add: boolean) {
  for (const path of store.paths('/api/history/calendar?')) {
    const range = new URLSearchParams(path.split('?')[1]);
    const start = Date.parse(marker.startedAt);
    if (start < Date.parse(range.get('from')!) || start >= Date.parse(range.get('to')!)) continue;
    store.update<{ items: CalendarMarker[] }>(path, current => {
      const items = current.items.filter(item => item.id !== marker.id);
      if (add) items.push({ id: marker.id, startedAt: marker.startedAt });
      return { items };
    });
  }
}

export function recordCompletion(store: ScreenData, session: WorkoutSession) {
  const card: HistoryCard = {
    id: session.id, startedAt: session.startedAt, completedAt: session.completedAt,
    planTitle: session.templateNameSnapshot?.trim() || session.template?.name.trim() || 'План не найден',
    titleTemplateId: session.templateNameSnapshot?.trim() ? undefined : session.template?.id,
    exerciseIds: session.exercises.map(item => item.exerciseId),
    exerciseNames: session.exercises.map(item => item.exercise?.name ?? 'Упражнение')
  };
  const pages = store.paths(firstPage);
  const existingPage = pages.find(path => {
    const entry = store.read(path);
    return entry?.state === 'ready' && (entry.data as HistoryPage).items.some(item => item.id === card.id);
  });
  for (const path of pages) {
    store.update<HistoryPage>(path, page => {
      const present = page.items.some(item => item.id === card.id);
      const oldest = page.items.at(-1);
      const belongsAtFront = !existingPage && path === firstPage && (!page.nextCursor || !oldest || newestFirst(card, oldest) <= 0);
      if (!present && !belongsAtFront) return page;
      const items = page.items.filter(item => item.id !== card.id);
      items.push(card);
      return { ...page, items: items.sort(newestFirst) };
    });
  }
  updateCalendar(store, card, true);
  const ids = new Set(session.exercises.filter(ex => ex.sets.some(set =>
    set.type === 'working' && set.completed && set.actualReps !== null && set.actualWeightKg !== null
  )).map(ex => ex.exerciseId));
  if (ids.size) store.retry(options);
  for (const id of ids) store.retry(options + '/' + encodeURIComponent(id));
}

export function recordDeletion(store: ScreenData, card: HistoryCard) {
  for (const path of store.paths(firstPage)) {
    store.update<HistoryPage>(path, page => page.items.some(item => item.id === card.id)
      ? { ...page, items: page.items.filter(item => item.id !== card.id) }
      : page);
  }
  updateCalendar(store, card, false);
  store.retry(options);
  for (const id of new Set(card.exerciseIds)) {
    const path = options + '/' + encodeURIComponent(id);
    store.update<ProgressPoint[]>(path, points => points.filter(point => point.sessionId !== card.id));
  }
}

export function recordTemplate(store: ScreenData, id: string, saved?: WorkoutTemplate) {
  store.update<PlanList>('/api/templates/summary', current => {
    const items = current.items.filter(plan => plan.id !== id);
    if (saved) items.unshift({
      id: saved.id, name: saved.name, updatedAt: saved.updatedAt ?? '',
      exercises: saved.exercises.map(row => ({ id: row.id!, name: row.exercise!.name }))
    });
    if (saved) items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { items };
  });
  store.retry('/api/templates/' + encodeURIComponent(id));
  for (const path of store.paths(firstPage)) {
    store.update<HistoryPage>(path, page => !page.items.some(card => card.titleTemplateId === id) ? page : ({
      ...page, items: page.items.map(card => card.titleTemplateId === id
        ? { ...card, planTitle: saved?.name.trim() || 'План не найден', titleTemplateId: saved?.id }
        : card)
    }));
  }
}
