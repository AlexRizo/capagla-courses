-- CreateEnum
CREATE TYPE "PromotionEventKind" AS ENUM ('VISIT', 'CART');

-- CreateTable
CREATE TABLE "PromotionEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promotionId" TEXT NOT NULL,
    "kind" "PromotionEventKind" NOT NULL,
    "visitorId" TEXT NOT NULL,

    CONSTRAINT "PromotionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromotionEvent_promotionId_kind_visitorId_key" ON "PromotionEvent"("promotionId", "kind", "visitorId");

-- AddForeignKey
ALTER TABLE "PromotionEvent" ADD CONSTRAINT "PromotionEvent_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
