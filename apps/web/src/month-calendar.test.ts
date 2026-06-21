import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from './types';
import {
  buildMonthCalendar,
  formatMonthYear,
  getAdjacentMonth,
  getHorizontalSwipeDelta
} from './month-calendar';

type HistoryItem = Pick<WorkoutSession, 'id' | 'startedAt' | 'status'>;

function historyItem(id: string, startedAt: Date | string, status: HistoryItem['status']): HistoryItem {
  return {
    id,
    startedAt: startedAt instanceof Date ? startedAt.toISOString() : startedAt,
    status
  };
}

describe('buildMonthCalendar', () => {
  it('builds a fixed six-week June 2026 grid from Monday to Sunday', () => {
    const days = buildMonthCalendar(new Date(2026, 5, 18), new Date(2026, 5, 21, 12), []);

    expect(days).toHaveLength(42);
    expect(days[0].dateKey).toBe('2026-06-01');
    expect(days[41].dateKey).toBe('2026-07-12');
    expect(days.slice(0, 7).map((day) => day.weekdayLabel)).toEqual([
      'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'
    ]);
    expect(days.filter((day) => day.isToday).map((day) => day.dateKey)).toEqual(['2026-06-21']);
    expect(days.filter((day) => day.isOutsideDisplayedMonth).map((day) => day.dateKey)).toEqual([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
      '2026-07-05',
      '2026-07-06',
      '2026-07-07',
      '2026-07-08',
      '2026-07-09',
      '2026-07-10',
      '2026-07-11',
      '2026-07-12'
    ]);
  });

  it('starts a Sunday month on the preceding Monday across month and year boundaries', () => {
    const days = buildMonthCalendar(new Date(2026, 10, 1), new Date(2026, 10, 15), []);

    expect(days[0].dateKey).toBe('2026-10-26');
    expect(days[41].dateKey).toBe('2026-12-06');
    expect(days.filter((day) => !day.isOutsideDisplayedMonth)).toHaveLength(30);
  });

  it('collapses duplicate completed sessions and ignores active and invalid sessions', () => {
    const history: HistoryItem[] = [
      historyItem('completed-morning', new Date(2026, 5, 21, 8), 'completed'),
      historyItem('completed-evening', new Date(2026, 5, 21, 20), 'completed'),
      historyItem('completed-other-day', new Date(2026, 5, 23, 9), 'completed'),
      historyItem('active', new Date(2026, 5, 22, 12), 'active'),
      historyItem('invalid', 'not-a-date', 'completed')
    ];

    const days = buildMonthCalendar(new Date(2026, 5, 1), new Date(2026, 5, 21), history);

    expect(days.filter((day) => day.hasWorkout).map((day) => day.dateKey)).toEqual([
      '2026-06-21',
      '2026-06-23'
    ]);
    expect(days.find((day) => day.dateKey === '2026-06-21')?.accessibleLabel).toContain('есть тренировка');
    expect(days.find((day) => day.dateKey === '2026-06-22')?.accessibleLabel).not.toContain('есть тренировка');
  });
});

describe('formatMonthYear', () => {
  it('formats a capitalized Russian month and year', () => {
    expect(formatMonthYear(new Date(2026, 5, 1))).toBe('Июнь 2026');
  });
});

describe('getAdjacentMonth', () => {
  it('returns the first day across January and December boundaries without date overflow', () => {
    expect(getAdjacentMonth(new Date(2026, 0, 31), -1)).toEqual(new Date(2025, 11, 1));
    expect(getAdjacentMonth(new Date(2026, 11, 31), 1)).toEqual(new Date(2027, 0, 1));
  });
});

describe('getHorizontalSwipeDelta', () => {
  it('returns the horizontal direction for decisive swipes', () => {
    expect(getHorizontalSwipeDelta({ startX: 100, startY: 50, endX: 55, endY: 55 })).toBe(1);
    expect(getHorizontalSwipeDelta({ startX: 55, startY: 50, endX: 100, endY: 45 })).toBe(-1);
  });

  it('ignores short and predominantly vertical gestures', () => {
    expect(getHorizontalSwipeDelta({ startX: 100, startY: 50, endX: 57, endY: 50 })).toBe(0);
    expect(getHorizontalSwipeDelta({ startX: 100, startY: 50, endX: 145, endY: 100 })).toBe(0);
  });
});
