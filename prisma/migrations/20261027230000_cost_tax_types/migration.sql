-- CreateTable
CREATE TABLE "CostTaxType" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ratePct" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostTaxType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CostTaxType_userId_idx" ON "CostTaxType"("userId");

-- AddForeignKey
ALTER TABLE "CostTaxType" ADD CONSTRAINT "CostTaxType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "CostProduct" ADD COLUMN "taxTypeId" TEXT;

-- AddForeignKey
ALTER TABLE "CostProduct" ADD CONSTRAINT "CostProduct_taxTypeId_fkey" FOREIGN KEY ("taxTypeId") REFERENCES "CostTaxType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Quien vendía como negocio con un porcentaje pasa a tener ese impuesto dado de alta, y sus
-- productos con impuesto lo usan.
INSERT INTO "CostTaxType" ("id", "userId", "name", "ratePct")
SELECT gen_random_uuid()::text, "userId", 'Impuesto', "taxPct"
FROM "CostSettings"
WHERE "sellsAsBusiness" AND "taxPct" IS NOT NULL;

UPDATE "CostProduct" p
SET "taxTypeId" = t."id"
FROM "CostTaxType" t
WHERE t."userId" = p."userId" AND p."withTax";

-- AlterTable
ALTER TABLE "CostProduct" DROP COLUMN "withTax";

-- AlterTable
ALTER TABLE "CostSettings" DROP COLUMN "sellsAsBusiness",
DROP COLUMN "taxPct";
