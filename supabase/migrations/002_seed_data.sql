-- ============================================================
-- BauZeit Pro – Testdaten
-- Datei: supabase/migrations/002_seed_data.sql
-- WICHTIG: Erst ausführen NACHDEM die Benutzer in Supabase Auth angelegt wurden!
-- ============================================================

-- ============================================================
-- SCHRITT 1: Benutzer in Supabase erstellen
-- Gehe zu Authentication → Users → Add User für jeden Eintrag:
--
-- admin@bauzeit.de          Passwort: Admin1234!   full_name: Admin Schmidt    role: admin
-- bauleiter@bauzeit.de      Passwort: Manager1234! full_name: Klaus Bauleiter  role: manager
-- mitarbeiter1@bauzeit.de   Passwort: Worker1234!  full_name: Max Mustermann   role: employee
-- mitarbeiter2@bauzeit.de   Passwort: Worker1234!  full_name: Anna Arbeiter    role: employee
-- mitarbeiter3@bauzeit.de   Passwort: Worker1234!  full_name: Peter Handwerker role: employee
-- ============================================================

-- ============================================================
-- SCHRITT 2: Profile aktualisieren
-- Ersetze die UUIDs unten mit den echten IDs aus auth.users!
-- ============================================================

-- Temporäre Variablen für UUIDs (anpassen!)
DO $$
DECLARE
  v_admin_id    UUID;
  v_manager_id  UUID;
  v_emp1_id     UUID;
  v_emp2_id     UUID;
  v_emp3_id     UUID;
  v_site1_id    UUID := uuid_generate_v4();
  v_site2_id    UUID := uuid_generate_v4();
  v_site3_id    UUID := uuid_generate_v4();
BEGIN

  -- -------------------------------------------------------
  -- Benutzer-IDs aus auth.users laden (nach E-Mail)
  -- -------------------------------------------------------
  SELECT id INTO v_admin_id   FROM auth.users WHERE email = 'admin@bauzeit.de';
  SELECT id INTO v_manager_id FROM auth.users WHERE email = 'bauleiter@bauzeit.de';
  SELECT id INTO v_emp1_id    FROM auth.users WHERE email = 'mitarbeiter1@bauzeit.de';
  SELECT id INTO v_emp2_id    FROM auth.users WHERE email = 'mitarbeiter2@bauzeit.de';
  SELECT id INTO v_emp3_id    FROM auth.users WHERE email = 'mitarbeiter3@bauzeit.de';

  -- Sicherheitscheck
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'admin@bauzeit.de nicht gefunden. Bitte zuerst in Auth anlegen!';
  END IF;

  -- -------------------------------------------------------
  -- Profile aktualisieren
  -- -------------------------------------------------------
  UPDATE public.profiles SET
    full_name = 'Admin Schmidt',
    role = 'admin',
    phone = '+49 151 11111111'
  WHERE id = v_admin_id;

  UPDATE public.profiles SET
    full_name = 'Klaus Bauleiter',
    role = 'manager',
    phone = '+49 152 22222222'
  WHERE id = v_manager_id;

  UPDATE public.profiles SET
    full_name = 'Max Mustermann',
    role = 'employee',
    phone = '+49 153 33333333'
  WHERE id = v_emp1_id;

  UPDATE public.profiles SET
    full_name = 'Anna Arbeiter',
    role = 'employee',
    phone = '+49 154 44444444'
  WHERE id = v_emp2_id;

  UPDATE public.profiles SET
    full_name = 'Peter Handwerker',
    role = 'employee',
    phone = '+49 155 55555555'
  WHERE id = v_emp3_id;

  -- -------------------------------------------------------
  -- Baustellen erstellen
  -- -------------------------------------------------------
  INSERT INTO public.construction_sites (id, name, address, manager_id, gps_lat, gps_lng, gps_radius_m, active)
  VALUES
    (v_site1_id, 'Baustelle Hauptstraße',   'Hauptstraße 123, 80331 München',     v_manager_id, 48.1372,  11.5755,  300, TRUE),
    (v_site2_id, 'Neubau Rathausplatz',     'Rathausplatz 1, 80331 München',      v_manager_id, 48.1374,  11.5757,  200, TRUE),
    (v_site3_id, 'Renovierung Altstadt',    'Marienplatz 5, 80331 München',       v_admin_id,   48.1375,  11.5760,  150, TRUE);

  -- -------------------------------------------------------
  -- Baustellenzuweisungen
  -- -------------------------------------------------------
  INSERT INTO public.site_assignments (site_id, employee_id)
  VALUES
    (v_site1_id, v_emp1_id),
    (v_site1_id, v_emp2_id),
    (v_site2_id, v_emp1_id),
    (v_site2_id, v_emp3_id),
    (v_site3_id, v_emp2_id),
    (v_site3_id, v_emp3_id)
  ON CONFLICT (site_id, employee_id) DO NOTHING;

  -- -------------------------------------------------------
  -- Demo-Zeiteinträge (Letzte Woche)
  -- -------------------------------------------------------

  -- Max Mustermann – Montag letzte Woche
  INSERT INTO public.time_entries
    (employee_id, site_id, start_time, end_time, pause_minutes, total_minutes, status, source)
  VALUES
    (v_emp1_id, v_site1_id,
     NOW() - INTERVAL '7 days' + TIME '07:00',
     NOW() - INTERVAL '7 days' + TIME '16:00',
     45, 495, 'approved', 'mobile'),

    -- Anna Arbeiter – Montag
    (v_emp2_id, v_site1_id,
     NOW() - INTERVAL '7 days' + TIME '07:30',
     NOW() - INTERVAL '7 days' + TIME '16:30',
     30, 510, 'approved', 'mobile'),

    -- Peter Handwerker – Montag
    (v_emp3_id, v_site2_id,
     NOW() - INTERVAL '7 days' + TIME '08:00',
     NOW() - INTERVAL '7 days' + TIME '17:00',
     60, 480, 'submitted', 'mobile'),

    -- Max Mustermann – Dienstag
    (v_emp1_id, v_site1_id,
     NOW() - INTERVAL '6 days' + TIME '07:00',
     NOW() - INTERVAL '6 days' + TIME '15:30',
     30, 480, 'approved', 'mobile'),

    -- Anna Arbeiter – Dienstag
    (v_emp2_id, v_site3_id,
     NOW() - INTERVAL '6 days' + TIME '07:00',
     NOW() - INTERVAL '6 days' + TIME '16:00',
     45, 495, 'submitted', 'mobile'),

    -- Max Mustermann – Mittwoch (9 Stunden – Überstunden)
    (v_emp1_id, v_site2_id,
     NOW() - INTERVAL '5 days' + TIME '06:30',
     NOW() - INTERVAL '5 days' + TIME '16:00',
     30, 510, 'corrected', 'mobile'),

    -- Peter Handwerker – Mittwoch
    (v_emp3_id, v_site3_id,
     NOW() - INTERVAL '5 days' + TIME '08:00',
     NOW() - INTERVAL '5 days' + TIME '17:30',
     45, 525, 'submitted', 'mobile'),

    -- Heute: Max ist eingestempelt (kein end_time)
    (v_emp1_id, v_site1_id,
     NOW() - INTERVAL '3 hours',
     NULL, 30, 0, 'open', 'mobile');

  -- -------------------------------------------------------
  -- Demo-Pausen für heute
  -- -------------------------------------------------------
  INSERT INTO public.break_entries (time_entry_id, start_time, end_time)
  SELECT
    te.id,
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '1 hour 30 minutes'
  FROM public.time_entries te
  WHERE te.employee_id = v_emp1_id
    AND te.end_time IS NULL
  LIMIT 1;

  -- Pausen-Minuten für den offenen Eintrag aktualisieren
  UPDATE public.time_entries
  SET pause_minutes = 30
  WHERE employee_id = v_emp1_id AND end_time IS NULL;

  -- -------------------------------------------------------
  -- Demo-Benachrichtigungen
  -- -------------------------------------------------------
  IF v_emp1_id IS NOT NULL THEN
    INSERT INTO public.notifications (employee_id, type, title, message, read)
    VALUES
      (v_emp1_id, 'overtime_warning',  'Überstunden!',
       'Du arbeitest seit 9 Stunden. Bitte Arbeit beenden.', TRUE),
      (v_emp2_id, 'system',           'Willkommen bei BauZeit Pro!',
       'Dein Konto wurde erfolgreich eingerichtet.', TRUE);
  END IF;

  RAISE NOTICE '✅ Testdaten erfolgreich erstellt!';
  RAISE NOTICE 'Admin: admin@bauzeit.de / Admin1234!';
  RAISE NOTICE 'Bauleiter: bauleiter@bauzeit.de / Manager1234!';
  RAISE NOTICE 'Mitarbeiter 1: mitarbeiter1@bauzeit.de / Worker1234!';
  RAISE NOTICE 'Mitarbeiter 2: mitarbeiter2@bauzeit.de / Worker1234!';
  RAISE NOTICE 'Mitarbeiter 3: mitarbeiter3@bauzeit.de / Worker1234!';

END $$;
