import { describe, expect, it } from 'vitest';
import {
  getSafeViewAfterGenderChange,
  getTabTitle,
  getVisibleUserTabs
} from './navigation';

describe('getVisibleUserTabs', () => {
  it('returns the male tabs in their exact order', () => {
    expect(getVisibleUserTabs('male')).toEqual(['templates', 'session', 'history']);
  });

  it('adds the cycle tab for female users', () => {
    expect(getVisibleUserTabs('female')).toEqual(['templates', 'session', 'history', 'cycle']);
  });

  it('returns no tabs until gender is known', () => {
    expect(getVisibleUserTabs(null)).toEqual([]);
  });
});

describe('getSafeViewAfterGenderChange', () => {
  it('moves a male user from cycle to templates', () => {
    expect(getSafeViewAfterGenderChange('cycle', 'male')).toBe('templates');
  });

  it.each(['templates', 'session', 'history', 'admin'] as const)(
    'keeps %s unchanged for male users',
    (view) => {
      expect(getSafeViewAfterGenderChange(view, 'male')).toBe(view);
    }
  );

  it.each(['templates', 'session', 'history', 'admin', 'cycle'] as const)(
    'keeps %s unchanged for female users',
    (view) => {
      expect(getSafeViewAfterGenderChange(view, 'female')).toBe(view);
    }
  );
});

describe('getTabTitle', () => {
  it('returns Russian titles for every app view', () => {
    expect(getTabTitle('templates')).toBe('Планы');
    expect(getTabTitle('session')).toBe('Зал');
    expect(getTabTitle('history')).toBe('История');
    expect(getTabTitle('cycle')).toBe('Цикл');
    expect(getTabTitle('admin')).toBe('Админ');
  });
});
