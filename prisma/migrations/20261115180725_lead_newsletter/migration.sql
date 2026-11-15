-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "newsletterAt" TIMESTAMP(3);

-- Hasta ahora la única casilla de la clase gratis juntaba el aviso de privacidad con «recibir
-- correos con recetas y ofertas»: los leads que ya existen sí aceptaron correos.
UPDATE "Lead" SET "newsletterAt" = "consentAt" WHERE "newsletterAt" IS NULL;
