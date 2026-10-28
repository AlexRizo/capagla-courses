-- AlterTable
ALTER TABLE "CostSettings"
  ADD COLUMN "electricityMonthly" DECIMAL(12,2),
  ADD COLUMN "gasMonthly" DECIMAL(12,2),
  ADD COLUMN "machineryCost" DECIMAL(12,2),
  ADD COLUMN "machineryYears" DECIMAL(5,2),
  ADD COLUMN "moldsCost" DECIMAL(12,2),
  ADD COLUMN "moldsYears" DECIMAL(5,2);

-- Lo que ya había (por hora de horno) pasa a lo que se paga al mes: × las horas al mes (horas por
-- semana × 4.33, redondeado). El equipo, que se medía en horas de vida, pasa a maquinaria con los
-- años por defecto.
UPDATE "CostSettings" SET
  "electricityMonthly" = CASE WHEN "ovenKw" IS NOT NULL AND "kwhPrice" IS NOT NULL AND "hoursPerWeek" IS NOT NULL
    THEN ROUND("ovenKw" * "kwhPrice" * ROUND("hoursPerWeek" * 4.33), 2) END,
  "gasMonthly" = CASE WHEN "gasKgPerHour" IS NOT NULL AND "gasPricePerKg" IS NOT NULL AND "hoursPerWeek" IS NOT NULL
    THEN ROUND("gasKgPerHour" * "gasPricePerKg" * ROUND("hoursPerWeek" * 4.33), 2) END,
  "machineryCost" = "equipCost";

-- AlterTable
ALTER TABLE "CostSettings"
  DROP COLUMN "ovenKw",
  DROP COLUMN "kwhPrice",
  DROP COLUMN "gasKgPerHour",
  DROP COLUMN "gasPricePerKg",
  DROP COLUMN "equipCost",
  DROP COLUMN "equipLifeHours";
