-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "upsellOfId" TEXT;

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "thanksVideoId" TEXT;

-- CreateIndex
CREATE INDEX "Order_upsellOfId_idx" ON "Order"("upsellOfId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_upsellOfId_fkey" FOREIGN KEY ("upsellOfId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
