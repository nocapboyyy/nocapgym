import { describe, expect, it } from 'vitest';
import { getModalKeyboardAction } from './useModalFocus';

describe('getModalKeyboardAction', () => {
  it('closes a modal on Escape', () => {
    expect(getModalKeyboardAction({ key: 'Escape', shiftKey: false, activeIndex: 1, focusableCount: 3 })).toBe(
      'close'
    );
  });

  it('wraps Tab from the last control to the first', () => {
    expect(getModalKeyboardAction({ key: 'Tab', shiftKey: false, activeIndex: 2, focusableCount: 3 })).toBe(
      'first'
    );
  });

  it('wraps Shift+Tab from the first control to the last', () => {
    expect(getModalKeyboardAction({ key: 'Tab', shiftKey: true, activeIndex: 0, focusableCount: 3 })).toBe(
      'last'
    );
  });

  it('moves focus into a modal if focus is outside it', () => {
    expect(getModalKeyboardAction({ key: 'Tab', shiftKey: false, activeIndex: -1, focusableCount: 2 })).toBe(
      'first'
    );
  });
});
