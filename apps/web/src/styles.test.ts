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
