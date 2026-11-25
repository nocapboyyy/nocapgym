import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SessionPanel } from './GymScreen';
import type { Exercise, PlanSummary, WorkoutSession } from './types';

describe('SessionPanel empty state', () => {
  const exercises: Exercise[] = [
    { id: 'bench', name: 'Жим лёжа', muscleGroup: 'chest', equipment: 'Штанга', techniqueNote: null, isHidden: false },
    { id: 'squat', name: 'Присед', muscleGroup: 'legs', equipment: 'Штанга', techniqueNote: null, isHidden: false },
    { id: 'pullup', name: 'Подтягивания', muscleGroup: 'back', equipment: 'Турник', techniqueNote: null, isHidden: false },
    { id: 'row', name: 'Тяга в наклоне', muscleGroup: 'back', equipment: 'Штанга', techniqueNote: null, isHidden: false },
    { id: 'press', name: 'Жим стоя', muscleGroup: 'shoulders', equipment: 'Штанга', techniqueNote: null, isHidden: false }
  ];

  const templates: PlanSummary[] = [
    {
      id: 'template-1',
      name: 'Верх тела',
      updatedAt: '2026-01-01',
      exercises: [
        { id: 'template-exercise-1', name: exercises[0].name },
        { id: 'template-exercise-2', name: exercises[2].name },
        { id: 'template-exercise-3', name: exercises[1].name },
        { id: 'template-exercise-4', name: exercises[3].name },
        { id: 'template-exercise-5', name: exercises[4].name }
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

it('renders a completed set in an expanded exercise and offers both finish actions', () => {
  const session: WorkoutSession = {
    id: 'active', templateId: null, templateNameSnapshot: null, startedAt: '', completedAt: null, status: 'active',
    exercises: [{ order: 0, exerciseId: 'press', sets: [{ type: 'working', order: 0, completed: true,
      actualReps: 8, actualWeightKg: 50, plannedReps: 8, plannedWeightKg: 50 }] }]
  };
  const html = renderToStaticMarkup(createElement(SessionPanel, {
    session, exercises: [], templates: [], setSession() {}, onStart() {}, onComplete() {}, onOpenTemplates() {}
  }));
  expect(html).toContain('aria-expanded="true"');
  expect(html).toContain('Все подходы выполнены');
  expect(html).toContain('Завершить и обновить план');
  expect(html).not.toContain('Сохранить тренировку');
});
