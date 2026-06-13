-- ============================================================
-- BauZeit Pro – PIN-Hashing mit pgcrypto
-- Datei: supabase/migrations/004_pin_hashing.sql
-- ============================================================

-- pgcrypto Extension aktivieren (in Supabase bereits verfügbar)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Funktion zum Setzen einer gehashten PIN
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_employee_pin(
  p_employee_id UUID,
  p_pin TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- PIN validieren (4-6 Ziffern)
  IF p_pin !~ '^\d{4,6}$' THEN
    RAISE EXCEPTION 'PIN muss 4-6 Ziffern lang sein';
  END IF;

  UPDATE public.profiles
  SET pin = crypt(p_pin, gen_salt('bf', 8))
  WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mitarbeiter nicht gefunden';
  END IF;
END;
$$;

-- ============================================================
-- Funktion zum Verifizieren einer PIN
-- ============================================================
CREATE OR REPLACE FUNCTION public.verify_employee_pin(
  p_employee_id UUID,
  p_pin TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_hash TEXT;
BEGIN
  SELECT pin INTO v_stored_hash
  FROM public.profiles
  WHERE id = p_employee_id;

  IF v_stored_hash IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN v_stored_hash = crypt(p_pin, v_stored_hash);
END;
$$;

-- ============================================================
-- Bestehende Klartext-PINs hashen (einmalige Migration)
-- ============================================================
UPDATE public.profiles
SET pin = crypt(pin, gen_salt('bf', 8))
WHERE pin IS NOT NULL
  AND pin !~ '^\$2[aby]?\$';  -- Nur hashen wenn noch nicht gehasht

-- ============================================================
-- RLS: PIN-Spalte vor direktem SELECT schützen
-- Profile lesen ohne PIN (neue Policy)
-- ============================================================

-- Hinweis: Die bestehende SELECT-Policy für profiles zeigt alle Felder.
-- Für maximale Sicherheit sollte ein VIEW ohne PIN erstellt werden:
-- HINWEIS: profiles hat keine email-Spalte (E-Mail ist in auth.users)
CREATE OR REPLACE VIEW public.profiles_safe AS
SELECT id, full_name, role, active, phone, pin IS NOT NULL AS has_pin, created_at, updated_at
FROM public.profiles;

-- View-Berechtigungen
GRANT SELECT ON public.profiles_safe TO authenticated;

COMMENT ON FUNCTION public.set_employee_pin IS 'Setzt eine gehashte PIN für einen Mitarbeiter (bcrypt). Nur 4-6 Ziffern erlaubt.';
COMMENT ON FUNCTION public.verify_employee_pin IS 'Verifiziert eine PIN gegen den gespeicherten Hash. Gibt TRUE/FALSE zurück.';
