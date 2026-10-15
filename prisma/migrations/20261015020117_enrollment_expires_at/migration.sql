-- Inscripciones existentes: 365 días desde su creación.
ALTER TABLE "Enrollment" ADD COLUMN "expiresAt" TIMESTAMP(3);
UPDATE "Enrollment" SET "expiresAt" = "createdAt" + INTERVAL '365 days';
ALTER TABLE "Enrollment" ALTER COLUMN "expiresAt" SET NOT NULL;
