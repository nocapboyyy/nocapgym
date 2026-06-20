import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from './types';
import { buildCurrentWeek, formatCurrentMonth } from './week-calendar';

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
