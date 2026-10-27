-- CreateEnum
CREATE TYPE "CostLaborMode" AS ENUM ('WANTED', 'MINIMUM_WAGE', 'NONE');

-- CreateEnum
CREATE TYPE "CostPriceBase" AS ENUM ('TOTAL', 'INGREDIENTS');

-- CreateTable
CREATE TABLE "CostSettings" (
    "userId" TEXT NOT NULL,
    "hoursPerWeek" DECIMAL(6,2),
    "ovenKw" DECIMAL(8,3),
    "kwhPrice" DECIMAL(10,3),
    "gasKgPerHour" DECIMAL(8,3),
    "gasPricePerKg" DECIMAL(10,2),
    "rentMonthly" DECIMAL(12,2),
    "rentSharePct" DECIMAL(5,2),
    "equipCost" DECIMAL(12,2),
    "equipLifeHours" DECIMAL(12,2),
    "laborMode" "CostLaborMode" NOT NULL DEFAULT 'WANTED',
    "wantedMonthly" DECIMAL(12,2),
    "dailyMinWage" DECIMAL(10,2),
    "multiplier" DECIMAL(6,2),
    "defaultWastePct" DECIMAL(5,2),
    "priceBase" "CostPriceBase" NOT NULL DEFAULT 'TOTAL',
    "sellsAsBusiness" BOOLEAN NOT NULL DEFAULT false,
    "taxPct" DECIMAL(5,2),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostSettings_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "CostSettings" ADD CONSTRAINT "CostSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
