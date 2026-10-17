-- El video de intro de la promoción pasa a ser un video de la biblioteca de Bunny (su id),
-- igual que las lecciones. No había datos guardados.
ALTER TABLE "Promotion" RENAME COLUMN "introVideoUrl" TO "introVideoId";
