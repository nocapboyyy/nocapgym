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

describe('gym plan picker layout', () => {
  it('lets the plan picker list scroll vertically inside the modal', () => {
    const rule = cssRule('.dialog-body.session-plan-list');

    expect(rule).toContain('min-height: 0');
    expect(rule).toContain('overflow-y: auto');
    expect(rule).toContain('overscroll-behavior: contain');
    expect(rule).toContain('touch-action: pan-y');
    expect(rule).toContain('-webkit-overflow-scrolling: touch');
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

describe('mobile navigation layout', () => {
  it('distributes every visible tab across equal automatic columns above the safe area', () => {
    const rule = cssRule('.tabbar');

    expect(rule).toContain('grid-auto-flow: column');
    expect(rule).toContain('grid-auto-columns: minmax(0, 1fr)');
    expect(rule).toContain('env(safe-area-inset-bottom, 0px)');
    expect(rule).not.toContain('repeat(4');
  });

  it('keeps persistent labels below their icons without changing the tab footprint', () => {
    const rule = cssRule('.tabbar button');

    expect(rule).toContain('flex-direction: column');
    expect(rule).toContain('gap: 4px');
    expect(rule).toContain('min-height: 56px');
    expect(rule).toContain('font-size: 11px');
  });

  it('marks the active tab with color and a subtle background only', () => {
    const rule = cssRule('.tabbar button.active');

    expect(rule).toContain('color: var(--powder-petal)');
    expect(rule).toContain('background: rgba(255, 181, 167, 0.12)');
    expect(rule).not.toMatch(/(?:width|height|padding|font-size|font-weight|content)\s*:/);
  });
});

describe('personalization and profile layout', () => {
  it('provides a safe-area-aware centered onboarding card and large choices', () => {
    const onboarding = cssRule('.gender-onboarding');
    const card = cssRule('.gender-onboarding-card');
    const options = cssRule('.gender-options');
    const buttons = cssRule('.gender-options button');
    const error = cssRule('.form-error');

    expect(onboarding).toContain('min-height: 100dvh');
    expect(onboarding).toContain('env(safe-area-inset-top, 0px)');
    expect(onboarding).toContain('max(14px, env(safe-area-inset-left, 0px))');
    expect(onboarding).toContain('max(14px, env(safe-area-inset-right, 0px))');
    expect(onboarding).toContain('place-items: center');
    expect(card).toContain('width: min(');
    expect(options).toContain('display: grid');
    expect(buttons).toContain('min-height: 52px');
    expect(error).toContain('color: var(--danger)');
  });

  it('keeps the profile trigger and menu actions accessible', () => {
    const anchor = cssRule('.topbar > div:last-child');
    const profile = cssRule('.profile');
    const menu = cssRule('.profile-menu');
    const group = cssRule('.profile-gender-actions');
    const actions = cssRule('.profile-menu button');
    const selected = cssRule(".profile-menu-action[aria-pressed='true']");

    expect(anchor).toContain('position: relative');
    expect(profile).toContain('min-height: 44px');
    expect(profile).toContain('display: inline-flex');
    expect(menu).toContain('position: absolute');
    expect(menu).toContain('right: 0');
    expect(menu).toContain('width: min(210px,');
    expect(menu).toContain('display: grid');
    expect(group).toContain('display: grid');
    expect(actions).toContain('min-height: 44px');
    expect(selected).toContain('background: rgba(255, 181, 167, 0.12)');
  });

  it('centers the cycle placeholder', () => {
    const cycle = cssRule('.cycle-placeholder');

    expect(cycle).toContain('min-height:');
    expect(cycle).toContain('place-items: center');
  });
});
