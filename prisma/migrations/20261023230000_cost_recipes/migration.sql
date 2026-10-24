-- CreateTable
CREATE TABLE "CostTag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostPremix" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "yieldQty" DECIMAL(14,3),
    "yieldUnit" "CostUnit" NOT NULL DEFAULT 'G',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostPremix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostPremixLine" (
    "id" TEXT NOT NULL,
    "premixId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" "CostUnit" NOT NULL,

    CONSTRAINT "CostPremixLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostRecipe" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagId" TEXT,
    "yieldPieces" INTEGER,
    "laborHours" DECIMAL(8,2),
    "ovenHours" DECIMAL(8,2),
    "includeLabor" BOOLEAN NOT NULL DEFAULT true,
    "includeFixed" BOOLEAN NOT NULL DEFAULT true,
    "includeWaste" BOOLEAN NOT NULL DEFAULT true,
    "wastePct" DECIMAL(5,2),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostRecipeLine" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "ingredientId" TEXT,
    "premixId" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" "CostUnit" NOT NULL,

    CONSTRAINT "CostRecipeLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CostTag_userId_name_key" ON "CostTag"("userId", "name");

-- CreateIndex
CREATE INDEX "CostPremix_userId_archivedAt_idx" ON "CostPremix"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "CostPremixLine_premixId_idx" ON "CostPremixLine"("premixId");

-- CreateIndex
CREATE INDEX "CostPremixLine_ingredientId_idx" ON "CostPremixLine"("ingredientId");

-- CreateIndex
CREATE INDEX "CostRecipe_userId_archivedAt_idx" ON "CostRecipe"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "CostRecipe_tagId_idx" ON "CostRecipe"("tagId");

-- CreateIndex
CREATE INDEX "CostRecipeLine_recipeId_idx" ON "CostRecipeLine"("recipeId");

-- CreateIndex
CREATE INDEX "CostRecipeLine_ingredientId_idx" ON "CostRecipeLine"("ingredientId");

-- CreateIndex
CREATE INDEX "CostRecipeLine_premixId_idx" ON "CostRecipeLine"("premixId");

-- AddForeignKey
ALTER TABLE "CostTag" ADD CONSTRAINT "CostTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostPremix" ADD CONSTRAINT "CostPremix_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostPremixLine" ADD CONSTRAINT "CostPremixLine_premixId_fkey" FOREIGN KEY ("premixId") REFERENCES "CostPremix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostPremixLine" ADD CONSTRAINT "CostPremixLine_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "CostIngredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRecipe" ADD CONSTRAINT "CostRecipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRecipe" ADD CONSTRAINT "CostRecipe_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "CostTag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRecipeLine" ADD CONSTRAINT "CostRecipeLine_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "CostRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRecipeLine" ADD CONSTRAINT "CostRecipeLine_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "CostIngredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRecipeLine" ADD CONSTRAINT "CostRecipeLine_premixId_fkey" FOREIGN KEY ("premixId") REFERENCES "CostPremix"("id") ON DELETE SET NULL ON UPDATE CASCADE;
