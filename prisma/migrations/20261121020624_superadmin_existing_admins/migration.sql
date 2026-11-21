-- Las administradoras que ya existían pasan a superadministrador (decisión del usuario,
-- 2026-11-20). Va en una migración aparte: Postgres no deja usar un valor nuevo del enum en la
-- misma transacción en que se agrega.
UPDATE "user" SET "role" = 'SUPERADMIN' WHERE "role" = 'ADMIN';
