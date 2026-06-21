import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function cssRule(selector: string) {
  const source = readFileSync(resolve(__dirname, 'styles.css'), 'utf8');
  const rules = [...source.matchAll(/(?<selectors>[^{}]+)\{(?<body>[^{}]*)\}/g)];
  const matches = rules.filter((rule) =>
    rule.groups?.selectors
      .split(',')
      .map((candidate) => candidate.trim())
      .includes(selector)
  );
  return matches.map((rule) => rule.groups?.body ?? '').join('\n');
}

describe('finish-panel layout', () => {
  it('keeps workout finish controls in normal document flow', () => {
    const rule = cssRule('.finish-panel');

    expect(rule).not.toContain('position: sticky');
    expect(rule).not.toContain('bottom:');
  });

  it('hides only the bottom tabbar while editing fields', () => {
    const source = readFileSync(resolve(__dirname, 'styles.css'), 'utf8');

    expect(source).toContain('.app-shell.bottom-controls-hidden .tabbar');
    expect(source).not.toContain('.app-shell.bottom-controls-hidden .finish-panel');
  });
});

describe('active workout exercise disclosure', () => {
  it('uses the project palette for the completion indicator and a full touch target header', () => {
    const header = cssRule('.session-exercise-header');
    const indicator = cssRule('.exercise-complete-indicator');

    expect(header).toContain('min-height: 44px');
    expect(indicator).toContain('var(--powder-blush)');
    expect(indicator).not.toContain('green');
  });
});

describe('week calendar layout', () => {
  it('keeps all seven days in equal columns', () => {
    const rule = cssRule('.week-calendar-days');

    expect(rule).toContain('grid-template-columns: repeat(7, minmax(0, 1fr))');
  });

  it('highlights today with the powder blush background', () => {
    const rule = cssRule('.week-calendar-day.today');

    expect(rule).toContain('background: var(--powder-blush)');
  });

  it('uses the exact dark text color for today', () => {
    const rule = cssRule('.week-calendar-day.today');

    expect(rule).toContain('color: #140f0f');
  });

  it('uses the exact dark color for today workout marker', () => {
    const rule = cssRule('.week-calendar-day.today .week-calendar-workout');

    expect(rule).toContain('color: #140f0f');
  });

  it('softens days outside the current month', () => {
    const rule = cssRule('.week-calendar-day.outside-month');

    expect(rule).toContain('color: var(--muted)');
  });

  it('reserves equal space for workout markers and placeholders', () => {
    const selectors = ['.week-calendar-workout', '.week-calendar-workout-placeholder'];

    for (const selector of selectors) {
      const rule = cssRule(selector);

      expect(rule).toContain('display: flex');
      expect(rule).toContain('width: 16px');
      expect(rule).toContain('height: 16px');
    }
  });
});

describe('month calendar layout', () => {
  it('preserves vertical scrolling while handling horizontal month swipes', () => {
    const rule = cssRule('.month-calendar');
    const panelRule = cssRule('.month-calendar.panel');

    expect(rule).toContain('touch-action: pan-y');
    expect(rule).toContain('overflow: hidden');
    expect(panelRule).toContain('gap: 6px');
    expect(panelRule).toContain('padding: 10px');
  });

  it('uses accessible navigation targets and a centered compact title', () => {
    const navigation = cssRule('.month-calendar-navigation');
    const title = cssRule('.month-calendar-header h2');

    expect(navigation).toContain('min-width: 44px');
    expect(navigation).toContain('min-height: 44px');
    expect(title).toContain('font-size: 17px');
    expect(title).toContain('text-align: center');
  });

  it('keeps weekdays and days in seven equal columns and six stable rows', () => {
    const weekdays = cssRule('.month-calendar-weekdays');
    const days = cssRule('.month-calendar-days');

    expect(weekdays).toContain('grid-template-columns: repeat(7, minmax(0, 1fr))');
    expect(days).toContain('grid-template-columns: repeat(7, minmax(0, 1fr))');
    expect(days).toContain('grid-template-rows: repeat(6, 32px)');
  });

  it('uses compact workout dots from the project palette', () => {
    const workout = cssRule('.month-calendar-workout');
    const placeholder = cssRule('.month-calendar-workout-placeholder');

    for (const rule of [workout, placeholder]) {
      expect(rule).toContain('width: 4px');
      expect(rule).toContain('height: 4px');
    }
    expect(workout).toContain('background: var(--powder-petal)');
  });

  it('softens adjacent-month days and keeps today readable', () => {
    const outside = cssRule('.month-calendar-day.outside-month');
    const today = cssRule('.month-calendar-day.today');
    const todayWorkout = cssRule('.month-calendar-day.today .month-calendar-workout');

    expect(outside).toContain('color: var(--muted)');
    expect(today).toContain('background: var(--powder-blush)');
    expect(today).toContain('color: #140f0f');
    expect(todayWorkout).toContain('background: #140f0f');
  });
});
