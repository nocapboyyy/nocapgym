# Plans Current Week Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared four-metric strip with a static Monday-to-Sunday workout calendar shown only on the `Планы` tab.

**Architecture:** Put local-date/week calculations in a pure `week-calendar.ts` module and render them through a small `WeekCalendar.tsx` component. `App.tsx` supplies the already-loaded completed-session history and removes the old dashboard strip, so no API or database changes are needed.

**Tech Stack:** React 19, TypeScript, Vitest, React DOM server rendering, Lucide React, CSS.

---

## File Map

- Create `apps/web/src/week-calendar.ts`: pure local-date keys, Monday-first week construction, month labels, and workout-day matching.
- Create `apps/web/src/week-calendar.test.ts`: deterministic tests for week boundaries, month transitions, invalid timestamps, completed-only matching, and duplicate sessions.
- Create `apps/web/src/WeekCalendar.tsx`: accessible static calendar markup using the existing Lucide dumbbell icon.
- Create `apps/web/src/WeekCalendar.test.tsx`: server-rendered component tests without adding a DOM-testing dependency.
- Modify `apps/web/src/App.tsx`: show the calendar only for `templates` and remove metric-strip calculations/markup.
- Modify `apps/web/src/App.test.ts`: replace dashboard-strip visibility coverage with plans-calendar visibility coverage.
- Modify `apps/web/src/styles.css`: add the selected contained-card layout and remove obsolete dashboard styles.
- Modify `apps/web/src/styles.test.ts`: lock down seven-column, current-day, adjacent-month, and indicator styling.
- Modify `docs/ai/current-state.md`: record the shipped calendar and removed shared summary strip.

### Task 1: Build And Test The Monday-First Week Model

**Files:**
- Create: `apps/web/src/week-calendar.test.ts`
- Create: `apps/web/src/week-calendar.ts`

- [ ] **Step 1: Write the failing week-model tests**

Create `apps/web/src/week-calendar.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildCurrentWeek, formatCurrentMonth } from './week-calendar';
import type { WorkoutSession } from './types';

function session(input: {
  id: string;
  startedAt: Date | string;
  status?: WorkoutSession['status'];
}): Pick<WorkoutSession, 'id' | 'startedAt' | 'status'> {
  return {
    id: input.id,
    startedAt: input.startedAt instanceof Date ? input.startedAt.toISOString() : input.startedAt,
    status: input.status ?? 'completed'
  };
}

describe('buildCurrentWeek', () => {
  it('returns Monday through Sunday and marks today', () => {
    const now = new Date(2026, 5, 17, 12);
    const days = buildCurrentWeek(now, []);

    expect(days.map((day) => day.dayNumber)).toEqual([15, 16, 17, 18, 19, 20, 21]);
    expect(days.map((day) => day.weekdayLabel)).toEqual(['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']);
    expect(days.map((day) => day.isToday)).toEqual([false, false, true, false, false, false, false]);
  });

  it('starts on the preceding Monday when today is Sunday', () => {
    const days = buildCurrentWeek(new Date(2026, 5, 21, 12), []);

    expect(days[0].dayNumber).toBe(15);
    expect(days[6].dayNumber).toBe(21);
    expect(days[6].isToday).toBe(true);
  });

  it('mutes next-month dates before the month changes', () => {
    const days = buildCurrentWeek(new Date(2026, 5, 29, 12), []);

    expect(days.map((day) => day.dayNumber)).toEqual([29, 30, 1, 2, 3, 4, 5]);
    expect(days.map((day) => day.isOutsideCurrentMonth)).toEqual([false, false, true, true, true, true, true]);
  });

  it('mutes previous-month dates after the month changes', () => {
    const days = buildCurrentWeek(new Date(2026, 6, 1, 12), []);

    expect(days.map((day) => day.dayNumber)).toEqual([29, 30, 1, 2, 3, 4, 5]);
    expect(days.map((day) => day.isOutsideCurrentMonth)).toEqual([true, true, false, false, false, false, false]);
  });

  it('marks local start dates for completed sessions only and deduplicates a day', () => {
    const now = new Date(2026, 6, 1, 12);
    const history = [
      session({ id: 'first', startedAt: new Date(2026, 5, 29, 8) }),
      session({ id: 'second', startedAt: new Date(2026, 6, 1, 8) }),
      session({ id: 'duplicate', startedAt: new Date(2026, 6, 1, 19) }),
      session({ id: 'active', startedAt: new Date(2026, 6, 3, 8), status: 'active' }),
      session({ id: 'invalid', startedAt: 'not-a-date' })
    ];

    const days = buildCurrentWeek(now, history);

    expect(days.filter((day) => day.hasWorkout).map((day) => day.dayNumber)).toEqual([29, 1]);
  });
});

describe('formatCurrentMonth', () => {
  it('returns a capitalized Russian month name', () => {
    expect(formatCurrentMonth(new Date(2026, 6, 1, 12))).toBe('Июль');
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -w apps/web -- week-calendar.test.ts
```

Expected: FAIL because `./week-calendar` does not exist.

- [ ] **Step 3: Implement the minimal pure date model**

Create `apps/web/src/week-calendar.ts`:

```ts
import type { WorkoutSession } from './types';

const weekdayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

export type WeekCalendarDay = {
  date: Date;
  dateKey: string;
  dayNumber: number;
  weekdayLabel: (typeof weekdayLabels)[number];
  accessibleLabel: string;
  isToday: boolean;
  isOutsideCurrentMonth: boolean;
  hasWorkout: boolean;
};

type CalendarSession = Pick<WorkoutSession, 'id' | 'startedAt' | 'status'>;

function localDateKey(date: Date) {
  if (Number.isNaN(date.getTime())) return null;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatCurrentMonth(now: Date) {
  const month = new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(now);
  return month.charAt(0).toUpperCase() + month.slice(1);
}

export function buildCurrentWeek(now: Date, history: CalendarSession[]): WeekCalendarDay[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = localDateKey(today);
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);

  const workoutDateKeys = new Set(
    history
      .filter((session) => session.status === 'completed')
      .map((session) => localDateKey(new Date(session.startedAt)))
      .filter((key): key is string => key !== null)
  );

  return weekdayLabels.map((weekdayLabel, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const dateKey = localDateKey(date) ?? '';

    return {
      date,
      dateKey,
      dayNumber: date.getDate(),
      weekdayLabel,
      accessibleLabel: new Intl.DateTimeFormat('ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      }).format(date),
      isToday: dateKey === todayKey,
      isOutsideCurrentMonth: date.getMonth() !== today.getMonth(),
      hasWorkout: workoutDateKeys.has(dateKey)
    };
  });
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npm test -w apps/web -- week-calendar.test.ts
```

Expected: all `week-calendar` tests PASS.

- [ ] **Step 5: Commit the pure calendar model**

```bash
git add apps/web/src/week-calendar.ts apps/web/src/week-calendar.test.ts
git commit -m "feat: add current week calendar model"
```

### Task 2: Render The Accessible Calendar Component

**Files:**
- Create: `apps/web/src/WeekCalendar.test.tsx`
- Create: `apps/web/src/WeekCalendar.tsx`

- [ ] **Step 1: Write the failing component test**

Create `apps/web/src/WeekCalendar.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WeekCalendar } from './WeekCalendar';
import type { WorkoutSession } from './types';

describe('WeekCalendar', () => {
  it('renders the selected contained-card state and workout label', () => {
    const now = new Date(2026, 6, 1, 12);
    const history: WorkoutSession[] = [{
      id: 'session-1',
      templateId: null,
      startedAt: new Date(2026, 5, 29, 8).toISOString(),
      completedAt: new Date(2026, 5, 29, 9).toISOString(),
      status: 'completed',
      exercises: []
    }];

    const html = renderToStaticMarkup(<WeekCalendar history={history} now={now} />);

    expect(html).toContain('aria-label="Текущая неделя"');
    expect(html).toContain('>Июль<');
    expect(html).toContain('week-calendar-day outside-month');
    expect(html).toContain('week-calendar-day today');
    expect(html).toContain('Тренировка: понедельник, 29 июня');
  });
});
```

- [ ] **Step 2: Run the component test and verify RED**

Run:

```bash
npm test -w apps/web -- WeekCalendar.test.tsx
```

Expected: FAIL because `./WeekCalendar` does not exist.

- [ ] **Step 3: Implement the minimal calendar component**

Create `apps/web/src/WeekCalendar.tsx`:

```tsx
import { Dumbbell } from 'lucide-react';
import type { WorkoutSession } from './types';
import { buildCurrentWeek, formatCurrentMonth } from './week-calendar';

type WeekCalendarProps = {
  history: WorkoutSession[];
  now?: Date;
};

export function WeekCalendar({ history, now = new Date() }: WeekCalendarProps) {
  const days = buildCurrentWeek(now, history);

  return (
    <section className="week-calendar" aria-label="Текущая неделя">
      <h2>{formatCurrentMonth(now)}</h2>
      <div className="week-calendar-days" role="list">
        {days.map((day) => {
          const className = [
            'week-calendar-day',
            day.isOutsideCurrentMonth ? 'outside-month' : '',
            day.isToday ? 'today' : ''
          ].filter(Boolean).join(' ');

          return (
            <div className={className} role="listitem" key={day.dateKey} aria-label={day.accessibleLabel}>
              <time dateTime={day.dateKey}>{day.dayNumber}</time>
              <span className="week-calendar-weekday">{day.weekdayLabel}</span>
              {day.hasWorkout ? (
                <span className="week-calendar-workout" aria-label={`Тренировка: ${day.accessibleLabel}`}>
                  <Dumbbell size={14} strokeWidth={2.2} aria-hidden="true" />
                </span>
              ) : (
                <span className="week-calendar-workout-placeholder" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run model and component tests and verify GREEN**

Run:

```bash
npm test -w apps/web -- week-calendar.test.ts WeekCalendar.test.tsx
```

Expected: both test files PASS.

- [ ] **Step 5: Commit the calendar component**

```bash
git add apps/web/src/WeekCalendar.tsx apps/web/src/WeekCalendar.test.tsx
git commit -m "feat: render plans week calendar"
```

### Task 3: Integrate The Calendar And Remove The Shared Metric Strip

**Files:**
- Modify: `apps/web/src/App.test.ts`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Replace the visibility test before production integration**

In `apps/web/src/App.test.ts`, replace the full import from `./App` with:

```ts
import {
  getBottomControlsHidden,
  getHistorySessionPlanTitle,
  getKeyboardViewportState,
  getDragAutoScrollDelta,
  getPlansCalendarVisible,
  getProgressExercises,
  isKeyboardEditingElement,
  reorderTemplateExercises,
  getSavedTemplateExercises,
  getTabTitle,
  getNextTemplateSet
} from './App';
```

Add this test block where the old `getDashboardStripVisible` block was:

```ts

describe('getPlansCalendarVisible', () => {
  it('shows the week calendar only on the plans tab', () => {
    expect(getPlansCalendarVisible('templates')).toBe(true);
    expect(getPlansCalendarVisible('session')).toBe(false);
    expect(getPlansCalendarVisible('history')).toBe(false);
    expect(getPlansCalendarVisible('admin')).toBe(false);
  });
});
```

Remove the old `getDashboardStripVisible` import and its test block.

- [ ] **Step 2: Run the App test and verify RED**

Run:

```bash
npm test -w apps/web -- App.test.ts
```

Expected: FAIL because `getPlansCalendarVisible` is not exported.

- [ ] **Step 3: Make the minimal App integration**

In `apps/web/src/App.tsx`:

1. Add the component import:

```ts
import { WeekCalendar } from './WeekCalendar';
```

2. Replace `getDashboardStripVisible` with:

```ts
export function getPlansCalendarVisible(tab: Tab) {
  return tab === 'templates';
}
```

3. Delete these obsolete calculations:

```ts
const completedSessionsCount = history.length;
const plannedExercisesCount = templates.reduce((total, template) => total + template.exercises.length, 0);
const activeSetsCount = activeSession?.exercises.reduce((total, exercise) => total + exercise.sets.length, 0) ?? 0;
```

4. Replace the entire `<section className="dashboard-strip" ...>` conditional with:

```tsx
{getPlansCalendarVisible(tab) && <WeekCalendar history={history} />}
```

- [ ] **Step 4: Run the focused App and calendar tests and verify GREEN**

Run:

```bash
npm test -w apps/web -- App.test.ts week-calendar.test.ts WeekCalendar.test.tsx
```

Expected: all focused tests PASS.

- [ ] **Step 5: Commit the integration**

```bash
git add apps/web/src/App.tsx apps/web/src/App.test.ts
git commit -m "feat: replace dashboard strip with plans calendar"
```

### Task 4: Style The Contained Calendar For Narrow Mobile Widths

**Files:**
- Modify: `apps/web/src/styles.test.ts`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Write failing CSS contract tests**

Append to `apps/web/src/styles.test.ts`:

```ts
describe('week calendar layout', () => {
  it('keeps all seven days in one row', () => {
    expect(cssRule('.week-calendar-days')).toContain('grid-template-columns: repeat(7, minmax(0, 1fr))');
  });

  it('uses the design accent for today and soft text for adjacent months', () => {
    expect(cssRule('.week-calendar-day.today')).toContain('background: var(--powder-blush)');
    expect(cssRule('.week-calendar-day.outside-month')).toContain('color: var(--soft)');
  });

  it('reserves stable space for workout indicators', () => {
    expect(cssRule('.week-calendar-workout,\n.week-calendar-workout-placeholder')).toContain('height: 16px');
  });
});
```

- [ ] **Step 2: Run the CSS test and verify RED**

Run:

```bash
npm test -w apps/web -- styles.test.ts
```

Expected: FAIL because the week-calendar selectors do not exist.

- [ ] **Step 3: Add the selected contained-card styles and remove metric styles**

Delete `.dashboard-strip`, `.dashboard-strip > div`, `.metric-label`, `.dashboard-strip strong`, and the mobile `.dashboard-strip` override from `apps/web/src/styles.css`.

Add near the former dashboard styles:

```css
.week-calendar {
  display: grid;
  gap: 12px;
  margin: 14px 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 12px;
  background: var(--panel);
}

.week-calendar h2 {
  font-size: 17px;
}

.week-calendar-days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 5px;
}

.week-calendar-day {
  min-width: 0;
  border-radius: 8px;
  padding: 7px 2px;
  color: var(--text);
  text-align: center;
}

.week-calendar-day.outside-month {
  color: var(--soft);
}

.week-calendar-day.today {
  color: #140f0f;
  background: var(--powder-blush);
}

.week-calendar-day time {
  display: block;
  font-size: 17px;
  font-weight: 800;
  line-height: 1;
}

.week-calendar-weekday {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  font-weight: 750;
}

.week-calendar-workout,
.week-calendar-workout-placeholder {
  display: flex;
  width: 16px;
  height: 16px;
  margin: 7px auto 0;
  align-items: center;
  justify-content: center;
}

.week-calendar-workout {
  color: var(--powder-petal);
}

.week-calendar-day.today .week-calendar-workout {
  color: #140f0f;
}
```

- [ ] **Step 4: Run CSS tests and web typecheck**

Run:

```bash
npm test -w apps/web -- styles.test.ts
npm run typecheck -w apps/web
```

Expected: CSS tests PASS and TypeScript exits with code 0.

- [ ] **Step 5: Commit the calendar styling**

```bash
git add apps/web/src/styles.css apps/web/src/styles.test.ts
git commit -m "style: add compact plans week calendar"
```

### Task 5: Update Durable Project Memory And Verify The Feature

**Files:**
- Modify: `docs/ai/current-state.md`

- [ ] **Step 1: Update the current-state summary**

Add these factual bullets to `docs/ai/current-state.md`:

```md
- The Plans tab replaces the former four-metric summary strip with a static Monday-to-Sunday current-week calendar.
- Completed workouts are marked on the calendar by their local start date; adjacent-month days remain visible but muted.
- The shared summary strip is no longer shown on the Gym or History tabs.
```

Update `Last updated` to `2026-06-21` if needed.

- [ ] **Step 2: Run the complete relevant automated checks**

Run:

```bash
npm test
npm run typecheck -w apps/web
npm run build
```

Expected: all tests PASS, web typecheck exits with code 0, and the production build completes successfully.

- [ ] **Step 3: Check the mobile layout locally**

Run:

```bash
npm run dev -w apps/web
```

Open the local web app at a 320 px-wide viewport and verify:

- all seven days remain on one row;
- the current day uses the accent background;
- adjacent-month dates are visibly muted;
- dumbbell indicators remain visible on muted adjacent-month dates;
- no summary strip appears on `Зал` or `История`;
- the bottom tabbar does not overlap the calendar or the first plans content.

Expected: no horizontal scrolling, clipping, or overlapping text. Record that Telegram iOS real-device verification is still recommended.

- [ ] **Step 4: Commit the documentation update**

```bash
git add docs/ai/current-state.md
git commit -m "docs: record plans week calendar"
```

- [ ] **Step 5: Review the final diff**

Run:

```bash
git status --short
git diff --check
git log -5 --oneline
```

Expected: no whitespace errors; only the calendar feature and its documentation are included. Preserve all unrelated pre-existing workspace changes.
