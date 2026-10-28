-- AlterTable
ALTER TABLE "CostListEntry" ADD COLUMN "manualAmount" DECIMAL(14,3) NOT NULL DEFAULT 0;

-- Lo que ya estaba agregado a mano eran paquetes completos: pasa a su cantidad en g, ml o pza.
UPDATE "CostListEntry" e
SET "manualAmount" = e."manualPacks" * i."quantity" * CASE i."unit" WHEN 'KG' THEN 1000 WHEN 'L' THEN 1000 ELSE 1 END
FROM "CostIngredient" i
WHERE i."id" = e."ingredientId" AND e."manualPacks" > 0;

-- AlterTable
ALTER TABLE "CostListEntry" DROP COLUMN "manualPacks";
