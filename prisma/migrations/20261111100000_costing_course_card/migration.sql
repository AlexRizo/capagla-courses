-- Tarjeta del curso Aprende a Costear en la Home (maqueta última, 2026-11-11): descripción e imagen.
-- Solo se llenan si están vacías: no pisa lo editado en el panel.
UPDATE "Product" SET "description" = 'Saca lo que de verdad te cuesta cada postre y ponle precio. 8 videos cortos con Gladis.'
WHERE "slug" = 'calcular-costos' AND ("description" IS NULL OR "description" = '');
UPDATE "Product" SET "coverUrl" = '/images/aprende-a-costear.jpg'
WHERE "slug" = 'calcular-costos' AND ("coverUrl" IS NULL OR "coverUrl" = '');
