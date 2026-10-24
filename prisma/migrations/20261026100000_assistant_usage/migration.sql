-- CreateEnum
CREATE TYPE "AssistantOutcome" AS ENUM ('RESERVED', 'OK', 'REFUSED', 'FAILED');

-- AlterTable
ALTER TABLE "AssistantSettings" ADD COLUMN     "dailyLimit" INTEGER NOT NULL DEFAULT 2000,
ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "AssistantUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "outcome" "AssistantOutcome" NOT NULL DEFAULT 'RESERVED',
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantUsage_userId_createdAt_idx" ON "AssistantUsage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AssistantUsage_createdAt_idx" ON "AssistantUsage"("createdAt");

-- AddForeignKey
ALTER TABLE "AssistantUsage" ADD CONSTRAINT "AssistantUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
