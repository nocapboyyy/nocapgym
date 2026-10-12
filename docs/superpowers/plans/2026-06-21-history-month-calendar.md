# History Month Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact month calendar at the top of the History page that marks completed workout dates and switches months by horizontal swipe or accessible navigation buttons.

**Architecture:** Keep date-grid and gesture decisions in a pure `month-calendar.ts` module, and keep React state/pointer handling in a focused `MonthCalendar.tsx` component. Reuse the existing local-date and live-day-refresh helpers from `week-calendar.ts`, then mount the component as the first child of `HistoryPanel`; no API or data-model changes are required.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, CSS, Lucide React.

---

## File Map

- Create `apps/web/src/month-calendar.ts`: pure month grid, month navigation, Russian formatting, and horizontal swipe classification.
- Create `apps/web/src/month-calendar.test.ts`: date-grid, history marker, boundary, and gesture unit tests.
- Create `apps/web/src/MonthCalendar.tsx`: render the calendar and own displayed-month/pointer state.
- Create `apps/web/src/MonthCalendar.test.tsx`: server-rendered structure and accessibility tests.
- Modify `apps/web/src/week-calendar.ts`: export the existing local-date helper for reuse.
- Modify `apps/web/src/App.tsx`: place the calendar first inside `HistoryPanel`.
- Modify `apps/web/src/styles.css`: compact six-week layout, dot markers, controls, and gesture behavior.
- Modify `apps/web/src/styles.test.ts`: assert the layout and touch-action contract.
- Modify `docs/ai/current-state.md`: record the shipped calendar and remaining Telegram device check.

### Task 1: Pure month calendar model

**Files:**
- Modify: `apps/web/src/week-calendar.ts:36-42`
- Create: `apps/web/src/month-calendar.ts`
- Create: `apps/web/src/month-calendar.test.ts`

- [ ] **Step 1: Write failing tests for the 42-day month grid and workout markers**

Create `apps/web/src/month-calendar.test.ts` with focused fixtures and these assertions:

```ts
import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from './types';
import { buildMonthCalendar, formatMonthYear, getAdjacentMonth, getHorizontalSwipeDelta } from './month-calendar';

type HistoryItem = Pick<WorkoutSession, 'id' | 'startedAt' | 'status'>;

function historyItem(id: string, startedAt: Date | string, status: HistoryItem['status']): HistoryItem {
  return { id, startedAt: startedAt instanceof Date ? startedAt.toISOString() : startedAt, status };
}

describe('buildMonthCalendar', () => {
  it('builds six Monday-first weeks across month boundaries', () => {
    const days = buildMonthCalendar(new Date(2026, 5, 1), new Date(2026, 5, 21, 12), []);

    expect(days).toHaveLength(42);
    expect(days[0].dateKey).toBe('2026-06-01');
    expect(days[41].dateKey).toBe('2026-07-12');
    expect(days.map((day) => day.weekdayLabel).slice(0, 7)).toEqual(['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']);
    expect(days.filter((day) => day.isToday).map((day) => day.dateKey)).toEqual(['2026-06-21']);
    expect(days.filter((day) => day.isOutsideDisplayedMonth)[0]).toMatchObject({ dateKey: '2026-07-01' });
  });

  it('handles a month that begins on Sunday and crosses a year boundary', () => {
    const days = buildMonthCalendar(new Date(2026, 10, 1), new Date(2026, 10, 1), []);

    expect(days[0].dateKey).toBe('2026-10-26');
    expect(days[41].dateKey).toBe('2026-12-06');
  });

  it('marks completed valid local workout dates once', () => {
    const history: HistoryItem[] = [
      historyItem('morning', new Date(2026, 5, 2, 8), 'completed'),
      historyItem('evening', new Date(2026, 5, 2, 20), 'completed'),
      historyItem('active', new Date(2026, 5, 3, 8), 'active'),
      historyItem('invalid', 'not-a-date', 'completed')
    ];

    const days = buildMonthCalendar(new Date(2026, 5, 1), new Date(2026, 5, 21), history);

    expect(days.filter((day) => day.hasWorkout).map((day) => day.dateKey)).toEqual(['2026-06-02']);
  });
});

describe('month navigation', () => {
  it('formats Russian month and year and changes month without date overflow', () => {
    expect(formatMonthYear(new Date(2026, 5, 1))).toBe('Июнь 2026');
    expect(getAdjacentMonth(new Date(2026, 0, 31), -1)).toEqual(new Date(2025, 11, 1));
    expect(getAdjacentMonth(new Date(2026, 11, 31), 1)).toEqual(new Date(2027, 0, 1));
  });

  it('accepts only decisive horizontal swipes', () => {
    expect(getHorizontalSwipeDelta({ startX: 200, startY: 80, endX: 120, endY: 90 })).toBe(1);
    expect(getHorizontalSwipeDelta({ startX: 120, startY: 80, endX: 200, endY: 90 })).toBe(-1);
    expect(getHorizontalSwipeDelta({ startX: 120, startY: 80, endX: 145, endY: 82 })).toBe(0);
    expect(getHorizontalSwipeDelta({ startX: 120, startY: 80, endX: 170, endY: 150 })).toBe(0);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -w apps/web -- src/month-calendar.test.ts`

Expected: FAIL because `./month-calendar` does not exist.

- [ ] **Step 3: Export the existing local-date helper**

In `apps/web/src/week-calendar.ts`, change only the declaration:

```ts
export function toLocalDateKey(date: Date): string {
```

- [ ] **Step 4: Implement the pure month model**

Create `apps/web/src/month-calendar.ts`:

```ts
import type { WorkoutSession } from './types';
import { toLocalDateKey } from './week-calendar';

type HistoryItem = Pick<WorkoutSession, 'id' | 'startedAt' | 'status'>;

export type MonthCalendarDay = {
  date: Date;
  dateKey: string;
  dayNumber: number;
  weekdayLabel: string;
  accessibleLabel: string;
  isToday: boolean;
  isOutsideDisplayedMonth: boolean;
  hasWorkout: boolean;
};

type Swipe = { startX: number; startY: number; endX: number; endY: number };

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;
const monthYearFormatter = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });
const accessibleDateFormatter = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function formatMonthYear(date: Date): string {
  const label = monthYearFormatter.format(date);
  return label.charAt(0).toLocaleUpperCase('ru-RU') + label.slice(1);
}

export function getAdjacentMonth(date: Date, delta: -1 | 1): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function getHorizontalSwipeDelta(swipe: Swipe): -1 | 0 | 1 {
  const horizontal = swipe.endX - swipe.startX;
  const vertical = swipe.endY - swipe.startY;
  if (Math.abs(horizontal) < 44 || Math.abs(horizontal) <= Math.abs(vertical)) return 0;
  return horizontal < 0 ? 1 : -1;
}

export function buildMonthCalendar(displayedMonth: Date, todayInput: Date, history: HistoryItem[]): MonthCalendarDay[] {
  const monthStart = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), 1);
  const mondayOffset = (monthStart.getDay() + 6) % 7;
  const gridStart = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1 - mondayOffset);
  const today = new Date(todayInput.getFullYear(), todayInput.getMonth(), todayInput.getDate());
  const completedDates = new Set<string>();

  for (const session of history) {
    if (session.status !== 'completed') continue;
    const startedAt = new Date(session.startedAt);
    if (!Number.isNaN(startedAt.getTime())) completedDates.add(toLocalDateKey(startedAt));
  }

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    const dateKey = toLocalDateKey(date);
    return {
      date,
      dateKey,
      dayNumber: date.getDate(),
      weekdayLabel: WEEKDAY_LABELS[index % 7],
      accessibleLabel: accessibleDateFormatter.format(date),
      isToday: date.getTime() === today.getTime(),
      isOutsideDisplayedMonth: date.getMonth() !== monthStart.getMonth(),
      hasWorkout: completedDates.has(dateKey)
    };
  });
}
```

- [ ] **Step 5: Run model tests and typecheck**

Run: `npm test -w apps/web -- src/month-calendar.test.ts && npm run typecheck -w apps/web`

Expected: all month-calendar tests PASS; typecheck exits 0.

- [ ] **Step 6: Commit the model**

```bash
git add apps/web/src/week-calendar.ts apps/web/src/month-calendar.ts apps/web/src/month-calendar.test.ts
git commit -m "feat: add history month calendar model"
```

### Task 2: Interactive accessible React component

**Files:**
- Create: `apps/web/src/MonthCalendar.tsx`
- Create: `apps/web/src/MonthCalendar.test.tsx`

- [ ] **Step 1: Write the failing render test**

Create `apps/web/src/MonthCalendar.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from './types';
import { MonthCalendar } from './MonthCalendar';

describe('MonthCalendar', () => {
  it('renders a labelled month, 42 dates, controls, today, and workout dots', () => {
    const history: WorkoutSession[] = [{
      id: 'workout', templateId: null,
      startedAt: new Date(2026, 5, 2, 9).toISOString(),
      completedAt: new Date(2026, 5, 2, 10).toISOString(),
      status: 'completed', exercises: []
    }];

    const markup = renderToStaticMarkup(<MonthCalendar history={history} now={new Date(2026, 5, 21, 12)} />);

    expect(markup).toContain('aria-label="Календарь тренировок за Июнь 2026"');
    expect(markup).toContain('<h2>Июнь 2026</h2>');
    expect(markup).toContain('aria-label="Предыдущий месяц"');
    expect(markup).toContain('aria-label="Следующий месяц"');
    expect((markup.match(/role="listitem"/g) ?? [])).toHaveLength(42);
    expect(markup).toMatch(/class="(?=[^"]*month-calendar-day)(?=[^"]*today)[^"]*"/);
    expect(markup).toContain('aria-label="Тренировка: вторник, 2 июня 2026 г."');
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -w apps/web -- src/MonthCalendar.test.tsx`

Expected: FAIL because `./MonthCalendar` does not exist.

- [ ] **Step 3: Implement component state, controls, and pointer gesture**

Create `apps/web/src/MonthCalendar.tsx`. Use `ChevronLeft` and `ChevronRight`, initialize both `liveNow` and displayed month from `now ?? new Date()`, reuse `startLiveDayRefresh`, and keep the pointer origin in a ref:

```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { WorkoutSession } from './types';
import { startLiveDayRefresh } from './week-calendar';
import { buildMonthCalendar, formatMonthYear, getAdjacentMonth, getHorizontalSwipeDelta } from './month-calendar';

type Props = { history: WorkoutSession[]; now?: Date };

export function MonthCalendar({ history, now }: Props) {
  const [liveNow, setLiveNow] = useState(() => now ?? new Date());
  const [displayedMonth, setDisplayedMonth] = useState(() => new Date((now ?? liveNow).getFullYear(), (now ?? liveNow).getMonth(), 1));
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const current = now ?? liveNow;

  useEffect(() => {
    if (now !== undefined || typeof window === 'undefined' || typeof document === 'undefined') return;
    return startLiveDayRefresh(setLiveNow, {
      now: () => new Date(),
      setTimeout: (callback, delay) => window.setTimeout(callback, delay),
      clearTimeout: (id) => window.clearTimeout(id),
      subscribeFocus: (listener) => window.addEventListener('focus', listener),
      unsubscribeFocus: (listener) => window.removeEventListener('focus', listener),
      subscribeVisibility: (listener) => document.addEventListener('visibilitychange', listener),
      unsubscribeVisibility: (listener) => document.removeEventListener('visibilitychange', listener),
      isVisible: () => document.visibilityState === 'visible'
    });
  }, [now]);

  const changeMonth = (delta: -1 | 1) => setDisplayedMonth((month) => getAdjacentMonth(month, delta));
  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => { pointerStart.current = { x: event.clientX, y: event.clientY }; };
  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const delta = getHorizontalSwipeDelta({ startX: start.x, startY: start.y, endX: event.clientX, endY: event.clientY });
    if (delta !== 0) changeMonth(delta);
  };

  const label = formatMonthYear(displayedMonth);
  const days = buildMonthCalendar(displayedMonth, current, history);

  return (
    <section className="month-calendar panel" aria-label={`Календарь тренировок за ${label}`} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { pointerStart.current = null; }}>
      <header className="month-calendar-header">
        <button className="icon-button" aria-label="Предыдущий месяц" onClick={() => changeMonth(-1)}><ChevronLeft size={18} aria-hidden="true" /></button>
        <h2>{label}</h2>
        <button className="icon-button" aria-label="Следующий месяц" onClick={() => changeMonth(1)}><ChevronRight size={18} aria-hidden="true" /></button>
      </header>
      <div className="month-calendar-weekdays" aria-hidden="true">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="month-calendar-days" role="list">{days.map((day) => (
        <div key={day.dateKey} role="listitem" className={['month-calendar-day', day.isOutsideDisplayedMonth && 'outside-month', day.isToday && 'today'].filter(Boolean).join(' ')} aria-label={day.accessibleLabel}>
          <time dateTime={day.dateKey}>{day.dayNumber}</time>
          {day.hasWorkout ? <span className="month-calendar-workout" role="img" aria-label={`Тренировка: ${day.accessibleLabel}`} /> : <span className="month-calendar-workout-placeholder" aria-hidden="true" />}
        </div>
      ))}</div>
    </section>
  );
}
```

- [ ] **Step 4: Run component tests and typecheck**

Run: `npm test -w apps/web -- src/MonthCalendar.test.tsx && npm run typecheck -w apps/web`

Expected: component test PASS; typecheck exits 0. If `Intl` punctuation differs in the environment, inspect the actual Russian label and make the expectation match the runtime without weakening the semantic assertion.

- [ ] **Step 5: Commit the component**

```bash
git add apps/web/src/MonthCalendar.tsx apps/web/src/MonthCalendar.test.tsx
git commit -m "feat: add interactive history calendar"
```

### Task 3: History placement and compact styling

**Files:**
- Modify: `apps/web/src/App.tsx:21-24,1215-1294`
- Modify: `apps/web/src/styles.css:257-340`
- Modify: `apps/web/src/styles.test.ts:44-83`

- [ ] **Step 1: Write failing CSS contract tests**

Append to `apps/web/src/styles.test.ts`:

```ts
describe('history month calendar layout', () => {
  it('keeps a stable seven-column grid and vertical page gestures', () => {
    expect(cssRule('.month-calendar')).toContain('touch-action: pan-y');
    expect(cssRule('.month-calendar-days')).toContain('grid-template-columns: repeat(7, minmax(0, 1fr))');
    expect(cssRule('.month-calendar-days')).toContain('grid-template-rows: repeat(6,');
  });

  it('uses compact workout dots and muted adjacent dates', () => {
    const dot = cssRule('.month-calendar-workout');
    expect(dot).toContain('width: 4px');
    expect(dot).toContain('height: 4px');
    expect(dot).toContain('background: var(--powder-petal)');
    expect(cssRule('.month-calendar-day.outside-month')).toContain('color: var(--muted)');
  });
});
```

- [ ] **Step 2: Run the style test and confirm it fails**

Run: `npm test -w apps/web -- src/styles.test.ts`

Expected: FAIL because month-calendar rules are absent.

- [ ] **Step 3: Place the calendar first on the History page**

Add `import { MonthCalendar } from './MonthCalendar';` beside the existing `WeekCalendar` import in `apps/web/src/App.tsx`. Inside the outer `<section className="stack">` returned by `HistoryPanel`, insert this before the Backup panel:

```tsx
<MonthCalendar history={props.history} />
```

Do not mount it beside `WeekCalendar` in the app-level area below the tabs.

- [ ] **Step 4: Add compact calendar styles**

Add rules to `apps/web/src/styles.css` using existing palette variables:

```css
.month-calendar { touch-action: pan-y; user-select: none; }
.month-calendar-header { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; }
.month-calendar-header h2 { text-align: center; font-size: 17px; }
.month-calendar-header .icon-button { width: 44px; min-height: 44px; padding: 0; }
.month-calendar-weekdays,
.month-calendar-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); text-align: center; }
.month-calendar-weekdays { margin: 2px 0 4px; color: var(--muted); font-size: 10px; font-weight: 750; }
.month-calendar-days { grid-template-rows: repeat(6, 32px); gap: 2px 4px; }
.month-calendar-day { position: relative; display: grid; min-width: 0; place-items: center; border-radius: 7px; color: var(--text); font-size: 13px; }
.month-calendar-day.outside-month { color: var(--muted); opacity: 0.58; }
.month-calendar-day.today { color: #140f0f; background: var(--powder-blush); font-weight: 800; }
.month-calendar-day time { line-height: 1; }
.month-calendar-workout,
.month-calendar-workout-placeholder { position: absolute; bottom: 3px; width: 4px; height: 4px; border-radius: 50%; }
.month-calendar-workout { background: var(--powder-petal); }
.month-calendar-day.today .month-calendar-workout { background: #140f0f; }
```

- [ ] **Step 5: Run focused web tests**

Run: `npm test -w apps/web -- src/month-calendar.test.ts src/MonthCalendar.test.tsx src/styles.test.ts src/week-calendar.test.ts src/WeekCalendar.test.tsx`

Expected: all focused tests PASS.

- [ ] **Step 6: Commit integration and styles**

```bash
git add apps/web/src/App.tsx apps/web/src/styles.css apps/web/src/styles.test.ts
git commit -m "feat: show month calendar in history"
```

### Task 4: Documentation and full verification

**Files:**
- Modify: `docs/ai/current-state.md`

- [ ] **Step 1: Update durable project memory**

In `docs/ai/current-state.md`, add under Working Features:

```md
- The History page starts with a compact six-week month calendar; completed workout days use dot markers and horizontal swipes or arrow controls switch months without filtering history.
```

Under Known Risks / Watch Areas, retain the existing Telegram iOS note and add:

```md
- History calendar horizontal swipes should be checked on a real Telegram iOS/Android device to confirm they do not interfere with vertical page scrolling or Mini App gestures.
```

- [ ] **Step 2: Run all web checks**

Run: `npm run typecheck -w apps/web && npm test -w apps/web && npm run build -w apps/web`

Expected: all commands exit 0.

- [ ] **Step 3: Run repository-level regression checks**

Run: `npm test && npm run build`

Expected: API and web tests/builds exit 0.

- [ ] **Step 4: Perform local browser checks**

At a narrow mobile viewport, verify:

- the calendar is the first block inside History, not the app-level block below tabs;
- all 42 dates fit without horizontal overflow;
- workout dots, today, and adjacent-month dates remain distinguishable;
- left/right buttons change month and year correctly;
- horizontal swipes change exactly one month;
- vertical scrolling beginning on the calendar still scrolls the History page;
- Backup, Progress, and history cards remain unchanged.

Record that Telegram real-device gesture verification remains required if it cannot be performed locally.

- [ ] **Step 5: Commit documentation**

```bash
git add docs/ai/current-state.md
git commit -m "docs: record history month calendar"
```
