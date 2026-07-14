CREATE UNIQUE INDEX "WorkoutSession_one_active_per_user"
ON "WorkoutSession"("userId")
WHERE "status" = 'active';
