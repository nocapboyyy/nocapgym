# Exercise Muscle Group Enum Design

## Goal

Unify exercise muscle groups so admins select one of eight predefined Russian categories instead of typing free text.

## Scope

The exercise catalog keeps the existing `muscleGroup` field name, but its values become a controlled enum:

- `neck` -> `Шея`
- `shoulders` -> `Плечи`
- `chest` -> `Грудь`
- `arms` -> `Руки`
- `abs` -> `Пресс`
- `back` -> `Спина`
- `glutes` -> `Ягодицы`
- `legs` -> `Ноги`

Existing `muscleGroup` values do not need to be preserved. The migration clears them to `NULL`, and the user will manually set new values for existing exercises after the update.

## Architecture

Add a Prisma `MuscleGroup` enum and make `Exercise.muscleGroup` nullable. API create and full exercise updates still require a valid enum value, while partial admin updates such as hiding an exercise may omit it. Public and admin exercise lists continue sorting by `muscleGroup` and then `name`.

The frontend defines the same union type and a single option list with Russian labels. Admin create/edit forms use `<select>` controls instead of text inputs. Existing exercises with `null` group display `Группа не выбрана`.

## Data Migration

SQLite migration rebuilds the `Exercise` table with `muscleGroup` nullable and copies all existing exercises with `muscleGroup` set to `NULL`. Related template/session rows continue referencing exercises by `id`.

## Error Handling

Backend Zod validation rejects any `muscleGroup` outside the enum. The admin UI prevents empty selection when creating or saving an exercise, except existing untouched rows can remain unset until edited.

## Testing

Add focused API tests that accept valid enum values, reject invalid values, and allow hide-only partial updates. Add frontend tests for the Russian muscle group labels and fallback display for missing groups. Run narrow API and web test files first, then typecheck both workspaces.
