import { describe, expect, it } from 'vitest';
import {
  getBottomControlsHidden,
  getHistorySessionPlanTitle,
  getKeyboardViewportState,
  getDashboardStripVisible,
  reorderTemplateExercises,
  getSavedTemplateExercises,
  getTabTitle,
  getNextTemplateSet
} from './App';

describe('getTabTitle', () => {
  it('matches the visible tab labels', () => {
    expect(getTabTitle('templates')).toBe('Планы');
    expect(getTabTitle('session')).toBe('Зал');
    expect(getTabTitle('history')).toBe('История');
    expect(getTabTitle('admin')).toBe('Админ');
  });
});

describe('getKeyboardViewportState', () => {
  it('marks the keyboard as open when the visual viewport is significantly smaller', () => {
    const state = getKeyboardViewportState({
      windowInnerHeight: 812,
      visualViewportHeight: 470,
      visualViewportOffsetTop: 0
    });

    expect(state.isKeyboardOpen).toBe(true);
    expect(state.keyboardOffset).toBe(342);
  });

  it('does not mark small viewport differences as an open keyboard', () => {
    const state = getKeyboardViewportState({
      windowInnerHeight: 812,
      visualViewportHeight: 780,
      visualViewportOffsetTop: 0
    });

    expect(state.isKeyboardOpen).toBe(false);
  });
});

describe('getBottomControlsHidden', () => {
  it('hides bottom controls when an editable field is focused even without viewport offset', () => {
    expect(getBottomControlsHidden({ isKeyboardOpen: false, isEditableFocused: true })).toBe(true);
  });

  it('keeps bottom controls visible when there is no keyboard signal or focused editor', () => {
    expect(getBottomControlsHidden({ isKeyboardOpen: false, isEditableFocused: false })).toBe(false);
  });
});

describe('getDashboardStripVisible', () => {
  it('hides the dashboard strip on the admin tab only', () => {
    expect(getDashboardStripVisible('templates')).toBe(true);
    expect(getDashboardStripVisible('session')).toBe(true);
    expect(getDashboardStripVisible('history')).toBe(true);
    expect(getDashboardStripVisible('admin')).toBe(false);
  });
});

describe('getHistorySessionPlanTitle', () => {
  it('uses the completed session template name when available', () => {
    expect(getHistorySessionPlanTitle({ template: { id: 'template-1', name: 'Грудь и трицепс' } })).toBe('Грудь и трицепс');
  });

  it('falls back when the completed session has no template', () => {
    expect(getHistorySessionPlanTitle({ template: null })).toBe('План не найден');
  });
});

describe('getNextTemplateSet', () => {
  it('copies values from the previous template set', () => {
    const nextSet = getNextTemplateSet([
      { type: 'working', targetWeightKg: 45, targetReps: 12, order: 0 }
    ]);

    expect(nextSet).toEqual({ type: 'working', targetWeightKg: 45, targetReps: 12, order: 1 });
  });
});

describe('getSavedTemplateExercises', () => {
  it('replaces the edited exercise without changing its position', () => {
    const exercises = [
      {
        exerciseId: 'bench',
        order: 0,
        sets: [{ type: 'working' as const, targetWeightKg: 40, targetReps: 10, order: 0 }]
      },
      {
        exerciseId: 'squat',
        order: 1,
        sets: [{ type: 'working' as const, targetWeightKg: 60, targetReps: 8, order: 0 }]
      }
    ];

    const saved = getSavedTemplateExercises(exercises, {
      exerciseId: 'squat',
      order: 1,
      sets: [
        { type: 'working', targetWeightKg: 65, targetReps: 8, order: 0 },
        { type: 'working', targetWeightKg: 65, targetReps: 8, order: 1 }
      ]
    }, 1);

    expect(saved).toEqual([
      exercises[0],
      {
        exerciseId: 'squat',
        order: 1,
        sets: [
          { type: 'working', targetWeightKg: 65, targetReps: 8, order: 0 },
          { type: 'working', targetWeightKg: 65, targetReps: 8, order: 1 }
        ]
      }
    ]);
  });
});

describe('reorderTemplateExercises', () => {
  it('moves an exercise and recalculates order values', () => {
    const exercises = [
      {
        exerciseId: 'bench',
        order: 0,
        sets: [{ type: 'working' as const, targetWeightKg: 40, targetReps: 10, order: 0 }]
      },
      {
        exerciseId: 'squat',
        order: 1,
        sets: [{ type: 'working' as const, targetWeightKg: 60, targetReps: 8, order: 0 }]
      },
      {
        exerciseId: 'deadlift',
        order: 2,
        sets: [{ type: 'working' as const, targetWeightKg: 80, targetReps: 5, order: 0 }]
      }
    ];

    expect(reorderTemplateExercises(exercises, 0, 2)).toEqual([
      { ...exercises[1], order: 0 },
      { ...exercises[2], order: 1 },
      { ...exercises[0], order: 2 }
    ]);
  });
});
