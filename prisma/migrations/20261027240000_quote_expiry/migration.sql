-- AlterTable
ALTER TABLE "CostQuote" ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "quotedFloor" DECIMAL(12,2);

-- Las que ya existían vencen 90 días después de su último guardado.
UPDATE "CostQuote" SET "expiresAt" = "updatedAt" + INTERVAL '90 days';

-- AlterTable
ALTER TABLE "CostQuote" ALTER COLUMN "expiresAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX "CostQuote_userId_expiresAt_idx" ON "CostQuote"("userId", "expiresAt");
