# User Gender And Personalized Navigation Design

## Goal

Add a user gender attribute that personalizes the bottom navigation, introduce a placeholder cycle screen for women, and move admin access out of the primary navigation.

## User Value

Users receive navigation relevant to them without exposing unfinished cycle functionality to men. The primary navigation remains focused on everyday workout flows, while administrators retain a clear but less prominent route to catalog management.

## Scope

In scope:

- store `male` or `female` on each user account;
- require new and existing users without a value to select gender before using the app;
- allow users to change gender later from the profile menu;
- show `Планы`, `Зал`, and `История` to all users;
- show an additional `Цикл` tab with a calendar icon to women;
- show a development placeholder on the cycle screen;
- display every bottom-navigation item as an icon above a persistent label;
- move the admin entry point from the bottom navigation into the profile menu;
- preserve backend admin authorization.

Out of scope:

- cycle tracking, calendar data, notifications, or health information;
- additional gender values or automatic gender inference;
- a full profile/settings screen;
- changes to workout backup contents;
- changes to Telegram authentication or admin whitelist rules.

## Decisions And Alternatives

### Existing users

Selected: add a nullable gender field and require every user with `null` to choose on the next launch. This avoids guessing and treats new and existing users consistently.

Rejected:

- default existing users to `male`, because it silently stores potentially incorrect personal data;
- populate existing users manually, because it is operationally fragile and does not scale.

### Admin entry point

Selected: clicking the name in the top bar opens a compact profile menu containing gender controls and, for administrators only, an `Админка` action.

Rejected:

- a persistent shield button in the top bar, because it competes for space on narrow screens;
- a standalone profile screen, because the current settings surface is too small to justify another route.

### Bottom navigation

Selected: use a conventional mobile tab bar. Every item always shows its icon above its label. The active item uses the existing powder-blush palette and a subtle background.

Rejected: icon-only inactive items with an expanding active label. The changing widths created unnecessary movement and reduced visual predictability.

## Data Model And Migration

Add a Prisma `Gender` enum with `male` and `female`, then add `User.gender Gender?`.

The database column remains nullable so the migration can preserve every existing account without inventing a value. Application behavior gives the field its required semantics: `null` means onboarding is incomplete and blocks access to the working UI.

Telegram auth continues to upsert account identity fields without overwriting gender. Gender is account metadata and is not added to workout export/import payloads.

## API

`GET /api/me` continues to return the authenticated user and `isAdmin`; the returned user now includes `gender`.

Add `PATCH /api/me` with this request body:

```json
{
  "gender": "male"
}
```

The endpoint:

- accepts only `male` or `female`;
- updates `request.user.id`, never a client-supplied user ID;
- returns the updated user;
- returns a validation error for any other value;
- requires the existing Telegram authentication hook.

Admin catalog endpoints retain their existing backend `requireAdmin` enforcement. Moving the UI entry point does not change authorization.

## Frontend State And Navigation

Separate user-facing tabs from the admin screen:

- user tabs: `templates`, `session`, `history`, and conditionally `cycle`;
- service screen: `admin`, reachable only from the profile menu when `isAdmin` is true.

After initial data loads:

1. If `user.gender` is `null`, render the blocking gender selection screen.
2. Save the selection through `PATCH /api/me`.
3. Replace local user state with the returned user.
4. Render the normal application shell and the gender-appropriate tabs.

Changing gender from the profile menu uses the same endpoint and updates navigation immediately. If the current tab is `cycle` and gender changes to `male`, switch to `templates` before removing the cycle tab.

Opening admin stores the current user tab. The admin screen provides a back action that restores that tab. The admin screen is never included in the bottom tab bar.

## UI Behavior

### First-run gender selection

Show a full-screen, non-dismissible choice with:

- title `Укажите ваш пол`;
- short explanation that the value personalizes app features and can be changed later;
- two large touch targets: `Мужской` and `Женский`;
- no preselected value and no skip action.

While saving, prevent duplicate submissions. On failure, keep the selector visible, restore its controls, and show a retryable Russian error message.

### Profile menu

The existing name badge becomes a button. Its popover shows the current gender and allows switching between `Мужской` and `Женский`. Administrators additionally see `Админка`.

The menu closes after an action, on outside press, and on Escape in browser contexts. Controls use accessible names and maintain mobile touch-target sizing.

### Bottom tab bar

All visible tabs have equal width. Each tab always displays a Lucide icon above a Russian label:

- `Планы` — Dumbbell;
- `Зал` — Activity;
- `История` — History;
- `Цикл` — CalendarDays.

The active tab is distinguished by color and a subtle background, not by changing size or content. The existing fixed positioning, keyboard hiding, and iPhone safe-area behavior remain intact.

### Cycle placeholder

The cycle screen uses the standard panel styling and displays `Функционал находится в разработке`. It contains no inputs, calendar state, or persisted data.

## Error And Edge Cases

- A failed initial gender update leaves onboarding visible and retryable.
- A failed profile update preserves the previous gender and current navigation.
- A stale client cannot obtain admin access through navigation state; the backend remains authoritative.
- A male user cannot navigate to `cycle` through the rendered UI.
- If local state ever contains `cycle` while the user is male, normalize the active tab to `templates`.
- Existing workout data is untouched by the migration and onboarding choice.

## Verification

Automated coverage should verify:

- Prisma/user typing includes nullable gender;
- `PATCH /api/me` accepts both valid values, rejects invalid values, and updates only the authenticated user;
- the onboarding gate appears for `null` and disappears after a successful save;
- male and female users receive the correct tab sets;
- every tab keeps both icon and label visible;
- changing from female to male while on `cycle` redirects to `templates`;
- admin is absent from the tab bar and present in the profile menu only for admins;
- the cycle placeholder renders its Russian message;
- existing keyboard-driven tab-bar hiding remains covered.

Run focused tests first, followed by:

```bash
npm run typecheck -w apps/api
npm run typecheck -w apps/web
npm test
npm run build
```

Manually verify male, female, unconfigured, and admin states in a local mobile viewport. Retest tab-bar safe areas and profile-menu interaction in Telegram on real iOS and Android devices because local browser behavior cannot fully reproduce their WebViews.

## Documentation Updates During Implementation

- update `docs/ai/architecture.md` with the user gender field, profile update endpoint, and navigation structure;
- update `docs/ai/current-state.md` with onboarding, personalized navigation, the cycle placeholder, and real-device QA risk;
- add a compact entry to `docs/ai/decisions.md` covering explicit gender selection and profile-based admin access;
- leave `docs/ai/project-brief.md` unchanged because the feature remains within personal workout-app scope.
