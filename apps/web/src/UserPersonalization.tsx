import { CalendarDays, createLucideIcon, Shield } from 'lucide-react';
import type { Gender } from './types';

const Mars = createLucideIcon('Mars', [
  ['circle', { cx: '9', cy: '15', r: '4', key: 'mars-circle' }],
  ['path', { d: 'm12 12 7-7', key: 'mars-line' }],
  ['path', { d: 'M14 5h5v5', key: 'mars-arrow' }]
]);

const Venus = createLucideIcon('Venus', [
  ['circle', { cx: '12', cy: '9', r: '6', key: 'venus-circle' }],
  ['path', { d: 'M12 15v7', key: 'venus-line' }],
  ['path', { d: 'M9 19h6', key: 'venus-cross' }]
]);

type GenderOnboardingProps = {
  saving: boolean;
  error: string | null;
  onSelect: (gender: Gender) => void;
};

export function GenderOnboarding({ saving, error, onSelect }: GenderOnboardingProps) {
  return (
    <main className="gender-onboarding">
      <section className="card gender-onboarding-card" aria-labelledby="gender-onboarding-title">
        <div className="card-header">
          <div>
            <h1 id="gender-onboarding-title">Укажите ваш пол</h1>
            <p>
              Это поможет настроить приложение и показать подходящие разделы. Вы сможете
              изменить выбор позже в профиле.
            </p>
          </div>
        </div>

        <div className="gender-options">
          <button type="button" disabled={saving} onClick={() => onSelect('male')}>
            <Mars aria-hidden="true" />
            Мужской
          </button>
          <button type="button" disabled={saving} onClick={() => onSelect('female')}>
            <Venus aria-hidden="true" />
            Женский
          </button>
        </div>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}

type ProfileMenuProps = {
  gender: Gender;
  isAdmin: boolean;
  adminActionLabel: string;
  saving: boolean;
  onGenderChange: (gender: Gender) => void;
  onAdminAction: () => void;
};

export function ProfileMenu({
  gender,
  isAdmin,
  adminActionLabel,
  saving,
  onGenderChange,
  onAdminAction
}: ProfileMenuProps) {
  return (
    <div className="profile-menu" role="dialog" aria-label="Профиль">
      <div className="profile-gender-actions" role="group" aria-label="Пол">
        <button
          type="button"
          aria-pressed={gender === 'male'}
          className={`profile-menu-action${gender === 'male' ? ' current' : ''}`}
          disabled={saving}
          onClick={() => onGenderChange('male')}
        >
          <Mars aria-hidden="true" />
          Мужской
        </button>
        <button
          type="button"
          aria-pressed={gender === 'female'}
          className={`profile-menu-action${gender === 'female' ? ' current' : ''}`}
          disabled={saving}
          onClick={() => onGenderChange('female')}
        >
          <Venus aria-hidden="true" />
          Женский
        </button>
      </div>
      {isAdmin ? (
        <button type="button" className="profile-menu-action" onClick={onAdminAction}>
          <Shield aria-hidden="true" />
          {adminActionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function CyclePanel() {
  return (
    <div className="panel empty cycle-placeholder">
      <CalendarDays aria-hidden="true" />
      <p>Функционал находится в разработке</p>
    </div>
  );
}
