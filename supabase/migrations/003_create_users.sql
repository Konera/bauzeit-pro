-- ============================================================
-- BauZeit Pro – User & Daten Setup
-- Dieses SQL im Supabase SQL Editor ausführen:
-- https://supabase.com/dashboard/project/lhfotjxzdhxugqpgpeuc/sql/new
-- ============================================================

-- 1. Admin-User erstellen
SELECT auth.create_user(
  '{"email": "admin@bauzeit.de", "password": "BauZeit2024!", "email_confirm": true, "user_metadata": {"full_name": "Admin Chef", "role": "admin"}}'::jsonb
);

-- 2. Manager-User erstellen  
SELECT auth.create_user(
  '{"email": "bauleiter@bauzeit.de", "password": "BauZeit2024!", "email_confirm": true, "user_metadata": {"full_name": "Max Bauleiter", "role": "manager"}}'::jsonb
);

-- 3. Mitarbeiter erstellen
SELECT auth.create_user(
  '{"email": "hans@bauzeit.de", "password": "BauZeit2024!", "email_confirm": true, "user_metadata": {"full_name": "Hans Meier", "role": "employee"}}'::jsonb
);

SELECT auth.create_user(
  '{"email": "ibrahim@bauzeit.de", "password": "BauZeit2024!", "email_confirm": true, "user_metadata": {"full_name": "Ibrahim Yilmaz", "role": "employee"}}'::jsonb
);

SELECT auth.create_user(
  '{"email": "stefan@bauzeit.de", "password": "BauZeit2024!", "email_confirm": true, "user_metadata": {"full_name": "Stefan Koch", "role": "employee"}}'::jsonb
);
