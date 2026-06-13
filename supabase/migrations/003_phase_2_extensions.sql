-- ============================================================
-- BauZeit Pro – Phase 2 Datenbank-Erweiterungen
-- Migration: 003_phase_2_extensions.sql
-- ============================================================

-- 1. Neue Felder für time_entries
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS rejected_reason TEXT;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS gps_warning BOOLEAN DEFAULT FALSE;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS start_distance_m INTEGER;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS end_distance_m INTEGER;

-- 2. Status-Constraint erweitern um 'rejected'
ALTER TABLE public.time_entries DROP CONSTRAINT IF EXISTS time_entries_status_check;
ALTER TABLE public.time_entries ADD CONSTRAINT time_entries_status_check
  CHECK (status IN ('open', 'submitted', 'approved', 'corrected', 'rejected'));

-- 3. Indizes für neue Abfragen
CREATE INDEX IF NOT EXISTS idx_time_entries_approved_by ON public.time_entries(approved_by);
CREATE INDEX IF NOT EXISTS idx_time_entries_gps_warning ON public.time_entries(gps_warning) WHERE gps_warning = TRUE;
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON public.time_entries(status);

-- 4. RLS Policy: approved_by/rejected_reason nur durch Admin/Manager setzbar
-- Bestehende UPDATE-Policy erweitern (nicht ersetzen)
CREATE POLICY IF NOT EXISTS "Admin/Manager können Status-Felder setzen"
  ON public.time_entries
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );
