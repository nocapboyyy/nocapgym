PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Exercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "muscleGroup" TEXT CHECK ("muscleGroup" IS NULL OR "muscleGroup" IN ('neck', 'shoulders', 'chest', 'arms', 'abs', 'back', 'glutes', 'legs')),
    "equipment" TEXT NOT NULL,
    "techniqueNote" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_Exercise" ("id", "name", "muscleGroup", "equipment", "techniqueNote", "isHidden", "createdAt", "updatedAt")
SELECT "id", "name", NULL, "equipment", "techniqueNote", "isHidden", "createdAt", "updatedAt"
FROM "Exercise";

DROP TABLE "Exercise";
ALTER TABLE "new_Exercise" RENAME TO "Exercise";

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
