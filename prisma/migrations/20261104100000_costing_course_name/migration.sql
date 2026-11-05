-- El curso de costos pasa a llamarse «Aprende a Costear» (maqueta nueva, 2026-11-04).
-- Solo se cambia si todavía tiene el nombre de arranque: no pisa lo editado en el panel.
UPDATE "Product" SET "name" = 'Aprende a Costear' WHERE "slug" = 'calcular-costos' AND "name" = 'Cómo calcular costos de tus postres';
