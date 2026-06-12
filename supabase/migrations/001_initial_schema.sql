-- ============================================================
-- BauZeit Pro – Vollständige Datenbank-Migration
-- Datei: supabase/migrations/001_initial_schema.sql
-- ============================================================

-- UUID Extension aktivieren
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELLEN
-- ============================================================

-- Profile (erweitert auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'employee'
                  CHECK (role IN ('admin', 'manager', 'employee')),
  phone         TEXT,
  pin           TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Baustellen
CREATE TABLE IF NOT EXISTS public.construction_sites (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  address       TEXT,
  manager_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  gps_lat       NUMERIC(10, 7),
  gps_lng       NUMERIC(10, 7),
  gps_radius_m  INTEGER NOT NULL DEFAULT 200,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Baustellenzuweisungen (Mitarbeiter ↔ Baustelle)
CREATE TABLE IF NOT EXISTS public.site_assignments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id       UUID NOT NULL REFERENCES public.construction_sites(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (site_id, employee_id)
);

-- Zeiteinträge (Stempelungen)
CREATE TABLE IF NOT EXISTS public.time_entries (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  site_id       UUID NOT NULL REFERENCES public.construction_sites(id) ON DELETE CASCADE,
  start_time    TIMESTAMPTZ NOT NULL,
  end_time      TIMESTAMPTZ,
  pause_minutes INTEGER NOT NULL DEFAULT 0,
  total_minutes INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'submitted', 'approved', 'corrected')),
  start_lat     NUMERIC(10, 7),
  start_lng     NUMERIC(10, 7),
  end_lat       NUMERIC(10, 7),
  end_lng       NUMERIC(10, 7),
  source        TEXT NOT NULL DEFAULT 'mobile',
  admin_comment TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pauseneinträge
CREATE TABLE IF NOT EXISTS public.break_entries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  time_entry_id   UUID NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit-Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type   TEXT NOT NULL,
  entity_id     UUID NOT NULL,
  action        TEXT NOT NULL,
  old_value     JSONB,
  new_value     JSONB,
  changed_by    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Benachrichtigungen
CREATE TABLE IF NOT EXISTS public.notifications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  read          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDIZES für Performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_time_entries_employee_id   ON public.time_entries (employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_site_id        ON public.time_entries (site_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_start_time     ON public.time_entries (start_time DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_status         ON public.time_entries (status);
CREATE INDEX IF NOT EXISTS idx_time_entries_open           ON public.time_entries (employee_id) WHERE end_time IS NULL;
CREATE INDEX IF NOT EXISTS idx_break_entries_time_entry_id ON public.break_entries (time_entry_id);
CREATE INDEX IF NOT EXISTS idx_break_entries_open          ON public.break_entries (time_entry_id) WHERE end_time IS NULL;
CREATE INDEX IF NOT EXISTS idx_site_assignments_employee   ON public.site_assignments (employee_id);
CREATE INDEX IF NOT EXISTS idx_site_assignments_site       ON public.site_assignments (site_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity           ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_employee      ON public.notifications (employee_id, read);

-- ============================================================
-- TRIGGER: updated_at automatisch setzen
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_time_entries_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- TRIGGER: Profil automatisch bei Registrierung erstellen
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_new_user_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_assignments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.break_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Hilfsfunktionen für RLS
-- ============================================================

-- Gibt die Rolle des aktuellen Users zurück
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Prüft ob der aktuelle User Admin ist
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- Prüft ob der aktuelle User Admin oder Manager ist
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'));
$$;

-- Gibt alle Site-IDs zurück, die einem Manager zugewiesen sind
CREATE OR REPLACE FUNCTION public.get_my_managed_sites()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM public.construction_sites WHERE manager_id = auth.uid();
$$;

-- Gibt alle Site-IDs zurück, denen der Mitarbeiter zugewiesen ist
CREATE OR REPLACE FUNCTION public.get_my_assigned_sites()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT site_id FROM public.site_assignments WHERE employee_id = auth.uid();
$$;

-- ============================================================
-- RLS POLICIES: profiles
-- ============================================================

-- Alle können eigenes Profil lesen
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());

-- Admin kann alle Profile lesen
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT USING (public.is_admin());

-- Manager kann Profile der zugewiesenen Mitarbeiter lesen
CREATE POLICY "profiles_select_manager" ON public.profiles
  FOR SELECT USING (
    public.is_admin_or_manager() AND
    id IN (
      SELECT employee_id FROM public.site_assignments
      WHERE site_id IN (SELECT public.get_my_managed_sites())
    )
  );

-- Jeder kann eigenes Profil aktualisieren (Name, Telefon)
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- Admin kann alle Profile aktualisieren (inkl. Rolle)
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (public.is_admin());

-- ============================================================
-- RLS POLICIES: construction_sites
-- ============================================================

-- Admin sieht alle Baustellen
CREATE POLICY "sites_select_admin" ON public.construction_sites
  FOR SELECT USING (public.is_admin());

-- Manager sieht eigene Baustellen
CREATE POLICY "sites_select_manager" ON public.construction_sites
  FOR SELECT USING (manager_id = auth.uid());

-- Mitarbeiter sieht zugewiesene Baustellen
CREATE POLICY "sites_select_employee" ON public.construction_sites
  FOR SELECT USING (id IN (SELECT public.get_my_assigned_sites()));

-- Admin kann alle Baustellen schreiben
CREATE POLICY "sites_insert_admin" ON public.construction_sites
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "sites_update_admin" ON public.construction_sites
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "sites_delete_admin" ON public.construction_sites
  FOR DELETE USING (public.is_admin());

-- Manager kann eigene Baustellen aktualisieren
CREATE POLICY "sites_update_manager" ON public.construction_sites
  FOR UPDATE USING (manager_id = auth.uid());

-- ============================================================
-- RLS POLICIES: site_assignments
-- ============================================================

-- Admin sieht alle Zuweisungen
CREATE POLICY "assignments_select_admin" ON public.site_assignments
  FOR SELECT USING (public.is_admin());

-- Manager sieht Zuweisungen seiner Baustellen
CREATE POLICY "assignments_select_manager" ON public.site_assignments
  FOR SELECT USING (site_id IN (SELECT public.get_my_managed_sites()));

-- Mitarbeiter sieht eigene Zuweisungen
CREATE POLICY "assignments_select_own" ON public.site_assignments
  FOR SELECT USING (employee_id = auth.uid());

-- Admin und Manager verwalten Zuweisungen
CREATE POLICY "assignments_insert_admin" ON public.site_assignments
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "assignments_delete_admin" ON public.site_assignments
  FOR DELETE USING (public.is_admin());

CREATE POLICY "assignments_insert_manager" ON public.site_assignments
  FOR INSERT WITH CHECK (site_id IN (SELECT public.get_my_managed_sites()));

CREATE POLICY "assignments_delete_manager" ON public.site_assignments
  FOR DELETE USING (site_id IN (SELECT public.get_my_managed_sites()));

-- ============================================================
-- RLS POLICIES: time_entries
-- ============================================================

-- Mitarbeiter sieht nur eigene Zeiteinträge
CREATE POLICY "time_entries_select_own" ON public.time_entries
  FOR SELECT USING (employee_id = auth.uid());

-- Admin sieht alle Zeiteinträge
CREATE POLICY "time_entries_select_admin" ON public.time_entries
  FOR SELECT USING (public.is_admin());

-- Manager sieht Einträge seiner Baustellen
CREATE POLICY "time_entries_select_manager" ON public.time_entries
  FOR SELECT USING (site_id IN (SELECT public.get_my_managed_sites()));

-- Mitarbeiter kann eigene offene Zeiteinträge erstellen
CREATE POLICY "time_entries_insert_own" ON public.time_entries
  FOR INSERT WITH CHECK (
    employee_id = auth.uid() AND
    site_id IN (SELECT public.get_my_assigned_sites())
  );

-- Mitarbeiter kann eigene offene Zeiteinträge aktualisieren
CREATE POLICY "time_entries_update_own" ON public.time_entries
  FOR UPDATE USING (
    employee_id = auth.uid() AND
    status IN ('open', 'submitted')
  );

-- Admin kann alle Zeiteinträge aktualisieren (für Korrekturen)
CREATE POLICY "time_entries_update_admin" ON public.time_entries
  FOR UPDATE USING (public.is_admin());

-- Manager kann Einträge seiner Baustellen aktualisieren
CREATE POLICY "time_entries_update_manager" ON public.time_entries
  FOR UPDATE USING (site_id IN (SELECT public.get_my_managed_sites()));

-- ============================================================
-- RLS POLICIES: break_entries
-- ============================================================

-- Mitarbeiter sieht eigene Pausen
CREATE POLICY "breaks_select_own" ON public.break_entries
  FOR SELECT USING (
    time_entry_id IN (
      SELECT id FROM public.time_entries WHERE employee_id = auth.uid()
    )
  );

-- Admin sieht alle Pausen
CREATE POLICY "breaks_select_admin" ON public.break_entries
  FOR SELECT USING (public.is_admin());

-- Manager sieht Pausen seiner Baustellen
CREATE POLICY "breaks_select_manager" ON public.break_entries
  FOR SELECT USING (
    time_entry_id IN (
      SELECT id FROM public.time_entries
      WHERE site_id IN (SELECT public.get_my_managed_sites())
    )
  );

-- Mitarbeiter kann eigene Pausen erstellen/aktualisieren
CREATE POLICY "breaks_insert_own" ON public.break_entries
  FOR INSERT WITH CHECK (
    time_entry_id IN (
      SELECT id FROM public.time_entries
      WHERE employee_id = auth.uid() AND end_time IS NULL
    )
  );

CREATE POLICY "breaks_update_own" ON public.break_entries
  FOR UPDATE USING (
    time_entry_id IN (
      SELECT id FROM public.time_entries WHERE employee_id = auth.uid()
    )
  );

-- Admin kann alle Pausen aktualisieren
CREATE POLICY "breaks_update_admin" ON public.break_entries
  FOR UPDATE USING (public.is_admin());

-- ============================================================
-- RLS POLICIES: audit_logs
-- ============================================================

-- Nur Admin kann Audit-Logs lesen
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
  FOR SELECT USING (public.is_admin());

-- Manager kann Audit-Logs seiner Baustellen lesen
CREATE POLICY "audit_logs_select_manager" ON public.audit_logs
  FOR SELECT USING (
    public.is_admin_or_manager() AND
    entity_type = 'time_entry' AND
    entity_id::UUID IN (
      SELECT id FROM public.time_entries
      WHERE site_id IN (SELECT public.get_my_managed_sites())
    )
  );

-- Alle können Audit-Logs schreiben (über Service-Funktionen)
CREATE POLICY "audit_logs_insert_auth" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- RLS POLICIES: notifications
-- ============================================================

-- Jeder sieht nur eigene Benachrichtigungen
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (employee_id = auth.uid());

-- Admin sieht alle
CREATE POLICY "notifications_select_admin" ON public.notifications
  FOR SELECT USING (public.is_admin());

-- Eigene Benachrichtigungen als gelesen markieren
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (employee_id = auth.uid());

-- Alle können Benachrichtigungen einfügen (System-Notifs)
CREATE POLICY "notifications_insert_auth" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
