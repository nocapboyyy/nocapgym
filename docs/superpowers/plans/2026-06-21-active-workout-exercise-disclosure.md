# Active Workout Exercise Disclosure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make active-workout exercise cards independently collapsible, open the first card initially, and show a palette-aligned completion indicator when every existing set is complete.

**Architecture:** Keep disclosure state local to `SessionPanel` because it is transient presentation state. Add small exported pure functions for completion and disclosure-array transitions, use those functions from the component, and style the new header/content structure with existing CSS variables and Lucide icons.

**Tech Stack:** React 19, TypeScript, Vitest, CSS, lucide-react.

---

### Task 1: Exercise completion rule

**Files:**
- Modify: `apps/web/src/App.test.ts`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Write the failing completion tests**

Add `isSessionExerciseComplete` to the imports in `App.test.ts` and cover empty, partial, and complete exercises:

```ts
describe('isSessionExerciseComplete', () => {
  const set = (completed: boolean): SessionSet => ({
    type: 'working', plannedWeightKg: null, plannedReps: null,
    actualWeightKg: 50, actualReps: 8, completed, order: 0
  });

  it('requires at least one set', () => {
    expect(isSessionExerciseComplete({ exerciseId: 'bench', order: 0, sets: [] })).toBe(false);
  });

  it('requires every existing set to be complete', () => {
    expect(isSessionExerciseComplete({ exerciseId: 'bench', order: 0, sets: [set(true), set(false)] })).toBe(false);
    expect(isSessionExerciseComplete({ exerciseId: 'bench', order: 0, sets: [set(true), set(true)] })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -w apps/web -- App.test.ts`

Expected: FAIL because `isSessionExerciseComplete` is not exported.

- [ ] **Step 3: Add the minimal completion helper**

Add near the existing exported UI helpers in `App.tsx`:

```ts
export function isSessionExerciseComplete(exercise: Pick<SessionExercise, 'sets'>) {
  return exercise.sets.length > 0 && exercise.sets.every((set) => set.completed);
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -w apps/web -- App.test.ts`

Expected: PASS.

### Task 2: Disclosure state transitions

**Files:**
- Modify: `apps/web/src/App.test.ts`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Write failing state-transition tests**

Import the four disclosure helpers and add tests:

```ts
describe('active workout disclosure state', () => {
  it('opens only the first exercise initially', () => {
    expect(getInitialExerciseDisclosureState(3)).toEqual([true, false, false]);
    expect(getInitialExerciseDisclosureState(0)).toEqual([]);
  });

  it('toggles cards independently', () => {
    expect(toggleExerciseDisclosureState([true, false, true], 1)).toEqual([true, true, true]);
  });

  it('opens a newly appended exercise', () => {
    expect(appendExpandedExerciseDisclosureState([true, false])).toEqual([true, false, true]);
  });

  it('removes only the matching disclosure entry', () => {
    expect(removeExerciseDisclosureState([true, false, true], 1)).toEqual([true, true]);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -w apps/web -- App.test.ts`

Expected: FAIL because the disclosure helpers do not exist.

- [ ] **Step 3: Implement minimal immutable state helpers**

Add in `App.tsx`:

```ts
export function getInitialExerciseDisclosureState(count: number) {
  return Array.from({ length: count }, (_, index) => index === 0);
}

export function toggleExerciseDisclosureState(state: boolean[], index: number) {
  return state.map((isExpanded, currentIndex) => currentIndex === index ? !isExpanded : isExpanded);
}

export function appendExpandedExerciseDisclosureState(state: boolean[]) {
  return [...state, true];
}

export function removeExerciseDisclosureState(state: boolean[], index: number) {
  return state.filter((_, currentIndex) => currentIndex !== index);
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -w apps/web -- App.test.ts`

Expected: PASS.

### Task 3: Render independently collapsible exercise cards

**Files:**
- Modify: `apps/web/src/session-panel.test.ts`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Write a failing structural regression test**

Extend `session-panel.test.ts` to require the accessible disclosure and completion hooks:

```ts
it('renders accessible exercise disclosures and the completion indicator', () => {
  const source = readFileSync(resolve(__dirname, 'App.tsx'), 'utf8');

  expect(source).toContain('aria-expanded={isExpanded}');
  expect(source).toContain('session-exercise-header');
  expect(source).toContain('session-exercise-content');
  expect(source).toContain('exercise-complete-indicator');
  expect(source).toContain('isSessionExerciseComplete(exercise)');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -w apps/web -- session-panel.test.ts`

Expected: FAIL because the new disclosure markup is absent.

- [ ] **Step 3: Add component disclosure state and icons**

Import `ChevronDown` and `CircleCheck` from `lucide-react`. In `SessionPanel`, initialize `expandedExercises` from the session exercise count, reset it when `session.id` changes, and use the helpers when toggling, adding, or deleting exercises.

Render each card with this structure:

```tsx
<article className="card session-exercise-card" key={`${exercise.exerciseId}-${exerciseIndex}`}>
  <button
    className="session-exercise-header"
    aria-expanded={isExpanded}
    onClick={() => setExpandedExercises((state) => toggleExerciseDisclosureState(state, exerciseIndex))}
  >
    <span className="session-exercise-title">{exercise.exercise?.name ?? selectedExercise?.name ?? 'Упражнение'}</span>
    {isSessionExerciseComplete(exercise) && (
      <span className="exercise-complete-indicator" aria-label="Все подходы выполнены">
        <CircleCheck size={17} />
      </span>
    )}
    <ChevronDown className="session-exercise-chevron" size={20} aria-hidden="true" />
  </button>
  {isExpanded && <div className="session-exercise-content">{/* existing controls */}</div>}
</article>
```

Use the catalog lookup as the fallback while newly added session exercises do not have an embedded `exercise`. Keep all current select, delete, set-edit, completion-toggle, and add-set behavior inside the content container.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npm test -w apps/web -- App.test.ts session-panel.test.ts`

Expected: PASS.

Run: `npm run typecheck -w apps/web`

Expected: exit 0.

### Task 4: Match the existing palette and mobile interaction rules

**Files:**
- Modify: `apps/web/src/styles.test.ts`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Write a failing style regression test**

Add to `styles.test.ts`:

```ts
describe('active workout exercise disclosure', () => {
  it('uses the project palette for the completion indicator and a full touch target header', () => {
    const header = cssRule('.session-exercise-header');
    const indicator = cssRule('.exercise-complete-indicator');

    expect(header).toContain('min-height: 44px');
    expect(indicator).toContain('var(--powder-blush)');
    expect(indicator).not.toContain('green');
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -w apps/web -- styles.test.ts`

Expected: FAIL because the new CSS rules do not exist.

- [ ] **Step 3: Add disclosure styles**

Add focused rules in `styles.css`:

```css
.session-exercise-card { padding: 0; overflow: hidden; }
.session-exercise-header { width: 100%; min-height: 44px; justify-content: flex-start; border-radius: 8px; padding: 12px; color: var(--text); background: transparent; box-shadow: none; text-align: left; }
.session-exercise-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.exercise-complete-indicator { display: inline-flex; color: var(--powder-blush); }
.session-exercise-chevron { margin-left: auto; flex: 0 0 auto; transition: transform 180ms ease; }
.session-exercise-header[aria-expanded='true'] .session-exercise-chevron { transform: rotate(180deg); }
.session-exercise-content { display: grid; gap: 12px; padding: 0 12px 12px; }
```

Keep the indicator compact and use only existing palette variables. Do not add green or a new color token.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npm test -w apps/web -- styles.test.ts session-panel.test.ts App.test.ts`

Expected: PASS.

Run: `npm run typecheck -w apps/web`

Expected: exit 0.

### Task 5: Knowledge base and complete verification

**Files:**
- Modify: `docs/ai/current-state.md`

- [ ] **Step 1: Update durable project state**

Add a concise working-feature note that active workout exercises are independently collapsible, the first opens initially, and fully completed exercises show a palette-aligned completion indicator.

- [ ] **Step 2: Run the full relevant verification suite**

Run: `npm test`

Expected: all tests pass.

Run: `npm run typecheck -w apps/web`

Expected: exit 0.

Run: `npm run build -w apps/web`

Expected: exit 0 and a Vite production bundle.

- [ ] **Step 3: Review the final diff**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short`

Expected: only the plan, active-workout implementation/tests/styles, the current-state update, and pre-existing unrelated user changes are present.

- [ ] **Step 4: Commit the implementation files**

```bash
git add apps/web/src/App.tsx apps/web/src/App.test.ts apps/web/src/session-panel.test.ts apps/web/src/styles.css apps/web/src/styles.test.ts docs/ai/current-state.md docs/superpowers/plans/2026-06-21-active-workout-exercise-disclosure.md
git commit -m "feat: collapse active workout exercises"
```
