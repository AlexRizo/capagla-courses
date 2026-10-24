-- CreateTable
CREATE TABLE "CostQuote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "decorHours" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "sourcingHours" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostQuoteExtra" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "CostQuoteExtra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CostQuote_userId_updatedAt_idx" ON "CostQuote"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "CostQuote_productId_idx" ON "CostQuote"("productId");

-- CreateIndex
CREATE INDEX "CostQuoteExtra_quoteId_idx" ON "CostQuoteExtra"("quoteId");

-- AddForeignKey
ALTER TABLE "CostQuote" ADD CONSTRAINT "CostQuote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostQuote" ADD CONSTRAINT "CostQuote_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CostProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostQuoteExtra" ADD CONSTRAINT "CostQuoteExtra_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "CostQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
