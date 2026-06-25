import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SessionPanel } from './App';
import type { Exercise, WorkoutTemplate } from './types';

describe('SessionPanel source', () => {
  it('does not keep a manual save action for the active workout', () => {
    const source = readFileSync(resolve(__dirname, 'App.tsx'), 'utf8');

    expect(source).not.toContain('Тренировка сохранена');
    expect(source).not.toContain('onSave={() => saveSession()}');
  });

  it('renders accessible exercise disclosures and the completion indicator', () => {
    const source = readFileSync(resolve(__dirname, 'App.tsx'), 'utf8');

    expect(source).toContain('aria-expanded={isExpanded}');
    expect(source).toContain('session-exercise-header');
    expect(source).toContain('session-exercise-content');
    expect(source).toContain('exercise-complete-indicator');
    expect(source).toContain('isSessionExerciseComplete(exercise)');
  });
});

describe('SessionPanel empty state', () => {
  const exercises: Exercise[] = [
    { id: 'bench', name: 'Жим лёжа', muscleGroup: 'chest', equipment: 'Штанга', techniqueNote: null, isHidden: false },
    { id: 'squat', name: 'Присед', muscleGroup: 'legs', equipment: 'Штанга', techniqueNote: null, isHidden: false },
    { id: 'pullup', name: 'Подтягивания', muscleGroup: 'back', equipment: 'Турник', techniqueNote: null, isHidden: false },
    { id: 'row', name: 'Тяга в наклоне', muscleGroup: 'back', equipment: 'Штанга', techniqueNote: null, isHidden: false },
    { id: 'press', name: 'Жим стоя', muscleGroup: 'shoulders', equipment: 'Штанга', techniqueNote: null, isHidden: false }
  ];

  const templates: WorkoutTemplate[] = [
    {
      id: 'template-1',
      name: 'Верх тела',
      notes: null,
      exercises: [
        { id: 'template-exercise-1', exerciseId: 'bench', exercise: exercises[0], order: 0, sets: [] },
        { id: 'template-exercise-2', exerciseId: 'pullup', exercise: exercises[2], order: 1, sets: [] },
        { id: 'template-exercise-3', exerciseId: 'squat', exercise: exercises[1], order: 2, sets: [] },
        { id: 'template-exercise-4', exerciseId: 'row', exercise: exercises[3], order: 3, sets: [] },
        { id: 'template-exercise-5', exerciseId: 'press', exercise: exercises[4], order: 4, sets: [] }
      ]
    }
  ];

  it('offers a workout start action and plan choices when no session is active', () => {
    const markup = renderToStaticMarkup(
      createElement(SessionPanel, {
        session: null,
        exercises,
        templates,
        setSession: () => undefined,
        onComplete: () => undefined,
        onStart: () => undefined,
        onOpenTemplates: () => undefined,
        initialPlanPickerOpen: true
      })
    );

    expect(markup).toContain('Готовы к тренировке?');
    expect(markup).toContain('Начать тренировку');
    expect(markup).toContain('Верх тела');
    expect(markup).toContain('5 упражнений');
    expect(markup).toContain('Жим лёжа');
    expect(markup).toContain('Подтягивания');
    expect(markup).toContain('Присед');
    expect(markup).toContain('Тяга в наклоне');
    expect(markup).toContain('Жим стоя');
  });

  it('offers plan creation from the gym tab when there are no plans', () => {
    const markup = renderToStaticMarkup(
      createElement(SessionPanel, {
        session: null,
        exercises,
        templates: [],
        setSession: () => undefined,
        onComplete: () => undefined,
        onStart: () => undefined,
        onOpenTemplates: () => undefined
      })
    );

    expect(markup).toContain('Планов пока нет');
    expect(markup).toContain('Создать план');
  });
});
