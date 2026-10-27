-- CreateEnum
CREATE TYPE "CostPackagingScope" AS ENUM ('WHOLE', 'SLICE');

-- CreateTable
CREATE TABLE "CostProduct" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2),
    "sellsSlices" BOOLEAN NOT NULL DEFAULT false,
    "slicesPerPiece" INTEGER,
    "slicePrice" DECIMAL(12,2),
    "withTax" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostProductRecipe" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "recipeId" TEXT NOT NULL,
    "piecesSold" INTEGER NOT NULL,

    CONSTRAINT "CostProductRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostProductPackaging" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "scope" "CostPackagingScope" NOT NULL,
    "position" INTEGER NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" "CostUnit" NOT NULL,

    CONSTRAINT "CostProductPackaging_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CostProduct_userId_archivedAt_idx" ON "CostProduct"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "CostProductRecipe_productId_idx" ON "CostProductRecipe"("productId");

-- CreateIndex
CREATE INDEX "CostProductRecipe_recipeId_idx" ON "CostProductRecipe"("recipeId");

-- CreateIndex
CREATE INDEX "CostProductPackaging_productId_idx" ON "CostProductPackaging"("productId");

-- CreateIndex
CREATE INDEX "CostProductPackaging_ingredientId_idx" ON "CostProductPackaging"("ingredientId");

-- AddForeignKey
ALTER TABLE "CostProduct" ADD CONSTRAINT "CostProduct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostProductRecipe" ADD CONSTRAINT "CostProductRecipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CostProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostProductRecipe" ADD CONSTRAINT "CostProductRecipe_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "CostRecipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostProductPackaging" ADD CONSTRAINT "CostProductPackaging_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CostProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostProductPackaging" ADD CONSTRAINT "CostProductPackaging_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "CostIngredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
