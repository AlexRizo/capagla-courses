-- CreateEnum
CREATE TYPE "CostItemKind" AS ENUM ('INGREDIENT', 'PACKAGING');

-- CreateEnum
CREATE TYPE "CostUnit" AS ENUM ('G', 'KG', 'ML', 'L', 'PZA');

-- CreateTable
CREATE TABLE "CostPlace" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostIngredient" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CostItemKind" NOT NULL DEFAULT 'INGREDIENT',
    "placeId" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" "CostUnit" NOT NULL,
    "flexible" BOOLEAN NOT NULL DEFAULT false,
    "sampleCount" INTEGER,
    "sampleGrams" DECIMAL(14,3),
    "wasteEnabled" BOOLEAN NOT NULL DEFAULT false,
    "yieldPct" INTEGER,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CostPlace_userId_idx" ON "CostPlace"("userId");

-- CreateIndex
CREATE INDEX "CostIngredient_userId_archivedAt_idx" ON "CostIngredient"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "CostIngredient_placeId_idx" ON "CostIngredient"("placeId");

-- AddForeignKey
ALTER TABLE "CostPlace" ADD CONSTRAINT "CostPlace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostIngredient" ADD CONSTRAINT "CostIngredient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostIngredient" ADD CONSTRAINT "CostIngredient_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "CostPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
