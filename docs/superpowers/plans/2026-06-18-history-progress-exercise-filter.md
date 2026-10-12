# History Progress Exercise Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ограничить список упражнений в блоке «Прогресс» упражнениями, имеющими хотя бы одну фактическую точку прогресса в истории пользователя.

**Architecture:** Чистая frontend-функция вычисляет список из уже загруженных завершённых тренировок по тому же правилу, которое backend применяет при построении прогресса. `HistoryPanel` использует вычисленный список напрямую, поэтому скрытые упражнения из старых тренировок сохраняются, а дополнительный API не нужен.

**Tech Stack:** React, TypeScript, Vitest

---

### Task 1: Добавить фильтрацию упражнений с прогрессом

**Files:**
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.test.ts`

- [ ] **Step 1: Написать падающий unit-тест**

Добавить импорт `getProgressExercises` и тест, который включает подходящее скрытое упражнение, исключает разминку и незавершённый рабочий подход, удаляет повтор и проверяет сортировку:

```ts
import type { WorkoutSession } from './types';
import { getProgressExercises } from './App';

describe('getProgressExercises', () => {
  it('returns unique historical exercises with actual progress points sorted by name', () => {
    const bench = {
      id: 'bench',
      name: 'Жим лёжа',
      muscleGroup: 'Грудь',
      equipment: 'Штанга',
      techniqueNote: null,
      isHidden: true
    };
    const history = [
      {
        exercises: [
          {
            exerciseId: bench.id,
            exercise: bench,
            sets: [{ type: 'working', completed: true, actualWeightKg: 80, actualReps: 8 }]
          },
          {
            exerciseId: 'squat',
            exercise: { ...bench, id: 'squat', name: 'Присед' },
            sets: [{ type: 'working', completed: false, actualWeightKg: 100, actualReps: 5 }]
          }
        ]
      },
      {
        exercises: [
          {
            exerciseId: bench.id,
            exercise: bench,
            sets: [{ type: 'working', completed: true, actualWeightKg: 82.5, actualReps: 6 }]
          },
          {
            exerciseId: 'pullup',
            exercise: { ...bench, id: 'pullup', name: 'Подтягивания', isHidden: false },
            sets: [{ type: 'warmup', completed: true, actualWeightKg: 0, actualReps: 10 }]
          },
          {
            exerciseId: 'deadlift',
            exercise: { ...bench, id: 'deadlift', name: 'Становая тяга', isHidden: false },
            sets: [{ type: 'working', completed: true, actualWeightKg: 120, actualReps: 5 }]
          }
        ]
      }
    ] as WorkoutSession[];

    expect(getProgressExercises(history)).toEqual([
      bench,
      { ...bench, id: 'deadlift', name: 'Становая тяга', isHidden: false }
    ]);
  });
});
```

- [ ] **Step 2: Запустить тест и подтвердить RED**

Run: `npm test -w apps/web -- src/App.test.ts`

Expected: FAIL, потому что `getProgressExercises` ещё не экспортируется из `App.tsx`.

- [ ] **Step 3: Реализовать минимальную чистую функцию**

Добавить рядом с другими экспортируемыми helper-функциями в `apps/web/src/App.tsx`:

```ts
export function getProgressExercises(history: WorkoutSession[]): Exercise[] {
  const exercisesById = new Map<string, Exercise>();

  for (const session of history) {
    for (const sessionExercise of session.exercises) {
      const hasProgressPoint = sessionExercise.sets.some(
        (set) =>
          set.type === 'working' &&
          set.completed &&
          set.actualWeightKg !== null &&
          set.actualReps !== null
      );

      if (hasProgressPoint && sessionExercise.exercise) {
        exercisesById.set(sessionExercise.exerciseId, sessionExercise.exercise);
      }
    }
  }

  return [...exercisesById.values()].sort((left, right) => left.name.localeCompare(right.name, 'ru'));
}
```

- [ ] **Step 4: Подключить результат к выпадающему списку**

В `HistoryPanel` вычислить список и заменить источник options:

```ts
function HistoryPanel(props: {
  history: WorkoutSession[];
  progress: ProgressPoint[];
  selectedExerciseId: string;
  onSelectExercise: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
}) {
  const progressExercises = useMemo(() => getProgressExercises(props.history), [props.history]);
}
```

В существующем JSX выпадающего списка заменить `props.exercises.map(...)` на:

```tsx
{progressExercises.map((exercise) => (
  <option key={exercise.id} value={exercise.id}>
    {exercise.name}
  </option>
))}
```

Удалить свойство `exercises: Exercise[]` из сигнатуры `HistoryPanel` и передачу `exercises={exercises}` при его вызове, потому что активный каталог больше не является источником этого списка.

- [ ] **Step 5: Запустить frontend-тест и typecheck**

Run: `npm test -w apps/web -- src/App.test.ts`

Expected: PASS.

Run: `npm run typecheck -w apps/web`

Expected: exit code 0.

### Task 2: Обновить память проекта и выполнить итоговую проверку

**Files:**
- Modify: `docs/ai/current-state.md`

- [ ] **Step 1: Зафиксировать новое поведение**

Добавить в `Working Features` короткий пункт:

```md
- The History progress selector lists only exercises with actual progress points, including hidden exercises preserved in old sessions.
```

Обновить дату `Last updated` на `2026-06-18`.

- [ ] **Step 2: Запустить все frontend-тесты**

Run: `npm test -w apps/web`

Expected: все тесты PASS.

- [ ] **Step 3: Проверить diff**

Run: `git diff --check`

Expected: exit code 0 без сообщений.

- [ ] **Step 4: Закоммитить реализацию**

```bash
git add apps/web/src/App.tsx apps/web/src/App.test.ts docs/ai/current-state.md docs/superpowers/plans/2026-06-18-history-progress-exercise-filter.md
git commit -m "fix: filter history progress exercises"
```
