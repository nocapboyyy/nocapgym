# Plans Current Week Calendar Design

## Goal

Replace the four-metric dashboard strip with a compact current-week calendar on the `Планы` tab. Remove the metric strip from `Зал` and `История` without adding a replacement there.

## User Value

The plans screen will surface recent workout activity in a form that is easier to scan than aggregate counts and prepares the product for a separate history calendar later.

## Scope

In scope:

- A static Monday-to-Sunday calendar for the device's current week.
- The current month name at the top-left of the calendar card.
- Accent styling for the current day.
- Muted styling for dates outside the current month, including both month-transition directions.
- One Lucide dumbbell indicator on each day that has at least one completed workout whose `startedAt` falls on that local calendar date.
- Removal of the existing metric strip from every tab.
- Automated tests for week calculation and workout-day matching.

Out of scope:

- Week or month navigation.
- Clickable calendar days.
- Opening workout details from the calendar.
- A calendar or replacement summary on `Зал` or `История`.
- API or database changes.

## UX Design

The selected direction is a single contained card matching the existing NocapGym panels: dark panel background, existing border and radius, and compact spacing suitable for 320 px mobile widths.

The month heading uses the device's current month in Russian. Seven equal-width columns show the date number and the short Russian weekday name. The current day uses the existing `--powder-blush` accent background with dark foreground text. Days whose month differs from the current day use the existing soft text color. Workout indicators remain visible even when their day belongs to an adjacent month.

The indicator uses the existing Lucide `Dumbbell` icon. The calendar and workout indicators receive accessible Russian labels; the icon is supplementary rather than the only accessible description of the day.

## Data And Date Rules

The component receives completed workout history already loaded by the app. No new endpoint is required.

Week boundaries, current-day comparison, month comparison, and workout-day matching use the browser's local timezone. The week always begins on Monday. A workout contributes an indicator only when its session status is `completed`; its day is determined from `startedAt`, not `completedAt`. Multiple completed workouts on the same local date still produce one indicator.

The month heading always names the current day’s month. Therefore, before a month transition, next-month dates are muted; after the transition, previous-month dates are muted.

## Component Boundaries

- A pure date helper builds the seven calendar-day view models and marks local dates that contain completed workouts.
- A small React calendar component renders the view model and contains no navigation state.
- `App` renders the calendar only when the active tab is `templates`; the old dashboard-strip calculations and markup are removed.

## Error Handling

The calendar does not introduce a separate loading or error state. It follows the existing history-loading lifecycle. Missing or empty history renders a normal current week with no workout indicators. Invalid session timestamps are ignored for indicator matching rather than breaking the calendar.

## Verification

Automated coverage will verify:

- Monday-through-Sunday ordering for dates in the middle of a week.
- Correct week boundaries when today is Sunday.
- Both directions of a month transition.
- Current-day and adjacent-month flags.
- Completed sessions are matched by local `startedAt` date.
- Active sessions and invalid timestamps do not create indicators.
- Multiple completed sessions on one date create one indicator.

Run the focused web tests first, then web typecheck and the project build. Check the layout at a narrow mobile viewport in the local browser. A real Telegram iOS device check remains recommended because local browser rendering cannot fully validate Telegram WebView behavior.

## Documentation

Update `docs/ai/current-state.md` to record the new plans-week calendar and removal of the shared dashboard strip. No architecture or product-scope decision changes are expected.
