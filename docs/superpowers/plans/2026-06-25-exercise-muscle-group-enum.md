# Exercise Muscle Group Enum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace free-text exercise muscle groups with a controlled eight-value enum while allowing existing exercises to be manually classified after deployment.

**Architecture:** Add a nullable Prisma enum field for `Exercise.muscleGroup`, clear existing values in a SQLite migration, validate admin create/update payloads with a shared backend enum schema, and render frontend admin controls from one typed option list. Existing exercise rows can temporarily have no group; new/saved exercises must choose one.

**Tech Stack:** Fastify, Zod, Prisma SQLite, React, TypeScript, Vitest.

---

### Task 1: Backend Enum Validation

**Files:**
- Modify: `apps/api/src/schemas.ts`
- Test: `apps/api/tests/exercises.test.ts`

- [ ] **Step 1: Write failing API tests**

Create `apps/api/tests/exercises.test.ts` with tests that post a valid `muscleGroup`, reject `custom`, and patch only `isHidden`.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -w apps/api -- exercises.test.ts`
Expected: FAIL because invalid free-text `muscleGroup` is still accepted.

- [ ] **Step 3: Implement minimal backend schema**

Add `muscleGroupSchema = z.enum(['neck', 'shoulders', 'chest', 'arms', 'abs', 'back', 'glutes', 'legs'])` and use it in `exercisePayloadSchema`.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -w apps/api -- exercises.test.ts`
Expected: PASS.

### Task 2: Prisma Enum And Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260625090000_exercise_muscle_group_enum/migration.sql`

- [ ] **Step 1: Update Prisma schema**

Add `enum MuscleGroup` with the eight code values and change `Exercise.muscleGroup` to `MuscleGroup?`.

- [ ] **Step 2: Add SQLite migration**

Rebuild `Exercise` with nullable `muscleGroup`, copy existing rows with `NULL` for that column, and recreate the previous table shape otherwise.

- [ ] **Step 3: Verify Prisma schema**

Run: `npm run typecheck -w apps/api`
Expected: PASS after Prisma client generation is available.

### Task 3: Frontend Types And Admin UI

**Files:**
- Modify: `apps/web/src/types.ts`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.test.ts`

- [ ] **Step 1: Write failing frontend tests**

Add tests for the muscle group option labels and `Группа не выбрана` fallback.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -w apps/web -- App.test.ts`
Expected: FAIL because helper exports and enum labels do not exist yet.

- [ ] **Step 3: Implement frontend enum helpers**

Add `MuscleGroup` type, `MUSCLE_GROUP_OPTIONS`, a fallback formatter, and replace admin text inputs with selects.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -w apps/web -- App.test.ts`
Expected: PASS.

### Task 4: Final Verification

**Files:**
- Modify only files already covered by Tasks 1-3.

- [ ] **Step 1: Run narrow checks**

Run: `npm test -w apps/api -- exercises.test.ts` and `npm test -w apps/web -- App.test.ts`
Expected: PASS.

- [ ] **Step 2: Run typechecks**

Run: `npm run typecheck -w apps/api` and `npm run typecheck -w apps/web`
Expected: PASS.

- [ ] **Step 3: Update durable docs if needed**

If implementation changes long-lived project facts, update `docs/ai/current-state.md` with the new admin exercise muscle group behavior.
