-- Videos de ayuda de la herramienta (tema 11): los 12 que Cheko subió a Bunny el 15 nov
-- (colección 09-AYUDA-HERRAMIENTA). Duración en segundos, tomada de Bunny.
-- Solo agrega los que falten: si una sección ya tiene video (asignado en el panel), no se toca.
INSERT INTO "ToolHelpVideo" ("key", "videoId", "seconds", "updatedAt") VALUES
  ('A00', '188b77c7-e015-4a11-ac14-0edaab3cf126', 66, CURRENT_TIMESTAMP),
  ('A01', 'cfe828bc-b689-44ba-8dc1-4b961c0ed189', 78, CURRENT_TIMESTAMP),
  ('A02', '9116bc8f-ca20-43f5-b596-344583500aad', 55, CURRENT_TIMESTAMP),
  ('A03', '9ff09972-ecd9-487e-9bc6-1c063b2f2036', 54, CURRENT_TIMESTAMP),
  ('A04', '4e3a46e7-59c9-4c40-941c-dfd612903a85', 37, CURRENT_TIMESTAMP),
  ('A05', '65ce8b5d-c276-4de2-b02e-91eef00fd3c3', 56, CURRENT_TIMESTAMP),
  ('A06', '2ef89a5e-f249-4a69-87ba-b26dab254791', 23, CURRENT_TIMESTAMP),
  ('A07', '8b8f6ea2-e441-4919-a4b6-351fc41b5c3b', 19, CURRENT_TIMESTAMP),
  ('A08', '3b16929f-a730-48a7-bbc2-b58c0c84155b', 36, CURRENT_TIMESTAMP),
  ('A09', '7be55481-936b-446d-a0a6-f456cecd8239', 37, CURRENT_TIMESTAMP),
  ('A10', '912ece5c-df64-4ca9-a851-815e0b02cff8', 28, CURRENT_TIMESTAMP),
  ('A11', 'dac7e97c-3b3a-43af-8949-1b6e2e41568c', 41, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
