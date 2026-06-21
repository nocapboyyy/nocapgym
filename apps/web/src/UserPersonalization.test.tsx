import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CyclePanel, GenderOnboarding, ProfileMenu } from './UserPersonalization';

describe('GenderOnboarding', () => {
  it('asks the user to choose one of the supported genders without a skip action', () => {
    const html = renderToStaticMarkup(
      <GenderOnboarding saving={false} error={null} onSelect={vi.fn()} />
    );

    expect(html).toContain('Укажите ваш пол');
    expect(html).toContain('Мужской');
    expect(html).toContain('Женский');
    expect(html).not.toContain('Пропустить');
    expect(html).toContain('aria-labelledby="gender-onboarding-title"');
    expect(html).toContain('id="gender-onboarding-title"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="alert"');
  });

  it('disables both choices while saving', () => {
    const html = renderToStaticMarkup(
      <GenderOnboarding saving error={null} onSelect={vi.fn()} />
    );

    expect(html.match(/<button[^>]*disabled=""/g)).toHaveLength(2);
  });

  it('renders a save error as a retryable alert', () => {
    const html = renderToStaticMarkup(
      <GenderOnboarding saving={false} error="Не удалось сохранить" onSelect={vi.fn()} />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('>Не удалось сохранить</p>');
  });
});

describe('ProfileMenu', () => {
  it('shows gender controls and hides the admin action for a regular user', () => {
    const html = renderToStaticMarkup(
      <ProfileMenu
        gender="male"
        isAdmin={false}
        saving={false}
        onGenderChange={vi.fn()}
        onOpenAdmin={vi.fn()}
      />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('class="profile-gender-actions"');
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Пол"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain('role="radio"');
    expect(html).not.toContain('role="radiogroup"');
    expect(html).toContain('Мужской');
    expect(html).toContain('Женский');
    expect(html).toContain('profile-menu-action current');
    expect(html).not.toContain('Админка');
    expect(html).toContain('aria-hidden="true"');
  });

  it('shows the admin action for an admin', () => {
    const html = renderToStaticMarkup(
      <ProfileMenu
        gender="female"
        isAdmin
        saving={false}
        onGenderChange={vi.fn()}
        onOpenAdmin={vi.fn()}
      />
    );

    expect(html).toContain('Админка');
    expect(html).not.toContain('role="menuitem"');
  });

  it('disables both gender controls while saving', () => {
    const html = renderToStaticMarkup(
      <ProfileMenu
        gender="female"
        isAdmin
        saving
        onGenderChange={vi.fn()}
        onOpenAdmin={vi.fn()}
      />
    );

    expect(html.match(/aria-pressed="(?:true|false)"[^>]*disabled=""/g)).toHaveLength(2);
  });
});

describe('CyclePanel', () => {
  it('shows the development placeholder', () => {
    const html = renderToStaticMarkup(<CyclePanel />);

    expect(html).toContain('panel empty cycle-placeholder');
    expect(html).toContain('Функционал находится в разработке');
    expect(html).toMatch(/^<div/);
    expect(html).toContain('aria-hidden="true"');
  });
});
