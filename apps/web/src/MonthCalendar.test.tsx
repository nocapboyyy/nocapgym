import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from './types';
import {
  getDisplayedMonthAfterCurrentChange,
  getDisplayedMonthAfterPointerUp,
  MonthCalendar
} from './MonthCalendar';

describe('getDisplayedMonthAfterCurrentChange', () => {
  it('follows a current-month rollover while the current month is displayed', () => {
    expect(
      getDisplayedMonthAfterCurrentChange(
        new Date(2026, 5, 1),
        new Date(2026, 5, 30),
        new Date(2026, 6, 1)
      )
    ).toEqual(new Date(2026, 6, 1));
  });

  it('preserves a deliberately browsed month across a current-month rollover', () => {
    expect(
      getDisplayedMonthAfterCurrentChange(
        new Date(2026, 3, 1),
        new Date(2026, 5, 30),
        new Date(2026, 6, 1)
      )
    ).toEqual(new Date(2026, 3, 1));
  });
});

describe('getDisplayedMonthAfterPointerUp', () => {
  it('moves one month in the swipe direction', () => {
    const june = new Date(2026, 5, 1);

    expect(
      getDisplayedMonthAfterPointerUp(june, { x: 100, y: 50 }, { x: 50, y: 52 })
    ).toEqual(new Date(2026, 6, 1));
    expect(
      getDisplayedMonthAfterPointerUp(june, { x: 50, y: 50 }, { x: 100, y: 48 })
    ).toEqual(new Date(2026, 4, 1));
  });

  it('preserves the month after vertical movement or a cancelled pointer', () => {
    const june = new Date(2026, 5, 1);

    expect(
      getDisplayedMonthAfterPointerUp(june, { x: 100, y: 50 }, { x: 145, y: 100 })
    ).toBe(june);
    expect(getDisplayedMonthAfterPointerUp(june, null, { x: 50, y: 50 })).toBe(june);
  });
});

describe('MonthCalendar', () => {
  it('renders a six-week month grid with navigation and accessible workout markers', () => {
    const history: WorkoutSession[] = [
      {
        id: 'completed-workout',
        templateId: null,
        startedAt: new Date(2026, 5, 18, 9).toISOString(),
        completedAt: new Date(2026, 5, 18, 10).toISOString(),
        status: 'completed',
        exercises: []
      }
    ];

    const markup = renderToStaticMarkup(
      <MonthCalendar history={history} now={new Date(2026, 5, 21, 12)} />
    );

    expect(markup).toContain('<h2>Июнь 2026</h2>');
    expect(markup).toContain('aria-label="Календарь тренировок за Июнь 2026"');
    expect(markup).toContain('aria-label="Предыдущий месяц"');
    expect(markup).toContain('aria-label="Следующий месяц"');
    expect(markup.match(/role="listitem"/g)).toHaveLength(42);
    expect(markup).toMatch(/class="(?=[^"]*month-calendar-day)(?=[^"]*today)[^"]*"/);
    expect(markup).toMatch(/class="(?=[^"]*month-calendar-day)(?=[^"]*outside-month)[^"]*"/);
    expect(markup).toMatch(
      /<div(?=[^>]*role="listitem")(?=[^>]*aria-label="[^"]*18 [^"]*есть тренировка")[^>]*>/
    );
    expect(markup).toMatch(
      /<span(?=[^>]*class="[^"]*month-calendar-workout[^"]*")(?=[^>]*aria-hidden="true")[^>]*>/
    );
    expect(markup).toMatch(
      /<span(?=[^>]*class="[^"]*month-calendar-workout-placeholder[^"]*")(?=[^>]*aria-hidden="true")[^>]*>/
    );
  });
});
