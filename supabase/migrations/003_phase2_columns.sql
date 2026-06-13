-- ============================================================
-- BauZeit Pro – Phase 2 Spalten-Migration
-- Datei: supabase/migrations/003_phase2_columns.sql
-- Fügt fehlende Spalten hinzu die in Phase 2 im Code
-- referenziert werden aber in der Datenbank fehlen.
-- ============================================================

-- Phase 2: GPS-Warnung und Distanz-Felder
ALTER TABLE public.time_entries 
  ADD COLUMN IF NOT EXISTS gps_warning BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.time_entries 
  ADD COLUMN IF NOT EXISTS start_distance_m NUMERIC(10, 2);

ALTER TABLE public.time_entries 
  ADD COLUMN IF NOT EXISTS end_distance_m NUMERIC(10, 2);

-- Phase 2: Genehmigungs-Felder
ALTER TABLE public.time_entries 
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.time_entries 
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE public.time_entries 
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

-- Status um 'rejected' erweitern (DROP + RE-CREATE constraint)
ALTER TABLE public.time_entries 
  DROP CONSTRAINT IF EXISTS time_entries_status_check;

ALTER TABLE public.time_entries 
  ADD CONSTRAINT time_entries_status_check 
  CHECK (status IN ('open', 'submitted', 'approved', 'corrected', 'rejected'));

-- Index für GPS-Warnungen
CREATE INDEX IF NOT EXISTS idx_time_entries_gps_warning 
  ON public.time_entries (gps_warning) WHERE gps_warning = TRUE;

-- Index für Genehmigungen
CREATE INDEX IF NOT EXISTS idx_time_entries_approved_by 
  ON public.time_entries (approved_by) WHERE approved_by IS NOT NULL;
