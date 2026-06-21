import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from './types';
import { MonthCalendar } from './MonthCalendar';

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
      /<span(?=[^>]*class="[^"]*month-calendar-workout[^"]*")(?=[^>]*role="img")(?=[^>]*aria-label="Тренировка: [^"]*18 [^"]*есть тренировка")[^>]*>/
    );
    expect(markup).toMatch(
      /<span(?=[^>]*class="[^"]*month-calendar-workout-placeholder[^"]*")(?=[^>]*aria-hidden="true")[^>]*>/
    );
  });
});
