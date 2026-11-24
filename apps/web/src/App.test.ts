import { describe, expect, it, vi } from 'vitest';
import { getKeyboardViewportState, getBottomControlsHidden, getPlansCalendarVisible, getPreviousUserTabAfterGenderChange, getAppStartupState, orchestrateGenderSave, isKeyboardEditingElement } from './App';

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

describe('isKeyboardEditingElement', () => {
  it('excludes native selects while keeping keyboard editors', () => {
    expect(isKeyboardEditingElement({ tagName: 'INPUT', isContentEditable: false })).toBe(true);
    expect(isKeyboardEditingElement({ tagName: 'TEXTAREA', isContentEditable: false })).toBe(true);
    expect(isKeyboardEditingElement({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isKeyboardEditingElement({ tagName: 'SELECT', isContentEditable: false })).toBe(false);
  });
});

describe('getPlansCalendarVisible', () => {
  it('shows the plans calendar on the templates tab only', () => {
    expect(getPlansCalendarVisible('templates')).toBe(true);
    expect(getPlansCalendarVisible('session')).toBe(false);
    expect(getPlansCalendarVisible('history')).toBe(false);
    expect(getPlansCalendarVisible('cycle')).toBe(false);
    expect(getPlansCalendarVisible('admin')).toBe(false);
  });
});

describe('getPreviousUserTabAfterGenderChange', () => {
  it('normalizes a remembered cycle tab when gender changes to male', () => {
    expect(getPreviousUserTabAfterGenderChange('cycle', 'male')).toBe('templates');
  });

  it('preserves remembered tabs that remain available', () => {
    expect(getPreviousUserTabAfterGenderChange('history', 'male')).toBe('history');
    expect(getPreviousUserTabAfterGenderChange('cycle', 'female')).toBe('cycle');
  });
});

describe('getAppStartupState', () => {
  it('uses a retry state instead of the app shell when loading failed without a user', () => {
    expect(getAppStartupState({ loading: false, user: null, loadError: 'Ошибка' })).toBe('error');
  });

  it('distinguishes loading, onboarding, and ready states', () => {
    expect(getAppStartupState({ loading: true, user: null, loadError: null })).toBe('loading');
    expect(getAppStartupState({ loading: false, user: { gender: null }, loadError: null })).toBe('onboarding');
    expect(getAppStartupState({ loading: false, user: { gender: 'female' }, loadError: null })).toBe('ready');
  });
});

describe('orchestrateGenderSave', () => {
  const updatedUser = {
    id: 'user-1',
    telegramId: '123',
    firstName: 'Ирина',
    username: null,
    gender: 'female' as const
  };

  it('commits the PATCH result before loading initial workout data', async () => {
    const events: string[] = [];

    const result = await orchestrateGenderSave({
      gender: 'female',
      shouldLoadWorkoutData: true,
      patchUser: async () => updatedUser,
      commitUser: () => events.push('commit'),
      loadWorkoutData: async () => {
        events.push('load');
        throw new Error('load failed');
      }
    });

    expect(events).toEqual(['commit', 'load']);
    expect(result).toBe('data-load-error');
  });

  it('does not commit or load when PATCH fails', async () => {
    const commitUser = vi.fn();
    const loadWorkoutData = vi.fn();

    const result = await orchestrateGenderSave({
      gender: 'female',
      shouldLoadWorkoutData: true,
      patchUser: async () => { throw new Error('patch failed'); },
      commitUser,
      loadWorkoutData
    });

    expect(result).toBe('profile-update-error');
    expect(commitUser).not.toHaveBeenCalled();
    expect(loadWorkoutData).not.toHaveBeenCalled();
  });

  it('skips workout loading for an already configured profile', async () => {
    const commitUser = vi.fn();
    const loadWorkoutData = vi.fn();

    const result = await orchestrateGenderSave({
      gender: 'female',
      shouldLoadWorkoutData: false,
      patchUser: async () => updatedUser,
      commitUser,
      loadWorkoutData
    });

    expect(result).toBe('success');
    expect(commitUser).toHaveBeenCalledWith(updatedUser);
    expect(loadWorkoutData).not.toHaveBeenCalled();
  });
});
