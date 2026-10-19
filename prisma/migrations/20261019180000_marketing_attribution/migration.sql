-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "attribution" JSONB,
ADD COLUMN     "marketingConsent" BOOLEAN;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "attribution" JSONB,
ADD COLUMN     "marketingConsent" BOOLEAN;
