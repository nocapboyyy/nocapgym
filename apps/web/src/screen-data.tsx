import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react';
import { api } from './api';

type Entry = { state: 'loading' | 'error' } | { state: 'ready'; data: unknown };

export class ScreenData {
  private entries = new Map<string, Entry>();
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  read(path: string) { return this.entries.get(path); }

  private notify() { this.listeners.forEach(listener => listener()); }

  paths(prefix: string) {
    return [...this.entries.keys()].filter(path => path.startsWith(prefix));
  }

  // An in-flight snapshot may predate the mutation. Let the subscribed screen read it again.
  update<T>(path: string, transform: (current: T) => T) {
    const entry = this.entries.get(path);
    if (!entry) return;
    if (entry.state === 'ready') {
      const next = transform(entry.data as T);
      if (next === entry.data) return;
      this.entries.set(path, { state: 'ready', data: next });
    } else {
      this.entries.delete(path);
    }
    this.notify();
  }

  invalidate(prefix: string) {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) this.entries.delete(key);
    }
    this.notify();
  }

  retry(path: string) {
    this.entries.delete(path);
    this.notify();
  }

  async load(path: string) {
    if (this.entries.has(path)) return;
    const pending: Entry = { state: 'loading' };
    this.entries.set(path, pending);
    this.notify();
    let result: Entry;
    try {
      result = { state: 'ready', data: await api.get(path) };
    } catch {
      result = { state: 'error' };
    }
    if (this.entries.get(path) === pending) {
      this.entries.set(path, result);
      this.notify();
    }
  }
}

export const ScreenDataContext = createContext<ScreenData | null>(null);

export function useScreenData<T>(path?: string) {
  const store = useContext(ScreenDataContext);
  const snapshot = useCallback(() => path ? store?.read(path) : undefined, [store, path]);
  const entry = useSyncExternalStore(store?.subscribe ?? noopSubscribe, snapshot, snapshot);
  useEffect(() => {
    if (path && !entry && store) void store.load(path);
  }, [entry, path, store]);
  return {
    data: entry?.state === 'ready' ? entry.data as T : undefined,
    loading: Boolean(path && store && (!entry || entry.state === 'loading')),
    error: entry?.state === 'error',
    retry: () => { if (path) store?.retry(path); }
  };
}

function noopSubscribe() { return () => {}; }

export function ReadStatus({ resource, label }: {
  resource: { loading: boolean; error: boolean; retry: () => void }; label: string
}) {
  if (resource.error) return <p role="alert">Не удалось загрузить {label}. <button onClick={resource.retry}>Повторить</button></p>;
  return resource.loading ? <p role="status">Загружаем {label}…</p> : null;
}
