# User Gender And Personalized Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit user gender selection, gender-aware user navigation, a cycle placeholder for women, and profile-menu access to the admin screen.

**Architecture:** Store a nullable Prisma `Gender` on `User`, expose one authenticated self-update endpoint, and treat `null` as an incomplete onboarding state. Keep navigation rules in a small pure frontend module, put personalization UI in focused React components, and let `App` coordinate loading, gender updates, profile-menu state, and transitions between user tabs and the service-only admin view.

**Tech Stack:** Prisma 6 + SQLite, Fastify 5, Zod 3, React 19, TypeScript, Lucide React, Vitest, React server rendering for component tests.

---

## File Map

- `apps/api/prisma/schema.prisma` — define `Gender` and nullable `User.gender`.
- `apps/api/prisma/migrations/20260622090000_add_user_gender/migration.sql` — add the nullable SQLite column without rewriting existing values.
- `apps/api/src/schemas.ts` — validate gender update payloads.
- `apps/api/src/routes/users.ts` — own authenticated profile mutations.
- `apps/api/src/server.ts` — register the user route group.
- `apps/api/tests/users.test.ts` — verify authenticated updates and validation.
- `apps/web/src/types.ts` — mirror the nullable gender field in the web user type.
- `apps/web/src/navigation.ts` — define user tabs, app views, labels, visibility, and safe gender-change transitions.
- `apps/web/src/navigation.test.ts` — cover gender-specific navigation as pure behavior.
- `apps/web/src/UserPersonalization.tsx` — render onboarding, profile menu, and cycle placeholder.
- `apps/web/src/UserPersonalization.test.tsx` — verify Russian copy and conditional admin controls through static rendering.
- `apps/web/src/App.tsx` — orchestrate profile loading, deferred workout-data loading, menu interactions, admin entry/back behavior, and screen rendering.
- `apps/web/src/App.test.ts` — retain existing helpers and cover any App-level transition helper that cannot live in `navigation.ts`.
- `apps/web/src/styles.css` — style onboarding, profile popover, admin back control, cycle placeholder, and fixed icon-over-label tab bar.
- `apps/web/src/styles.test.ts` — lock in equal-width tabs, persistent vertical labels, touch targets, and safe-area behavior.
- `docs/ai/architecture.md`, `docs/ai/current-state.md`, `docs/ai/decisions.md` — record the shipped data flow, UX, and product decisions.

### Task 1: Add Nullable Gender To The User Model

**Files:**
- Modify: `apps/api/prisma/schema.prisma:9-30`
- Create: `apps/api/prisma/migrations/20260622090000_add_user_gender/migration.sql`

- [ ] **Step 1: Add the Prisma enum and nullable user field**

Insert the enum before `model User` and add `gender` without a default:

```prisma
enum Gender {
  male
  female
}

model User {
  id         String   @id @default(cuid())
  telegramId String   @unique
  firstName  String?
  lastName   String?
  username   String?
  gender     Gender?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  templates WorkoutTemplate[]
  sessions  WorkoutSession[]
}
```

- [ ] **Step 2: Add the SQLite migration**

Create the migration with this exact SQL so all existing rows remain `NULL`:

```sql
ALTER TABLE "User" ADD COLUMN "gender" TEXT;
```

- [ ] **Step 3: Generate the Prisma client**

Run:

```bash
npm run prisma:generate
```

Expected: Prisma Client generation succeeds and exposes `Gender`, `User.gender`, and gender update inputs.

- [ ] **Step 4: Validate the migration against a disposable SQLite database**

Run:

```bash
DATABASE_URL="file:/tmp/nocapgym-gender-plan.db" npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

Expected: both migrations apply successfully; no production or development database is modified.

- [ ] **Step 5: Commit the model and migration**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260622090000_add_user_gender/migration.sql
git commit -m "feat(api): add user gender field"
```

### Task 2: Add The Authenticated Gender Update Endpoint

**Files:**
- Modify: `apps/api/src/schemas.ts`
- Create: `apps/api/src/routes/users.ts`
- Modify: `apps/api/src/server.ts:1-40`
- Create: `apps/api/tests/users.test.ts`

- [ ] **Step 1: Write failing route tests**

Create `apps/api/tests/users.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { buildServer } from '../src/server.js';

function user(gender: 'male' | 'female' | null = null) {
  return {
    id: 'user-1',
    telegramId: '1001',
    firstName: 'Dev',
    lastName: null,
    username: 'dev_user',
    gender,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

function context(update = vi.fn()) {
  return {
    config: {
      botToken: 'dev-token',
      adminTelegramIds: '',
      port: 4000,
      allowDevAuth: true
    },
    prisma: {
      user: {
        upsert: vi.fn().mockResolvedValue(user()),
        update
      }
    } as any
  };
}

describe('user routes', () => {
  it.each(['male', 'female'] as const)('updates the authenticated user gender to %s', async (gender) => {
    const update = vi.fn().mockResolvedValue(user(gender));
    const app = await buildServer(context(update));

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/me',
      headers: { 'x-dev-telegram-id': '1001' },
      payload: { gender }
    });

    expect(response.statusCode).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { gender }
    });
    expect(response.json()).toMatchObject({ id: 'user-1', gender });
    await app.close();
  });

  it('rejects unsupported gender values without updating the user', async () => {
    const update = vi.fn();
    const app = await buildServer(context(update));

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/me',
      headers: { 'x-dev-telegram-id': '1001' },
      payload: { gender: 'unknown' }
    });

    expect(response.statusCode).toBe(400);
    expect(update).not.toHaveBeenCalled();
    await app.close();
  });
});
```

- [ ] **Step 2: Run the tests and verify the missing route failure**

Run:

```bash
npm test -w apps/api -- users.test.ts
```

Expected: FAIL because `PATCH /api/me` is not registered and returns 404.

- [ ] **Step 3: Add the request schema**

Append to `apps/api/src/schemas.ts`:

```ts
export const genderSchema = z.enum(['male', 'female']);

export const userGenderPayloadSchema = z.object({
  gender: genderSchema
});
```

- [ ] **Step 4: Implement the user route**

Create `apps/api/src/routes/users.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { userGenderPayloadSchema } from '../schemas.js';
import type { AppContext } from '../types.js';

export async function registerUserRoutes(app: FastifyInstance, context: AppContext) {
  app.patch('/api/me', async (request) => {
    const payload = userGenderPayloadSchema.parse(request.body);

    return context.prisma.user.update({
      where: { id: request.user!.id },
      data: { gender: payload.gender }
    });
  });
}
```

Register it in `apps/api/src/server.ts`:

```ts
import { registerUserRoutes } from './routes/users.js';
```

Place this immediately after `await registerAuth(app, context);` and before the other route groups:

```ts
await registerUserRoutes(app, context);
```

Keep the existing `GET /api/me` route unchanged.

- [ ] **Step 5: Run focused API tests**

Run:

```bash
npm test -w apps/api -- users.test.ts telegram.test.ts cors.test.ts
```

Expected: PASS; valid genders update `user-1`, invalid input returns 400, and auth/CORS regressions remain green.

- [ ] **Step 6: Typecheck the API**

Run:

```bash
npm run typecheck -w apps/api
```

Expected: PASS with the generated Prisma client.

- [ ] **Step 7: Commit the endpoint**

```bash
git add apps/api/src/schemas.ts apps/api/src/routes/users.ts apps/api/src/server.ts apps/api/tests/users.test.ts
git commit -m "feat(api): update authenticated user gender"
```

### Task 3: Define Gender-Aware Navigation As Pure Frontend Behavior

**Files:**
- Modify: `apps/web/src/types.ts:1-12`
- Create: `apps/web/src/navigation.ts`
- Create: `apps/web/src/navigation.test.ts`

- [ ] **Step 1: Add web gender typing**

Change the beginning of `apps/web/src/types.ts` to:

```ts
export type SetType = 'warmup' | 'working';
export type Gender = 'male' | 'female';

export type User = {
  id: string;
  telegramId: string;
  firstName: string | null;
  username: string | null;
  gender: Gender | null;
};
```

- [ ] **Step 2: Write failing navigation tests**

Create `apps/web/src/navigation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getSafeViewAfterGenderChange, getTabTitle, getVisibleUserTabs } from './navigation';

describe('gender-aware navigation', () => {
  it('shows the three core tabs to men', () => {
    expect(getVisibleUserTabs('male')).toEqual(['templates', 'session', 'history']);
  });

  it('adds cycle for women', () => {
    expect(getVisibleUserTabs('female')).toEqual(['templates', 'session', 'history', 'cycle']);
  });

  it('never exposes user tabs before gender onboarding', () => {
    expect(getVisibleUserTabs(null)).toEqual([]);
  });

  it('moves a male user away from cycle and preserves other views', () => {
    expect(getSafeViewAfterGenderChange('cycle', 'male')).toBe('templates');
    expect(getSafeViewAfterGenderChange('history', 'male')).toBe('history');
    expect(getSafeViewAfterGenderChange('admin', 'male')).toBe('admin');
  });

  it('provides Russian titles for user and service views', () => {
    expect(getTabTitle('templates')).toBe('Планы');
    expect(getTabTitle('session')).toBe('Зал');
    expect(getTabTitle('history')).toBe('История');
    expect(getTabTitle('cycle')).toBe('Цикл');
    expect(getTabTitle('admin')).toBe('Админ');
  });
});
```

- [ ] **Step 3: Verify the module is missing**

Run:

```bash
npm test -w apps/web -- navigation.test.ts
```

Expected: FAIL because `./navigation` does not exist.

- [ ] **Step 4: Implement the navigation module**

Create `apps/web/src/navigation.ts`:

```ts
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

const coreTabs: UserTab[] = ['templates', 'session', 'history'];

export function getTabTitle(view: AppView) {
  return tabLabels[view];
}

export function getVisibleUserTabs(gender: Gender | null): UserTab[] {
  if (gender === null) return [];
  return gender === 'female' ? [...coreTabs, 'cycle'] : [...coreTabs];
}

export function getSafeViewAfterGenderChange(view: AppView, gender: Gender): AppView {
  return view === 'cycle' && gender === 'male' ? 'templates' : view;
}
```

- [ ] **Step 5: Run navigation tests**

Run:

```bash
npm test -w apps/web -- navigation.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the shared frontend rules**

```bash
git add apps/web/src/types.ts apps/web/src/navigation.ts apps/web/src/navigation.test.ts
git commit -m "feat(web): define personalized navigation rules"
```

### Task 4: Build Focused Personalization Components

**Files:**
- Create: `apps/web/src/UserPersonalization.tsx`
- Create: `apps/web/src/UserPersonalization.test.tsx`

- [ ] **Step 1: Write failing static-render tests**

Create `apps/web/src/UserPersonalization.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CyclePanel, GenderOnboarding, ProfileMenu } from './UserPersonalization';

describe('GenderOnboarding', () => {
  it('requires an explicit Russian gender choice without a skip action', () => {
    const markup = renderToStaticMarkup(
      <GenderOnboarding saving={false} error="" onSelect={() => undefined} />
    );

    expect(markup).toContain('Укажите ваш пол');
    expect(markup).toContain('Мужской');
    expect(markup).toContain('Женский');
    expect(markup).not.toContain('Пропустить');
  });

  it('renders a retryable save error', () => {
    const markup = renderToStaticMarkup(
      <GenderOnboarding saving={false} error="Не удалось сохранить выбор" onSelect={() => undefined} />
    );

    expect(markup).toContain('Не удалось сохранить выбор');
  });
});

describe('ProfileMenu', () => {
  it('shows gender controls and hides admin from regular users', () => {
    const markup = renderToStaticMarkup(
      <ProfileMenu gender="male" isAdmin={false} saving={false} onGenderChange={() => undefined} onOpenAdmin={() => undefined} />
    );

    expect(markup).toContain('Мужской');
    expect(markup).toContain('Женский');
    expect(markup).not.toContain('Админка');
  });

  it('shows admin access to administrators', () => {
    const markup = renderToStaticMarkup(
      <ProfileMenu gender="female" isAdmin saving={false} onGenderChange={() => undefined} onOpenAdmin={() => undefined} />
    );

    expect(markup).toContain('Админка');
  });
});

describe('CyclePanel', () => {
  it('renders only the development placeholder', () => {
    const markup = renderToStaticMarkup(<CyclePanel />);
    expect(markup).toContain('Функционал находится в разработке');
  });
});
```

- [ ] **Step 2: Verify the component module is missing**

Run:

```bash
npm test -w apps/web -- UserPersonalization.test.tsx
```

Expected: FAIL because `./UserPersonalization` does not exist.

- [ ] **Step 3: Implement the components**

Create `apps/web/src/UserPersonalization.tsx`:

```tsx
import { CalendarDays, Mars, Shield, Venus } from 'lucide-react';
import type { Gender } from './types';

export function GenderOnboarding(props: {
  saving: boolean;
  error: string;
  onSelect: (gender: Gender) => void;
}) {
  return (
    <main className="gender-onboarding">
      <section className="gender-card" aria-labelledby="gender-title">
        <span className="eyebrow">ДОБРО ПОЖАЛОВАТЬ</span>
        <h1 id="gender-title">Укажите ваш пол</h1>
        <p className="muted">Это нужно, чтобы настроить возможности приложения. Вы сможете изменить выбор позже.</p>
        {props.error && <p className="form-error" role="alert">{props.error}</p>}
        <button disabled={props.saving} onClick={() => props.onSelect('male')}>
          <Mars size={20} /> Мужской
        </button>
        <button disabled={props.saving} onClick={() => props.onSelect('female')}>
          <Venus size={20} /> Женский
        </button>
      </section>
    </main>
  );
}

export function ProfileMenu(props: {
  gender: Gender;
  isAdmin: boolean;
  saving: boolean;
  onGenderChange: (gender: Gender) => void;
  onOpenAdmin: () => void;
}) {
  return (
    <div className="profile-menu" role="menu" aria-label="Меню профиля">
      <span className="profile-menu-label">Пол</span>
      <button className={props.gender === 'male' ? 'selected' : ''} disabled={props.saving} onClick={() => props.onGenderChange('male')}>
        <Mars size={18} /> Мужской
      </button>
      <button className={props.gender === 'female' ? 'selected' : ''} disabled={props.saving} onClick={() => props.onGenderChange('female')}>
        <Venus size={18} /> Женский
      </button>
      {props.isAdmin && (
        <button className="profile-admin-action" onClick={props.onOpenAdmin}>
          <Shield size={18} /> Админка
        </button>
      )}
    </div>
  );
}

export function CyclePanel() {
  return (
    <section className="panel empty cycle-placeholder">
      <CalendarDays size={28} aria-hidden="true" />
      <p>Функционал находится в разработке</p>
    </section>
  );
}
```

- [ ] **Step 4: Run component tests**

Run:

```bash
npm test -w apps/web -- UserPersonalization.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit the components**

```bash
git add apps/web/src/UserPersonalization.tsx apps/web/src/UserPersonalization.test.tsx
git commit -m "feat(web): add gender personalization UI"
```

### Task 5: Integrate Onboarding, Profile Menu, Tabs, Cycle, And Admin Navigation

**Files:**
- Modify: `apps/web/src/App.tsx:1-530`
- Modify: `apps/web/src/App.test.ts:1-170`

- [ ] **Step 1: Move App tests to the shared navigation module and add calendar visibility coverage**

Replace the `getTabTitle` import from `./App` with an import from `./navigation`, and import `getPlansCalendarVisible` from `./App` as before. Update the calendar test to include the new views:

```ts
describe('getPlansCalendarVisible', () => {
  it('shows the plans calendar on the templates tab only', () => {
    expect(getPlansCalendarVisible('templates')).toBe(true);
    expect(getPlansCalendarVisible('session')).toBe(false);
    expect(getPlansCalendarVisible('history')).toBe(false);
    expect(getPlansCalendarVisible('cycle')).toBe(false);
    expect(getPlansCalendarVisible('admin')).toBe(false);
  });
});
```

Delete the old `getTabTitle` test from `App.test.ts`; `navigation.test.ts` now owns it.

- [ ] **Step 2: Run App tests and verify the new view type is unsupported**

Run:

```bash
npm test -w apps/web -- App.test.ts navigation.test.ts
```

Expected: FAIL until `App.tsx` uses `AppView` and accepts `cycle`.

- [ ] **Step 3: Replace local tab types and metadata imports**

In `apps/web/src/App.tsx`, add `CalendarDays` and `UserRound` to the Lucide imports, remove `Shield` from tab metadata use, and add:

```ts
import { CyclePanel, GenderOnboarding, ProfileMenu } from './UserPersonalization';
import {
  getSafeViewAfterGenderChange,
  getTabTitle,
  getVisibleUserTabs,
  type AppView,
  type UserTab
} from './navigation';
import type { Gender } from './types';
```

Remove the local `Tab`, `tabLabels`, and `getTabTitle` declarations. Change the helper signature to:

```ts
export function getPlansCalendarVisible(view: AppView) {
  return view === 'templates';
}
```

Add icon metadata outside `App`:

```ts
const userTabMetadata = {
  templates: { label: getTabTitle('templates'), icon: Dumbbell },
  session: { label: getTabTitle('session'), icon: Activity },
  history: { label: getTabTitle('history'), icon: History },
  cycle: { label: getTabTitle('cycle'), icon: CalendarDays }
} satisfies Record<UserTab, { label: string; icon: typeof Dumbbell }>;
```

- [ ] **Step 4: Add App state and refs**

Replace `tab` state with these declarations:

```ts
const [view, setView] = useState<AppView>('templates');
const [profileMenuOpen, setProfileMenuOpen] = useState(false);
const [savingGender, setSavingGender] = useState(false);
const [genderError, setGenderError] = useState('');
const profileMenuRef = useRef<HTMLDivElement | null>(null);
const previousUserTabRef = useRef<UserTab>('templates');
```

Update existing `setTab('session')` and `setTab('history')` calls to `setView(...)`.

- [ ] **Step 5: Defer workout data until gender is configured**

Replace `loadInitialData` with two functions:

```ts
async function loadWorkoutData(admin: boolean) {
  const [exerciseList, templateList, historyList] = await Promise.all([
    api.get<Exercise[]>('/api/exercises'),
    api.get<WorkoutTemplate[]>('/api/templates'),
    api.get<WorkoutSession[]>('/api/history')
  ]);

  setExercises(exerciseList);
  setTemplates(templateList);
  setHistory(historyList);
  if (admin) {
    setAdminExercises(await api.get<Exercise[]>('/api/admin/exercises'));
  }
}

async function loadInitialData() {
  setLoading(true);
  const me = await api.get<{ user: User; isAdmin: boolean }>('/api/me');
  setUser(me.user);
  setIsAdmin(me.isAdmin);

  if (me.user.gender !== null) {
    await loadWorkoutData(me.isAdmin);
  }

  setLoading(false);
}
```

This ensures existing users with `gender: null` see onboarding before workout endpoints are loaded.

- [ ] **Step 6: Add gender save and view-transition handlers**

Add inside `App`:

```ts
async function saveGender(gender: Gender) {
  if (!user || user.gender === gender) {
    setProfileMenuOpen(false);
    return;
  }

  const wasUnconfigured = user.gender === null;
  setSavingGender(true);
  setGenderError('');

  try {
    const updatedUser = await api.patch<User>('/api/me', { gender });
    setUser(updatedUser);
    setView((current) => getSafeViewAfterGenderChange(current, gender));
    setProfileMenuOpen(false);
  } catch {
    setGenderError('Не удалось сохранить выбор. Попробуйте ещё раз.');
    setSavingGender(false);
    return;
  }

  setSavingGender(false);

  if (wasUnconfigured) {
    setLoading(true);
    try {
      await loadWorkoutData(isAdmin);
    } catch {
      setMessage('Не удалось загрузить данные. Перезапустите приложение.');
    } finally {
      setLoading(false);
    }
  }
}

function openAdmin() {
  if (!isAdmin) return;
  if (view !== 'admin') previousUserTabRef.current = view;
  setProfileMenuOpen(false);
  setView('admin');
}

function closeAdmin() {
  setView(previousUserTabRef.current);
}
```

Immediately after a successful configured-user load, user navigation begins at `templates`; no persisted tab state is introduced.

- [ ] **Step 7: Add outside-press and Escape dismissal**

Add this effect inside `App`:

```ts
useEffect(() => {
  if (!profileMenuOpen) return;

  function closeOnOutsidePress(event: PointerEvent) {
    if (!profileMenuRef.current?.contains(event.target as Node)) {
      setProfileMenuOpen(false);
    }
  }

  function closeOnEscape(event: globalThis.KeyboardEvent) {
    if (event.key === 'Escape') setProfileMenuOpen(false);
  }

  document.addEventListener('pointerdown', closeOnOutsidePress);
  document.addEventListener('keydown', closeOnEscape);
  return () => {
    document.removeEventListener('pointerdown', closeOnOutsidePress);
    document.removeEventListener('keydown', closeOnEscape);
  };
}, [profileMenuOpen]);
```

- [ ] **Step 8: Render the onboarding gate**

After the loading return and before the normal app shell, add:

```tsx
if (user?.gender === null) {
  return (
    <GenderOnboarding
      saving={savingGender}
      error={genderError}
      onSelect={(gender) => void saveGender(gender)}
    />
  );
}
```

At this point `user?.gender` is `male` or `female` in the normal shell.

- [ ] **Step 9: Render the profile menu and admin back action**

Replace the top bar with:

```tsx
<header className="topbar">
  <div className="topbar-title">
    {view === 'admin' && (
      <button className="icon-button admin-back" aria-label="Вернуться из админки" onClick={closeAdmin}>
        <ArrowLeft size={18} />
      </button>
    )}
    <div>
      <span className="eyebrow">NOCAPGYM</span>
      <h1>{getTabTitle(view)}</h1>
    </div>
  </div>
  <div className="profile-menu-anchor" ref={profileMenuRef}>
    <button
      className="profile"
      aria-haspopup="menu"
      aria-expanded={profileMenuOpen}
      onClick={() => setProfileMenuOpen((open) => !open)}
    >
      <UserRound size={16} />
      <span>{user?.firstName ?? user?.username ?? 'Пользователь'}</span>
    </button>
    {profileMenuOpen && user && (
      <ProfileMenu
        gender={user.gender!}
        isAdmin={isAdmin}
        saving={savingGender}
        onGenderChange={(gender) => void saveGender(gender)}
        onOpenAdmin={openAdmin}
      />
    )}
  </div>
</header>
```

- [ ] **Step 10: Render only gender-appropriate user tabs**

Replace the existing `tabs` memo with:

```ts
const tabs = useMemo(
  () => getVisibleUserTabs(user?.gender ?? null).map((id) => ({ id, ...userTabMetadata[id] })),
  [user?.gender]
);
```

Render the tab bar only on user views:

```tsx
{view !== 'admin' && (
  <nav className="tabbar" aria-label="Основная навигация">
    {tabs.map((item) => (
      <button
        key={item.id}
        className={view === item.id ? 'active' : ''}
        aria-current={view === item.id ? 'page' : undefined}
        onClick={() => setView(item.id)}
      >
        <item.icon size={20} />
        <span>{item.label}</span>
      </button>
    ))}
  </nav>
)}
```

- [ ] **Step 11: Update screen conditions and add cycle rendering**

Rename all render checks from `tab` to `view`, then add:

```tsx
{view === 'cycle' && user?.gender === 'female' && <CyclePanel />}
```

Keep admin guarded at render time:

```tsx
{view === 'admin' && isAdmin && (
  <AdminPanel
    exercises={adminExercises}
    reload={async () => {
      setAdminExercises(await api.get<Exercise[]>('/api/admin/exercises'));
      setExercises(await api.get<Exercise[]>('/api/exercises'));
    }}
  />
)}
```

Use `getPlansCalendarVisible(view)` for the week calendar.

- [ ] **Step 12: Run focused frontend tests and typecheck**

Run:

```bash
npm test -w apps/web -- App.test.ts navigation.test.ts UserPersonalization.test.tsx
npm run typecheck -w apps/web
```

Expected: PASS; App recognizes all five views, personalization components render, and navigation rules remain type-safe.

- [ ] **Step 13: Commit the integrated behavior**

```bash
git add apps/web/src/App.tsx apps/web/src/App.test.ts
git commit -m "feat(web): personalize app navigation by gender"
```

### Task 6: Style The Approved Mobile Navigation And Profile Surfaces

**Files:**
- Modify: `apps/web/src/styles.css:149-250,986-1000`
- Modify: `apps/web/src/styles.test.ts`

- [ ] **Step 1: Write failing CSS contract tests**

Append to `apps/web/src/styles.test.ts`:

```ts
describe('personalized navigation layout', () => {
  it('keeps every tab equal width with icon above label', () => {
    const tabbar = cssRule('.tabbar');
    const button = cssRule('.tabbar button');

    expect(tabbar).toContain('grid-auto-columns: minmax(0, 1fr)');
    expect(tabbar).toContain('grid-auto-flow: column');
    expect(button).toContain('flex-direction: column');
    expect(button).toContain('min-height: 56px');
  });

  it('uses a stable active state without resizing content', () => {
    const active = cssRule('.tabbar button.active');

    expect(active).toContain('color: var(--powder-petal)');
    expect(active).toContain('background: rgba(255, 181, 167, 0.12)');
  });

  it('keeps profile and gender actions touch friendly', () => {
    expect(cssRule('.profile')).toContain('min-height: 44px');
    expect(cssRule('.profile-menu button')).toContain('min-height: 44px');
  });

  it('preserves iPhone safe-area positioning', () => {
    expect(cssRule('.tabbar')).toContain('env(safe-area-inset-bottom, 0px)');
  });
});
```

- [ ] **Step 2: Run CSS tests and verify they fail**

Run:

```bash
npm test -w apps/web -- styles.test.ts
```

Expected: FAIL because the current tab bar uses four fixed columns and horizontal button content.

- [ ] **Step 3: Replace tab-bar layout rules**

Update the relevant rules in `apps/web/src/styles.css`:

```css
.tabbar {
  position: fixed;
  left: 50%;
  bottom: max(22px, calc(env(safe-area-inset-bottom, 0px) + 16px));
  z-index: 10;
  width: min(732px, calc(100% - 32px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: 4px;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #171516;
  transform: translateX(-50%);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.42);
}

.tabbar button {
  min-width: 0;
  min-height: 56px;
  flex-direction: column;
  gap: 4px;
  padding: 5px 4px;
  border-radius: 8px;
  color: var(--muted);
  background: transparent;
  box-shadow: none;
  font-size: 11px;
  font-weight: 730;
}

.tabbar button.active {
  color: var(--powder-petal);
  background: rgba(255, 181, 167, 0.12);
}
```

Delete both fixed `grid-template-columns: repeat(4, ...)` declarations, including the mobile media-query override.

- [ ] **Step 4: Add onboarding and profile-menu styles**

Add:

```css
.gender-onboarding {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: max(18px, env(safe-area-inset-top, 0px)) 14px max(18px, env(safe-area-inset-bottom, 0px));
}

.gender-card {
  width: min(420px, 100%);
  display: grid;
  gap: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 20px;
  background: var(--panel);
}

.gender-card button {
  min-height: 52px;
  justify-content: flex-start;
}

.form-error {
  color: var(--powder-petal);
  font-size: 13px;
}

.topbar-title,
.profile,
.profile-menu button,
.cycle-placeholder {
  display: flex;
  align-items: center;
}

.topbar-title {
  gap: 8px;
}

.profile {
  min-height: 44px;
  gap: 7px;
}

.profile-menu-anchor {
  position: relative;
  max-width: 48%;
}

.profile-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 20;
  width: 210px;
  display: grid;
  gap: 4px;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 7px;
  background: var(--panel-2);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.44);
}

.profile-menu-label {
  padding: 5px 9px 2px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.profile-menu button {
  min-height: 44px;
  justify-content: flex-start;
  gap: 8px;
  color: var(--almond-silk);
  background: transparent;
  box-shadow: none;
}

.profile-menu button.selected {
  color: var(--powder-petal);
  background: rgba(255, 181, 167, 0.12);
}

.profile-admin-action {
  border-top: 1px solid var(--line);
}

.admin-back {
  min-width: 44px;
  min-height: 44px;
}

.cycle-placeholder {
  min-height: 220px;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
}
```

- [ ] **Step 5: Run CSS and focused web tests**

Run:

```bash
npm test -w apps/web -- styles.test.ts App.test.ts navigation.test.ts UserPersonalization.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the approved visual treatment**

```bash
git add apps/web/src/styles.css apps/web/src/styles.test.ts
git commit -m "style(web): adopt labeled mobile tab bar"
```

### Task 7: Update Durable Project Documentation

**Files:**
- Modify: `docs/ai/architecture.md`
- Modify: `docs/ai/current-state.md`
- Modify: `docs/ai/decisions.md`

- [ ] **Step 1: Update architecture facts**

Add these compact facts to `docs/ai/architecture.md`:

```md
- `routes/users.ts` - authenticated profile updates, currently the user's gender.
```

Under Auth And Access, add:

```md
- `User.gender` is nullable in storage for migration safety; `null` blocks app onboarding until the user explicitly selects `male` or `female`.
- `PATCH /api/me` updates only the authenticated user's gender.
```

Under Frontend, replace the admin screen bullet and add cycle/navigation notes:

```md
- `Цикл` - female-only placeholder screen; no cycle data is stored yet.
- `Админ` - service screen opened from the profile menu, not a bottom-navigation tab.

The bottom navigation always shows icon-over-label user tabs. Gender controls which user tabs are available; backend authorization remains authoritative for admin APIs.
```

- [ ] **Step 2: Update current state**

Add to Working Features in `docs/ai/current-state.md`:

```md
- Explicit male/female onboarding for new and migrated users without a configured gender.
- Gender-aware bottom navigation with persistent icon-over-label tab labels.
- Female users receive a `Цикл` placeholder tab; cycle tracking remains unimplemented.
- Profile menu supports gender changes and provides admin entry only to admins.
```

Add to Known Risks / Watch Areas:

```md
- Gender onboarding, profile popover positioning, and three-versus-four-item tab bars require real-device Telegram QA on iOS and Android.
```

Set `Last updated` to `2026-06-22`.

- [ ] **Step 3: Record the decisions**

Append to `docs/ai/decisions.md`:

```md
## 2026-06-22 - Gender Is Explicit User-Provided Account Data

Decision: store nullable `male` or `female` on `User`; require users with no value to choose and allow later changes.

Reason: Telegram does not provide gender, and existing users must not receive a guessed value.

Consequence: `null` is a migration/onboarding state; female users receive the cycle tab, while workout backups remain unchanged.

## 2026-06-22 - Admin Is Outside Primary Navigation

Decision: open the admin screen from the profile menu instead of the bottom tab bar.

Reason: primary navigation should contain only everyday user workflows and remain stable across roles.

Consequence: the admin action is conditionally visible, but backend `requireAdmin` checks remain mandatory.
```

- [ ] **Step 4: Review documentation for duplication**

Run:

```bash
rg -n "gender|Gender|Цикл|Админ" docs/ai
```

Expected: each durable fact appears in the appropriate architecture, state, or decision section without copying implementation-level details.

- [ ] **Step 5: Commit documentation**

```bash
git add docs/ai/architecture.md docs/ai/current-state.md docs/ai/decisions.md
git commit -m "docs: record personalized user navigation"
```

### Task 8: Full Verification And Manual Handoff

**Files:**
- Verify only; no planned source changes

- [ ] **Step 1: Run all automated checks**

Run:

```bash
npm run typecheck -w apps/api
npm run typecheck -w apps/web
npm test
npm run build
```

Expected: all commands exit 0. The build regenerates Prisma Client before compiling the API.

- [ ] **Step 2: Inspect the final working tree**

Run:

```bash
git status --short
git diff --check
```

Expected: no uncommitted files from this feature and no whitespace errors. Preserve the user's pre-existing `.gitignore` and unrelated untracked design/plan documents.

- [ ] **Step 3: Perform local mobile-browser checks**

Run the app:

```bash
npm run dev
```

Verify at a narrow mobile viewport:

1. A user with `gender = null` sees only the blocking choice and can retry a simulated failed request.
2. Choosing male produces three equal icon-over-label tabs.
3. Choosing female produces four equal tabs and a calendar-icon `Цикл` placeholder.
4. Changing female to male while on `Цикл` returns to `Планы`.
5. Clicking the profile badge opens the gender menu; outside press and Escape close it.
6. A regular user never sees `Админка`.
7. An admin opens admin from the profile menu and returns to the previous user tab.
8. Focusing workout inputs still hides only the bottom tab bar.

Expected: all eight behaviors work without horizontal overflow or content being hidden behind the safe-area tab bar.

- [ ] **Step 4: Record remaining device QA**

In the implementation handoff, explicitly request Telegram testing on one real iPhone and one real Android device for:

- safe-area bottom spacing;
- profile popover placement;
- tab touch targets with three and four items;
- keyboard show/hide behavior during workout editing;
- first-run selection after a production migration.
