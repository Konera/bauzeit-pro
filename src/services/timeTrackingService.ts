// Kern-Service für Zeiterfassung
import { supabase } from '../lib/supabase'
import type { TimeEntry, BreakEntry, GeoPosition, ConstructionSite, Profile } from '../types/database'
import { offlineSyncService } from './offlineSyncService'
import { gpsService } from './gpsService'
import { locationService } from './locationService'
import { hapticsService } from './hapticsService'
import { parseISO, differenceInMinutes } from 'date-fns'

// =========================================
// GPS Helper
// =========================================

async function tryGetPosition(): Promise<GeoPosition | null> {
  return locationService.getCurrentPosition()
}

// =========================================
// Pausen-Minuten berechnen
// =========================================

function calcPauseMinutes(
  breaks: Array<{ start_time: string; end_time: string | null }>
): number {
  return breaks.reduce((total, brk) => {
    const end = brk.end_time ? parseISO(brk.end_time) : new Date()
    return total + Math.max(0, differenceInMinutes(end, parseISO(brk.start_time)))
  }, 0)
}

// =========================================
// Kern-Abfragen
// =========================================

export async function getOpenTimeEntry(employeeId: string): Promise<TimeEntry | null> {
  const { data, error } = await supabase
    .from('time_entries')
    .select(`*, site:construction_sites(*), breaks:break_entries(*)`)
    .eq('employee_id', employeeId)
    .is('end_time', null)
    .order('start_time', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Fehler beim Laden des offenen Eintrags:', error)
    return offlineSyncService.getLocalOpenEntry(employeeId)
  }
  return data as TimeEntry | null
}

export async function getOpenBreak(timeEntryId: string): Promise<BreakEntry | null> {
  const { data, error } = await supabase
    .from('break_entries')
    .select('*')
    .eq('time_entry_id', timeEntryId)
    .is('end_time', null)
    .order('start_time', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return null
  return data as BreakEntry | null
}

// =========================================
// Arbeit starten
// =========================================

export async function startWork(
  employeeId: string,
  siteId: string
): Promise<{ entry: TimeEntry; error?: string }> {
  // BUG-005 Fix: Explizite Validierung vor DB-Aufruf
  if (!siteId || siteId.trim() === '') {
    throw new Error('Keine Baustelle ausgewählt. Bitte eine Baustelle auswählen.')
  }
  if (!employeeId || employeeId.trim() === '') {
    throw new Error('Mitarbeiter-ID fehlt. Bitte neu einloggen.')
  }
  const existing = await getOpenTimeEntry(employeeId)
  if (existing) {
    return { entry: existing, error: 'Du hast bereits einen aktiven Zeiteintrag. Bitte zuerst Arbeit beenden.' }
  }

  const position = await tryGetPosition()
  const now = new Date().toISOString()

  // Phase 2: Geofence-Check und GPS-Warnung berechnen
  let gpsWarning = false
  let startDistanceM: number | null = null
  if (position) {
    try {
      const { data: site } = await supabase
        .from('construction_sites')
        .select('gps_lat, gps_lng, gps_radius_m')
        .eq('id', siteId)
        .maybeSingle()

      if (site && site.gps_lat != null && site.gps_lng != null) {
        const fence = gpsService.checkGeofence(
          position,
          site as ConstructionSite
        )
        startDistanceM = fence.distanceMeters
        gpsWarning = !fence.isInside
      }
    } catch {
      // Geofence-Check ist nicht-blockierend
    }
  }

  const baseEntry = {
    employee_id: employeeId,
    site_id: siteId,
    start_time: now,
    end_time: null,
    pause_minutes: 0,
    total_minutes: 0,
    status: 'open',
    start_lat: position?.lat ?? null,
    start_lng: position?.lng ?? null,
    end_lat: null,
    end_lng: null,
    source: 'mobile',
    admin_comment: null,
  }

  const phase2Entry = {
    ...baseEntry,
    gps_warning: gpsWarning,
    start_distance_m: startDistanceM,
    end_distance_m: null,
  }

  // Erst mit Phase-2-Feldern versuchen
  let result = await supabase
    .from('time_entries')
    .insert(phase2Entry)
    .select(`*, site:construction_sites(*), breaks:break_entries(*)`)
    .single()

  if (result.error) {
    console.warn('startWork Phase-2 Insert fehlgeschlagen, versuche Basic-Insert:', result.error.message)
    // Fallback: Ohne Phase-2-Spalten
    result = await supabase
      .from('time_entries')
      .insert(baseEntry)
      .select(`*, site:construction_sites(*), breaks:break_entries(*)`)
      .single()
  }

  if (result.error) {
    console.warn('Online-Speicherung fehlgeschlagen, offline speichern:', result.error.message)
    const localEntry = {
      ...baseEntry,
      id: crypto.randomUUID() as string,
      created_at: now,
      updated_at: now,
      status: 'open' as const,
    } as TimeEntry
    const saved = await offlineSyncService.saveLocalEntry(localEntry)
    return { entry: saved }
  }

  await hapticsService.vibrateSuccess()
  return { entry: result.data as TimeEntry }
}

// =========================================
// Pause starten
// =========================================

export async function startPause(
  timeEntryId: string,
  employeeId: string
): Promise<{ break: BreakEntry; error?: string }> {
  const existing = await getOpenBreak(timeEntryId)
  if (existing) return { break: existing, error: 'Eine Pause läuft bereits.' }

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('break_entries')
    .insert({ time_entry_id: timeEntryId, start_time: now, end_time: null })
    .select('*')
    .single()

  if (error) throw new Error('Pause starten fehlgeschlagen: ' + error.message)

  await createAuditLog({
    entity_type: 'time_entry', entity_id: timeEntryId,
    action: 'pause_started',
    old_value: null, new_value: { start_time: now },
    changed_by: employeeId,
  })

  await hapticsService.vibrateShort()
  return { break: data as BreakEntry }
}

// =========================================
// Pause beenden
// =========================================

export async function endPause(
  timeEntryId: string,
  employeeId: string
): Promise<{ updatedEntry: TimeEntry; error?: string }> {
  const openBreak = await getOpenBreak(timeEntryId)
  if (!openBreak) throw new Error('Keine offene Pause gefunden')

  const now = new Date().toISOString()

  await supabase.from('break_entries').update({ end_time: now }).eq('id', openBreak.id)

  const { data: allBreaks } = await supabase
    .from('break_entries').select('*').eq('time_entry_id', timeEntryId)

  const totalPauseMinutes = calcPauseMinutes((allBreaks || []) as BreakEntry[])

  const { data, error } = await supabase
    .from('time_entries')
    .update({ pause_minutes: totalPauseMinutes, updated_at: now })
    .eq('id', timeEntryId)
    .select(`*, site:construction_sites(*), breaks:break_entries(*)`)
    .single()

  if (error) throw new Error('Pause beenden fehlgeschlagen: ' + error.message)

  await createAuditLog({
    entity_type: 'time_entry', entity_id: timeEntryId,
    action: 'pause_ended',
    old_value: { break_id: openBreak.id },
    new_value: { end_time: now, pause_minutes: totalPauseMinutes },
    changed_by: employeeId,
  })

  return { updatedEntry: data as TimeEntry }
}

// =========================================
// Arbeit beenden
// =========================================

export async function stopWork(
  timeEntryId: string,
  employeeId: string
): Promise<{ entry: TimeEntry; error?: string }> {
  const now = new Date().toISOString()
  const position = await tryGetPosition()

  // Phase 2: Geofence-Check für End-Position
  let endDistanceM: number | null = null
  let shouldUpdateGpsWarning = false
  if (position) {
    try {
      const { data: entry } = await supabase
        .from('time_entries')
        .select('site_id')
        .eq('id', timeEntryId)
        .maybeSingle()

      if (entry) {
        const { data: site } = await supabase
          .from('construction_sites')
          .select('gps_lat, gps_lng, gps_radius_m')
          .eq('id', entry.site_id)
          .maybeSingle()

        if (site && site.gps_lat != null && site.gps_lng != null) {
          const fence = gpsService.checkGeofence(
            position,
            site as ConstructionSite
          )
          endDistanceM = fence.distanceMeters
          if (!fence.isInside) shouldUpdateGpsWarning = true
        }
      }
    } catch {
      // Geofence-Check nicht-blockierend
    }
  }

  // Offene Pause schließen
  const openBreak = await getOpenBreak(timeEntryId)
  if (openBreak) {
    await supabase.from('break_entries').update({ end_time: now }).eq('id', openBreak.id)
  }

  // Alle Pausen laden und Minuten berechnen
  const { data: allBreaks } = await supabase
    .from('break_entries').select('*').eq('time_entry_id', timeEntryId)
  const totalPauseMinutes = calcPauseMinutes((allBreaks || []) as BreakEntry[])

  // Startzeit holen (ohne Phase-2-Felder als Fallback)
  let startTime: string | undefined
  let existingGpsWarning = false
  try {
    const { data: current } = await supabase
      .from('time_entries').select('start_time, gps_warning').eq('id', timeEntryId).maybeSingle()
    startTime = (current as { start_time: string; gps_warning: boolean } | null)?.start_time
    existingGpsWarning = (current as { start_time: string; gps_warning: boolean } | null)?.gps_warning ?? false
  } catch {
    // Fallback: gps_warning Spalte existiert noch nicht
    const { data: current } = await supabase
      .from('time_entries').select('start_time').eq('id', timeEntryId).maybeSingle()
    startTime = (current as { start_time: string } | null)?.start_time
  }

  const totalMinutes = startTime
    ? Math.max(0, differenceInMinutes(new Date(now), parseISO(startTime)) - totalPauseMinutes)
    : 0

  // Update mit Phase-2-Feldern versuchen, Fallback ohne
  let data: unknown = null
  let error: { message: string } | null = null

  const phase2Update = {
    end_time: now,
    pause_minutes: totalPauseMinutes,
    total_minutes: totalMinutes,
    status: 'submitted',
    end_lat: position?.lat ?? null,
    end_lng: position?.lng ?? null,
    end_distance_m: endDistanceM,
    gps_warning: existingGpsWarning || shouldUpdateGpsWarning,
    updated_at: now,
  }

  const result1 = await supabase
    .from('time_entries')
    .update(phase2Update)
    .eq('id', timeEntryId)
    .select(`*, site:construction_sites(*), breaks:break_entries(*)`)
    .single()

  if (result1.error) {
    console.warn('stopWork Phase-2 Update fehlgeschlagen, versuche Basic-Update:', result1.error.message)
    // Fallback: Ohne Phase-2-Spalten
    const basicUpdate = {
      end_time: now,
      pause_minutes: totalPauseMinutes,
      total_minutes: totalMinutes,
      status: 'submitted',
      end_lat: position?.lat ?? null,
      end_lng: position?.lng ?? null,
      updated_at: now,
    }
    const result2 = await supabase
      .from('time_entries')
      .update(basicUpdate)
      .eq('id', timeEntryId)
      .select(`*, site:construction_sites(*), breaks:break_entries(*)`)
      .single()

    data = result2.data
    error = result2.error
  } else {
    data = result1.data
    error = result1.error
  }

  if (error) throw new Error('Arbeit beenden fehlgeschlagen: ' + error.message)

  await createAuditLog({
    entity_type: 'time_entry', entity_id: timeEntryId,
    action: 'work_stopped',
    old_value: { status: 'open' },
    new_value: { end_time: now, total_minutes: totalMinutes, status: 'submitted' },
    changed_by: employeeId,
  })

  await hapticsService.vibrateWarning()
  return { entry: data as TimeEntry }
}

// =========================================
// Admin: Genehmigen / Korrigieren
// =========================================

export async function approveTimeEntry(
  timeEntryId: string, adminId: string, comment?: string
): Promise<TimeEntry> {
  const { data: current } = await supabase.from('time_entries').select('*').eq('id', timeEntryId).maybeSingle()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('time_entries')
    .update({
      status: 'approved',
      admin_comment: comment || null,
      approved_by: adminId,
      approved_at: now,
      rejected_reason: null,
      updated_at: now,
    })
    .eq('id', timeEntryId)
    .select(`*, employee:profiles!time_entries_employee_id_fkey(id, full_name, role), site:construction_sites(id, name)`)
    .single()

  if (error) throw new Error('Genehmigung fehlgeschlagen: ' + error.message)
  await createAuditLog({
    entity_type: 'time_entry', entity_id: timeEntryId,
    action: 'approved', old_value: current,
    new_value: { status: 'approved', admin_comment: comment, approved_by: adminId, approved_at: now },
    changed_by: adminId,
  })
  return data as TimeEntry
}

export async function correctTimeEntry(
  timeEntryId: string, adminId: string,
  updates: Partial<Pick<TimeEntry, 'start_time' | 'end_time' | 'pause_minutes' | 'admin_comment'>>
): Promise<TimeEntry> {
  // Phase 2: Kommentar-Pflicht bei Korrekturen
  if (!updates.admin_comment || updates.admin_comment.trim() === '') {
    throw new Error('Ein Kommentar ist bei Korrekturen Pflicht.')
  }

  const { data: current } = await supabase.from('time_entries').select('*').eq('id', timeEntryId).maybeSingle()
  const cur = current as TimeEntry | null

  let totalMinutes = cur?.total_minutes || 0
  if (updates.start_time || updates.end_time) {
    const s = updates.start_time || cur?.start_time
    const e = updates.end_time || cur?.end_time
    const p = updates.pause_minutes ?? cur?.pause_minutes ?? 0
    if (s && e) totalMinutes = Math.max(0, differenceInMinutes(parseISO(e), parseISO(s)) - p)
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('time_entries')
    .update({ ...updates, total_minutes: totalMinutes, status: 'corrected', updated_at: now })
    .eq('id', timeEntryId)
    .select(`*, employee:profiles!time_entries_employee_id_fkey(id, full_name, role), site:construction_sites(id, name)`)
    .single()

  if (error) throw new Error('Korrektur fehlgeschlagen: ' + error.message)
  await createAuditLog({
    entity_type: 'time_entry', entity_id: timeEntryId,
    action: 'corrected', old_value: current, new_value: updates, changed_by: adminId,
  })
  return data as TimeEntry
}

// =========================================
// Admin: Ablehnen (Phase 2)
// =========================================

export async function rejectTimeEntry(
  timeEntryId: string, adminId: string, reason: string
): Promise<TimeEntry> {
  if (!reason || reason.trim() === '') {
    throw new Error('Ein Ablehnungsgrund ist Pflicht.')
  }

  const { data: current } = await supabase.from('time_entries').select('*').eq('id', timeEntryId).maybeSingle()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('time_entries')
    .update({
      status: 'rejected',
      rejected_reason: reason,
      approved_by: adminId,
      approved_at: now,
      updated_at: now,
    })
    .eq('id', timeEntryId)
    .select(`*, employee:profiles!time_entries_employee_id_fkey(id, full_name, role), site:construction_sites(id, name)`)
    .single()

  if (error) throw new Error('Ablehnung fehlgeschlagen: ' + error.message)
  await createAuditLog({
    entity_type: 'time_entry', entity_id: timeEntryId,
    action: 'rejected', old_value: current,
    new_value: { status: 'rejected', rejected_reason: reason, approved_by: adminId },
    changed_by: adminId,
  })
  return data as TimeEntry
}

// =========================================
// Daten laden
// =========================================

export async function getTimeEntries(options: {
  employeeId?: string
  siteId?: string
  from?: string
  to?: string
  status?: string
  limit?: number
}): Promise<TimeEntry[]> {
  // Versuche mit explizitem FK (nötig wenn approved_by FK existiert)
  let query = supabase
    .from('time_entries')
    .select(`*, employee:profiles!time_entries_employee_id_fkey(id, full_name, role), site:construction_sites(id, name, address, gps_lat, gps_lng, gps_radius_m), breaks:break_entries(*)`)
    .order('start_time', { ascending: false })

  if (options.employeeId) query = query.eq('employee_id', options.employeeId)
  if (options.siteId)     query = query.eq('site_id', options.siteId)
  if (options.status)     query = query.eq('status', options.status)
  if (options.from)       query = query.gte('start_time', options.from)
  if (options.to)         query = query.lte('start_time', options.to)
  if (options.limit)      query = query.limit(options.limit)

  let { data, error } = await query

  // Fallback: Ohne FK-Hint (wenn approved_by Spalte noch nicht existiert)
  if (error) {
    console.warn('getTimeEntries FK-Query fehlgeschlagen, versuche ohne FK-Hint:', error.message)
    let fallbackQuery = supabase
      .from('time_entries')
      .select(`*, site:construction_sites(id, name, address, gps_lat, gps_lng, gps_radius_m), breaks:break_entries(*)`)
      .order('start_time', { ascending: false })

    if (options.employeeId) fallbackQuery = fallbackQuery.eq('employee_id', options.employeeId)
    if (options.siteId)     fallbackQuery = fallbackQuery.eq('site_id', options.siteId)
    if (options.status)     fallbackQuery = fallbackQuery.eq('status', options.status)
    if (options.from)       fallbackQuery = fallbackQuery.gte('start_time', options.from)
    if (options.to)         fallbackQuery = fallbackQuery.lte('start_time', options.to)
    if (options.limit)      fallbackQuery = fallbackQuery.limit(options.limit)

    const fallbackResult = await fallbackQuery
    data = fallbackResult.data
    error = fallbackResult.error
  }

  if (error) {
    console.error('getTimeEntries Fehler:', error.message, error)
    throw error
  }
  return (data || []) as TimeEntry[]
}

export async function getAllActiveEmployees(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles').select('*').eq('active', true).order('full_name')
  if (error) throw error
  return (data || []) as Profile[]
}

export async function getConstructionSites(includeInactive = false): Promise<ConstructionSite[]> {
  let query = supabase.from('construction_sites').select(`*, manager:profiles(id, full_name)`).order('name')
  if (!includeInactive) query = query.eq('active', true)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as ConstructionSite[]
}

export async function getSiteAssignments(employeeId: string): Promise<ConstructionSite[]> {
  try {
    // Primäre Abfrage: Join über PostgREST
    const { data, error } = await supabase
      .from('site_assignments')
      .select(`site:construction_sites(*)`)
      .eq('employee_id', employeeId)

    if (error) {
      console.error('getSiteAssignments Join-Fehler:', error.message, error)
      // Fallback: Separate Abfragen
      return await getSiteAssignmentsFallback(employeeId)
    }

    const sites = (data || []).map((a: Record<string, unknown>) => a.site).filter(Boolean)
    
    if (sites.length === 0) {
      console.warn('getSiteAssignments: Keine Baustellen gefunden für', employeeId, '– versuche Fallback')
      return await getSiteAssignmentsFallback(employeeId)
    }

    return sites as ConstructionSite[]
  } catch (err) {
    console.error('getSiteAssignments Fehler:', err)
    return await getSiteAssignmentsFallback(employeeId)
  }
}

/**
 * Fallback: Site-IDs separat laden, dann Baustellen einzeln abfragen.
 * Umgeht mögliche PostgREST-Join-Probleme im Capacitor WebView.
 */
async function getSiteAssignmentsFallback(employeeId: string): Promise<ConstructionSite[]> {
  try {
    // Schritt 1: Zuweisungen laden (nur site_id)
    const { data: assignments, error: aErr } = await supabase
      .from('site_assignments')
      .select('site_id')
      .eq('employee_id', employeeId)

    if (aErr) {
      console.error('Fallback site_assignments Fehler:', aErr.message)
      return []
    }

    if (!assignments || assignments.length === 0) {
      console.warn('Fallback: Keine Baustellenzuweisungen für', employeeId)
      return []
    }

    const siteIds = assignments.map(a => a.site_id)

    // Schritt 2: Baustellen laden
    const { data: sites, error: sErr } = await supabase
      .from('construction_sites')
      .select('*')
      .in('id', siteIds)

    if (sErr) {
      console.error('Fallback construction_sites Fehler:', sErr.message)
      return []
    }

    console.log('Fallback erfolgreich:', sites?.length, 'Baustellen geladen')
    return (sites || []) as ConstructionSite[]
  } catch (err) {
    console.error('getSiteAssignmentsFallback Fehler:', err)
    return []
  }
}

// =========================================
// Audit-Log
// =========================================

async function createAuditLog(log: {
  entity_type: string; entity_id: string; action: string
  old_value: unknown; new_value: unknown; changed_by: string
}) {
  const { error } = await supabase.from('audit_logs').insert({
    entity_type: log.entity_type,
    entity_id: log.entity_id,
    action: log.action,
    old_value: log.old_value as Record<string, unknown>,
    new_value: log.new_value as Record<string, unknown>,
    changed_by: log.changed_by,
  })
  if (error) console.warn('Audit-Log Fehler:', error.message)
}
