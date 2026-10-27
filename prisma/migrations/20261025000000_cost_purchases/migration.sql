-- CreateTable
CREATE TABLE "CostPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "placeId" TEXT,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostPurchaseItem" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "previousPrice" DECIMAL(12,2) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "packGrams" DECIMAL(14,3),

    CONSTRAINT "CostPurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CostPurchase_userId_date_idx" ON "CostPurchase"("userId", "date");

-- CreateIndex
CREATE INDEX "CostPurchaseItem_purchaseId_idx" ON "CostPurchaseItem"("purchaseId");

-- CreateIndex
CREATE INDEX "CostPurchaseItem_ingredientId_idx" ON "CostPurchaseItem"("ingredientId");

-- AddForeignKey
ALTER TABLE "CostPurchase" ADD CONSTRAINT "CostPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostPurchase" ADD CONSTRAINT "CostPurchase_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "CostPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostPurchaseItem" ADD CONSTRAINT "CostPurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "CostPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostPurchaseItem" ADD CONSTRAINT "CostPurchaseItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "CostIngredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
