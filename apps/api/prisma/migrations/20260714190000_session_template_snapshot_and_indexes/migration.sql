ALTER TABLE "WorkoutSession" ADD COLUMN "templateNameSnapshot" TEXT;

UPDATE "WorkoutSession"
SET "templateNameSnapshot" = (
  SELECT "WorkoutTemplate"."name"
  FROM "WorkoutTemplate"
  WHERE "WorkoutTemplate"."id" = "WorkoutSession"."templateId"
)
WHERE "templateId" IS NOT NULL;

CREATE INDEX "WorkoutTemplate_userId_updatedAt_idx"
ON "WorkoutTemplate"("userId", "updatedAt");

CREATE INDEX "TemplateExercise_templateId_order_idx"
ON "TemplateExercise"("templateId", "order");

CREATE INDEX "TemplateExercise_exerciseId_idx"
ON "TemplateExercise"("exerciseId");

CREATE INDEX "TemplateSet_templateExerciseId_order_idx"
ON "TemplateSet"("templateExerciseId", "order");

CREATE INDEX "WorkoutSession_userId_status_completedAt_idx"
ON "WorkoutSession"("userId", "status", "completedAt");

CREATE INDEX "WorkoutSession_templateId_idx"
ON "WorkoutSession"("templateId");

CREATE INDEX "SessionExercise_sessionId_order_idx"
ON "SessionExercise"("sessionId", "order");

CREATE INDEX "SessionExercise_exerciseId_sessionId_idx"
ON "SessionExercise"("exerciseId", "sessionId");

CREATE INDEX "SessionSet_sessionExerciseId_order_idx"
ON "SessionSet"("sessionExerciseId", "order");
