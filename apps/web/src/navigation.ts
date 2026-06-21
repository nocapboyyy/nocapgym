import type { Gender } from './types';

export type UserTab = 'templates' | 'session' | 'history' | 'cycle';
export type AppView = UserTab | 'admin';

const tabLabels: Record<AppView, string> = {
  templates: 'Планы',
  session: 'Зал',
  history: 'История',
  cycle: 'Цикл',
  admin: 'Админ'
};

export function getTabTitle(view: AppView) {
  return tabLabels[view];
}

export function getVisibleUserTabs(gender: Gender | null): UserTab[] {
  if (gender === null) {
    return [];
  }

  const tabs: UserTab[] = ['templates', 'session', 'history'];
  return gender === 'female' ? [...tabs, 'cycle'] : [...tabs];
}

export function getSafeViewAfterGenderChange(view: AppView, gender: Gender): AppView {
  return view === 'cycle' && gender === 'male' ? 'templates' : view;
}
