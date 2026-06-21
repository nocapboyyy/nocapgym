import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from './types';
import { WeekCalendar } from './WeekCalendar';

describe('WeekCalendar', () => {
  it('renders the current week with month boundaries, today, and accessible workout markers', () => {
    const history: WorkoutSession[] = [
      {
        id: 'completed-monday',
        templateId: null,
        startedAt: new Date(2026, 5, 29, 9).toISOString(),
        completedAt: new Date(2026, 5, 29, 10).toISOString(),
        status: 'completed',
        exercises: []
      }
    ];

    const markup = renderToStaticMarkup(
      <WeekCalendar history={history} now={new Date(2026, 6, 1, 12)} />
    );

    expect(markup).toContain('aria-label="Текущая неделя"');
    expect(markup).toContain('<h2>Июль</h2>');
    expect(markup).toMatch(/class="(?=[^"]*week-calendar-day)(?=[^"]*outside-month)[^"]*"/);
    expect(markup).toMatch(/class="(?=[^"]*week-calendar-day)(?=[^"]*today)[^"]*"/);
    expect(markup).toMatch(
      /<span(?=[^>]*class="[^"]*week-calendar-workout[^"]*")(?=[^>]*role="img")(?=[^>]*aria-label="Тренировка: понедельник, 29 июня")[^>]*>/
    );
    expect(markup).toMatch(
      /<span(?=[^>]*class="[^"]*week-calendar-workout-placeholder[^"]*")(?=[^>]*aria-hidden="true")[^>]*>/
    );
  });
});
