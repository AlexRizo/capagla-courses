-- CreateTable
CREATE TABLE "CostProduction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostProduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostProductionItem" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "CostProductionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostListEntry" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "placeKey" TEXT,
    "haveIt" BOOLEAN NOT NULL DEFAULT false,
    "bought" BOOLEAN NOT NULL DEFAULT false,
    "manualPacks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CostListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CostProduction_userId_expiresAt_idx" ON "CostProduction"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "CostProductionItem_productionId_idx" ON "CostProductionItem"("productionId");

-- CreateIndex
CREATE INDEX "CostProductionItem_productId_idx" ON "CostProductionItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CostList_productionId_key" ON "CostList"("productionId");

-- CreateIndex
CREATE INDEX "CostList_userId_idx" ON "CostList"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CostListEntry_listId_ingredientId_key" ON "CostListEntry"("listId", "ingredientId");

-- AddForeignKey
ALTER TABLE "CostProduction" ADD CONSTRAINT "CostProduction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostProductionItem" ADD CONSTRAINT "CostProductionItem_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "CostProduction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostProductionItem" ADD CONSTRAINT "CostProductionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CostProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostList" ADD CONSTRAINT "CostList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostList" ADD CONSTRAINT "CostList_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "CostProduction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostListEntry" ADD CONSTRAINT "CostListEntry_listId_fkey" FOREIGN KEY ("listId") REFERENCES "CostList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostListEntry" ADD CONSTRAINT "CostListEntry_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "CostIngredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
