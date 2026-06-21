import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from './types';
import {
  buildCurrentWeek,
  formatCurrentMonth,
  millisecondsUntilNextLocalDay,
  startLiveDayRefresh,
  type LiveDayRefreshEnvironment
} from './week-calendar';

type HistoryItem = Pick<WorkoutSession, 'id' | 'startedAt' | 'status'>;

function historyItem(id: string, startedAt: Date | string, status: HistoryItem['status']): HistoryItem {
  return {
    id,
    startedAt: startedAt instanceof Date ? startedAt.toISOString() : startedAt,
    status
  };
}

describe('buildCurrentWeek', () => {
  it('builds the current Monday-to-Sunday week with Russian labels and today selected', () => {
    const days = buildCurrentWeek(new Date(2026, 5, 17, 12), []);

    expect(days.map((day) => day.dayNumber)).toEqual([15, 16, 17, 18, 19, 20, 21]);
    expect(days.map((day) => day.weekdayLabel)).toEqual(['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']);
    expect(days.map((day) => day.accessibleLabel)).toEqual([
      'понедельник, 15 июня',
      'вторник, 16 июня',
      'среда, 17 июня',
      'четверг, 18 июня',
      'пятница, 19 июня',
      'суббота, 20 июня',
      'воскресенье, 21 июня'
    ]);
    expect(days.filter((day) => day.isToday).map((day) => day.dayNumber)).toEqual([17]);
  });

  it('starts a Sunday current week on the preceding Monday', () => {
    const days = buildCurrentWeek(new Date(2026, 5, 21, 12), []);

    expect(days[0].date).toEqual(new Date(2026, 5, 15));
    expect(days[6].date).toEqual(new Date(2026, 5, 21));
    expect(days.filter((day) => day.isToday).map((day) => day.dayNumber)).toEqual([21]);
  });

  it('marks July days outside June before the month transition', () => {
    const days = buildCurrentWeek(new Date(2026, 5, 29, 12), []);

    expect(days.map((day) => day.dayNumber)).toEqual([29, 30, 1, 2, 3, 4, 5]);
    expect(days.map((day) => day.isOutsideCurrentMonth)).toEqual([false, false, true, true, true, true, true]);
  });

  it('marks June days outside July after the month transition', () => {
    const days = buildCurrentWeek(new Date(2026, 6, 1, 12), []);

    expect(days.map((day) => day.dayNumber)).toEqual([29, 30, 1, 2, 3, 4, 5]);
    expect(days.map((day) => day.dateKey)).toEqual([
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
      '2026-07-05'
    ]);
    expect(days.map((day) => day.isOutsideCurrentMonth)).toEqual([true, true, false, false, false, false, false]);
  });

  it('marks each local date with at least one completed valid session only once', () => {
    const history: HistoryItem[] = [
      historyItem('completed-1', new Date(2026, 5, 16, 9), 'completed'),
      historyItem('completed-2', new Date(2026, 5, 16, 21), 'completed'),
      historyItem('completed-3', new Date(2026, 5, 18, 1), 'completed'),
      historyItem('active', new Date(2026, 5, 17, 12), 'active'),
      historyItem('invalid', 'not-a-date', 'completed')
    ];

    const days = buildCurrentWeek(new Date(2026, 5, 17, 12), history);

    expect(days.filter((day) => day.hasWorkout).map((day) => day.dateKey)).toEqual(['2026-06-16', '2026-06-18']);
  });
});

describe('formatCurrentMonth', () => {
  it('formats the current month in Russian', () => {
    expect(formatCurrentMonth(new Date(2026, 6, 1, 12))).toBe('Июль');
  });
});

describe('millisecondsUntilNextLocalDay', () => {
  it('returns the remaining milliseconds before the next local day', () => {
    expect(millisecondsUntilNextLocalDay(new Date(2026, 6, 5, 23, 59, 59, 500))).toBe(500);
    expect(millisecondsUntilNextLocalDay(new Date(2026, 6, 5, 12))).toBe(12 * 60 * 60 * 1_000);
  });

  it('uses local calendar boundaries across daylight saving transitions', () => {
    const originalTimeZone = process.env.TZ;

    try {
      process.env.TZ = 'America/New_York';

      expect(millisecondsUntilNextLocalDay(new Date(2026, 2, 8))).toBe(23 * 60 * 60 * 1_000);
    } finally {
      if (originalTimeZone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTimeZone;
      }
    }
  });
});

describe('startLiveDayRefresh', () => {
  it('refreshes immediately and maintains one rescheduled timer until cleanup', () => {
    let current = new Date(2026, 6, 5, 12);
    let visible = true;
    let nextTimerId = 1;
    const timers = new Map<number, { callback: () => void; delay: number }>();
    const clearedTimerIds: number[] = [];
    let focusListener: (() => void) | undefined;
    let visibilityListener: (() => void) | undefined;
    const unsubscribed: string[] = [];
    const refreshedAt: Date[] = [];
    const environment: LiveDayRefreshEnvironment = {
      now: () => current,
      setTimeout: (callback, delay) => {
        const id = nextTimerId++;
        timers.set(id, { callback, delay });
        return id;
      },
      clearTimeout: (id) => {
        clearedTimerIds.push(id);
        timers.delete(id);
      },
      subscribeFocus: (listener) => {
        focusListener = listener;
      },
      unsubscribeFocus: (listener) => {
        expect(listener).toBe(focusListener);
        unsubscribed.push('focus');
      },
      subscribeVisibility: (listener) => {
        visibilityListener = listener;
      },
      unsubscribeVisibility: (listener) => {
        expect(listener).toBe(visibilityListener);
        unsubscribed.push('visibility');
      },
      isVisible: () => visible
    };

    const cleanup = startLiveDayRefresh((date) => refreshedAt.push(date), environment);

    expect(refreshedAt).toEqual([current]);
    expect([...timers.values()].map((timer) => timer.delay)).toEqual([12 * 60 * 60 * 1_000 + 50]);

    current = new Date(2026, 6, 5, 13);
    focusListener?.();
    expect(refreshedAt).toHaveLength(2);
    expect(clearedTimerIds).toEqual([1]);
    expect(timers.size).toBe(1);

    visible = false;
    visibilityListener?.();
    expect(refreshedAt).toHaveLength(2);
    expect(timers.size).toBe(1);

    visible = true;
    current = new Date(2026, 6, 5, 14);
    visibilityListener?.();
    expect(refreshedAt).toHaveLength(3);
    expect(clearedTimerIds).toEqual([1, 2]);
    expect(timers.size).toBe(1);

    current = new Date(2026, 6, 6, 0, 0, 0, 50);
    const [pendingTimerId, pendingTimer] = [...timers.entries()][0];
    timers.delete(pendingTimerId);
    pendingTimer.callback();
    expect(refreshedAt).toHaveLength(4);
    expect(refreshedAt.at(-1)).toEqual(current);
    expect(timers.size).toBe(1);

    cleanup();
    expect(clearedTimerIds).toEqual([1, 2, 4]);
    expect(timers.size).toBe(0);
    expect(unsubscribed).toEqual(['focus', 'visibility']);
  });
});
