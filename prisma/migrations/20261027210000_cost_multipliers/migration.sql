-- AlterTable
ALTER TABLE "CostSettings" ADD COLUMN "targetMultiplier" DECIMAL(6,2),
DROP COLUMN "priceBase";

-- AlterTable
ALTER TABLE "CostProduct" ADD COLUMN "multiplier" DECIMAL(6,2);

-- DropEnum
DROP TYPE "CostPriceBase";
