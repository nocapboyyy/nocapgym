import { describe, expect, it } from 'vitest';
import { getKeyboardViewportState, getTabTitle } from './App';

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
