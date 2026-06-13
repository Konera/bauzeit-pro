-- ============================================================
-- BauZeit Pro – Kritische Fixes für Soft-Launch
-- Datei: supabase/migrations/003_critical_fixes.sql
-- ============================================================

-- ============================================================
-- K1: Role-Escalation schließen
-- VORHER: handle_new_user() las 'role' aus Signup-Metadata
-- NACHHER: Hardcoded 'employee', Metadata-Role ignoriert
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'employee'  -- K1 FIX: Immer 'employee', keine Escalation möglich
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================================
-- K2: 'rejected' Status zum CHECK-Constraint hinzufügen
-- ============================================================

ALTER TABLE public.time_entries DROP CONSTRAINT IF EXISTS time_entries_status_check;
ALTER TABLE public.time_entries ADD CONSTRAINT time_entries_status_check
  CHECK (status IN ('open', 'submitted', 'approved', 'corrected', 'rejected'));

-- ============================================================
-- K3: Phase-2-Spalten hinzufügen (fehlende 6 Spalten)
-- ============================================================

-- GPS-Warnung (Start oder Ende außerhalb Geofence)
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS gps_warning BOOLEAN DEFAULT FALSE;

-- Entfernung zur Baustelle bei Start/Ende (in Metern)
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS start_distance_m NUMERIC(10, 2);
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS end_distance_m NUMERIC(10, 2);

-- Genehmigung / Ablehnung
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

-- Index für approved_by (Performance bei Admin-Abfragen)
CREATE INDEX IF NOT EXISTS idx_time_entries_approved_by ON public.time_entries (approved_by);

-- ============================================================
-- K4: Notification-Spoofing schließen
-- Nur eigene Notifications einfügen erlaubt
-- ============================================================

DROP POLICY IF EXISTS "notifications_insert_auth" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_own" ON public.notifications;
CREATE POLICY "notifications_insert_own" ON public.notifications
  FOR INSERT WITH CHECK (employee_id = auth.uid());

-- Admin darf Notifications für alle erstellen (System-Benachrichtigungen)
DROP POLICY IF EXISTS "notifications_insert_admin" ON public.notifications;
CREATE POLICY "notifications_insert_admin" ON public.notifications
  FOR INSERT WITH CHECK (public.is_admin_or_manager());

-- Audit-Logs: Nur eigene Einträge (changed_by muss auth.uid() sein)
DROP POLICY IF EXISTS "audit_logs_insert_auth" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_own" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_own" ON public.audit_logs
  FOR INSERT WITH CHECK (changed_by = auth.uid());

-- Admin darf alle Audit-Logs schreiben
DROP POLICY IF EXISTS "audit_logs_insert_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_admin" ON public.audit_logs
  FOR INSERT WITH CHECK (public.is_admin_or_manager());
