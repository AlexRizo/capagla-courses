-- CreateEnum
CREATE TYPE "ToolModule" AS ENUM ('PRODUCTION', 'SHOPPING_LIST', 'PURCHASES', 'QUOTES');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "compareAtMxn" INTEGER;

-- CreateTable
CREATE TABLE "ToolTier" (
    "productId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "itemLimit" INTEGER NOT NULL,
    "quoteDays" INTEGER NOT NULL DEFAULT 90,
    "modules" "ToolModule"[],

    CONSTRAINT "ToolTier_pkey" PRIMARY KEY ("productId")
);

-- AddForeignKey
ALTER TABLE "ToolTier" ADD CONSTRAINT "ToolTier_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- La herramienta que ya existe es el nivel Completo ($399 al año, precio de lista $569): lo tenía todo.
-- El precio solo se cambia si seguía en el de arranque ($200).
UPDATE "Product" SET "priceMxn" = 399, "compareAtMxn" = 569 WHERE "slug" = 'herramienta-costos' AND "priceMxn" = 200;
UPDATE "Product" SET "name" = 'Herramienta de costos · Completo' WHERE "slug" = 'herramienta-costos' AND "name" = 'Herramienta de costos';

INSERT INTO "ToolTier" ("productId", "rank", "itemLimit", "quoteDays", "modules")
SELECT "id", 2, 1000, 90, ARRAY['PRODUCTION','SHOPPING_LIST','PURCHASES','QUOTES']::"ToolModule"[]
FROM "Product" WHERE "slug" = 'herramienta-costos';

-- El nivel Básico ($299 al año, precio de lista $429): costos y precios, hasta 150 elementos.
INSERT INTO "Product" ("id", "slug", "name", "kind", "priceMxn", "compareAtMxn", "description", "accessDays", "status", "position")
SELECT gen_random_uuid()::text, 'herramienta-costos-basico', 'Herramienta de costos · Básico', 'TOOL', 299, 429,
       'Calcula el costo de tus recetas y ponles precio con semáforo.', 365, 'PUBLISHED', "position" + 1
FROM "Product" WHERE "slug" = 'herramienta-costos'
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "ToolTier" ("productId", "rank", "itemLimit", "quoteDays", "modules")
SELECT "id", 1, 150, 90, ARRAY[]::"ToolModule"[]
FROM "Product" WHERE "slug" = 'herramienta-costos-basico';
