// useTimeTracking Hook: Verwaltung des aktiven Zeiteintrags
// FIXES: BUG-001 (stale closure timer), BUG-002 (double reminder start),
//        BUG-006 (timer restart after pause end), BUG-012 (infinite re-renders from settings)
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { TimeEntry, BreakEntry, WorkingStatus, ConstructionSite } from '../types/database'
import {
  getOpenTimeEntry,
  getOpenBreak,
  startWork,
  startPause,
  endPause,
  stopWork,
  getSiteAssignments,
} from '../services/timeTrackingService'
import { notificationService } from '../services/notificationService'
import { calculateWorkedSeconds } from '../utils/timeUtils'

interface TimeTrackingState {
  activeEntry: TimeEntry | null
  currentBreak: BreakEntry | null
  status: WorkingStatus
  workedSeconds: number
  pausedSeconds: number
  sites: ConstructionSite[]
  selectedSiteId: string | null
  loading: boolean
  error: string | null
  syncing: boolean
}

interface AppSettings {
  maxWorkHours: number
  reminderAfterMinutes: number
}

export function useTimeTracking(
  employeeId: string | undefined,
  settings: AppSettings = { maxWorkHours: 8, reminderAfterMinutes: 15 }
) {
  // BUG-012 Fix: Einstellungen über useMemo stabilisieren damit kein infinite loop entsteht
  const stableSettings = useMemo(() => ({
    maxWorkHours: settings.maxWorkHours,
    reminderAfterMinutes: settings.reminderAfterMinutes,
  }), [settings.maxWorkHours, settings.reminderAfterMinutes])

  const [state, setState] = useState<TimeTrackingState>({
    activeEntry: null,
    currentBreak: null,
    status: 'not_started',
    workedSeconds: 0,
    pausedSeconds: 0,
    sites: [],
    selectedSiteId: null,
    loading: true,
    error: null,
    syncing: false,
  })

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Refs für stabile Zugriffe in Closures (BUG-001 Fix)
  const activeEntryRef = useRef<TimeEntry | null>(null)
  const currentBreakRef = useRef<BreakEntry | null>(null)

  // Sync Refs mit State
  useEffect(() => {
    activeEntryRef.current = state.activeEntry
    currentBreakRef.current = state.currentBreak
  }, [state.activeEntry, state.currentBreak])

  // =========================================
  // Timer (BUG-001 Fix: Refs statt Closures)
  // =========================================

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback((entry: TimeEntry) => {
    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      // BUG-001 Fix: Refs lesen statt Closure-Werte
      const currentBreak = currentBreakRef.current

      const pausedSeconds = currentBreak
        ? Math.floor((Date.now() - new Date(currentBreak.start_time).getTime()) / 1000)
        : 0

      const workedSeconds = calculateWorkedSeconds(
        entry.start_time,
        entry.pause_minutes,
        currentBreak?.start_time
      )

      setState(prev => ({ ...prev, workedSeconds, pausedSeconds }))
    }, 1000)
  }, [])

  // =========================================
  // Daten laden
  // =========================================

  const loadData = useCallback(async () => {
    if (!employeeId) return

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const [openEntry, assignedSites] = await Promise.all([
        getOpenTimeEntry(employeeId),
        getSiteAssignments(employeeId),
      ])

      const sites = assignedSites as unknown as ConstructionSite[]

      if (openEntry) {
        const openBreak = await getOpenBreak(openEntry.id)
        const status: WorkingStatus = openBreak ? 'paused' : 'working'

        const workedSeconds = calculateWorkedSeconds(
          openEntry.start_time,
          openEntry.pause_minutes,
          openBreak?.start_time
        )

        // Refs sofort setzen bevor Timer startet
        activeEntryRef.current = openEntry
        currentBreakRef.current = openBreak

        setState(prev => ({
          ...prev,
          activeEntry: openEntry,
          currentBreak: openBreak,
          status,
          workedSeconds,
          sites,
          selectedSiteId: prev.selectedSiteId || openEntry.site_id,
          loading: false,
        }))

        startTimer(openEntry)

        // BUG-002 Fix: Immer erst stoppen, dann neu starten
        notificationService.stopReminder()
        notificationService.startReminder(
          employeeId,
          openEntry.id,
          openEntry.start_time,
          stableSettings.maxWorkHours,
          stableSettings.reminderAfterMinutes
        )
      } else {
        notificationService.stopReminder()
        stopTimer()
        setState(prev => ({
          ...prev,
          activeEntry: null,
          currentBreak: null,
          status: 'not_started',
          workedSeconds: 0,
          sites,
          selectedSiteId: sites[0]?.id || null,
          loading: false,
        }))
      }
    } catch (error) {
      console.error('Fehler beim Laden der Zeiterfassungsdaten:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Daten konnten nicht geladen werden',
      }))
    }
  }, [employeeId, stableSettings.maxWorkHours, stableSettings.reminderAfterMinutes, startTimer, stopTimer])

  useEffect(() => {
    loadData()
    return () => {
      stopTimer()
    }
  }, [loadData, stopTimer])

  // =========================================
  // Aktionen
  // =========================================

  const handleStartWork = useCallback(async () => {
    if (!employeeId || !state.selectedSiteId) {
      setState(prev => ({
        ...prev,
        error: 'Bitte zuerst eine Baustelle auswählen',
      }))
      return
    }

    setState(prev => ({ ...prev, syncing: true, error: null }))

    try {
      const { entry, error } = await startWork(employeeId, state.selectedSiteId)

      if (error) {
        setState(prev => ({ ...prev, syncing: false, error }))
        return
      }

      // Refs sofort setzen
      activeEntryRef.current = entry
      currentBreakRef.current = null

      setState(prev => ({
        ...prev,
        activeEntry: entry,
        currentBreak: null,
        status: 'working',
        workedSeconds: 0,
        syncing: false,
      }))

      startTimer(entry)

      // BUG-002 Fix: Erst stoppen, dann starten
      notificationService.stopReminder()
      notificationService.startReminder(
        employeeId,
        entry.id,
        entry.start_time,
        stableSettings.maxWorkHours,
        stableSettings.reminderAfterMinutes
      )
    } catch (error) {
      setState(prev => ({
        ...prev,
        syncing: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      }))
    }
  }, [employeeId, state.selectedSiteId, stableSettings, startTimer])

  const handleStartPause = useCallback(async () => {
    if (!employeeId || !state.activeEntry) return

    setState(prev => ({ ...prev, syncing: true, error: null }))

    try {
      const { break: newBreak } = await startPause(state.activeEntry.id, employeeId)

      // Ref sofort aktualisieren
      currentBreakRef.current = newBreak

      setState(prev => ({
        ...prev,
        currentBreak: newBreak,
        status: 'paused',
        syncing: false,
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        syncing: false,
        error: error instanceof Error ? error.message : 'Pause starten fehlgeschlagen',
      }))
    }
  }, [employeeId, state.activeEntry])

  const handleEndPause = useCallback(async () => {
    if (!employeeId || !state.activeEntry) return

    setState(prev => ({ ...prev, syncing: true, error: null }))

    try {
      const { updatedEntry } = await endPause(state.activeEntry.id, employeeId)

      // BUG-006 Fix: Ref sofort auf null setzen, dann Timer neu starten
      currentBreakRef.current = null
      activeEntryRef.current = updatedEntry

      setState(prev => ({
        ...prev,
        activeEntry: updatedEntry,
        currentBreak: null,
        status: 'working',
        syncing: false,
      }))

      // BUG-006 Fix: Timer mit aktualisierten Werten neu starten
      startTimer(updatedEntry)
    } catch (error) {
      setState(prev => ({
        ...prev,
        syncing: false,
        error: error instanceof Error ? error.message : 'Pause beenden fehlgeschlagen',
      }))
    }
  }, [employeeId, state.activeEntry, startTimer])

  const handleStopWork = useCallback(async () => {
    if (!employeeId || !state.activeEntry) return

    setState(prev => ({ ...prev, syncing: true, error: null }))

    try {
      await stopWork(state.activeEntry.id, employeeId)

      notificationService.stopReminder()
      stopTimer()

      // Refs clearen
      activeEntryRef.current = null
      currentBreakRef.current = null

      setState(prev => ({
        ...prev,
        activeEntry: null,
        currentBreak: null,
        status: 'not_started',
        workedSeconds: 0,
        pausedSeconds: 0,
        syncing: false,
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        syncing: false,
        error: error instanceof Error ? error.message : 'Arbeit beenden fehlgeschlagen',
      }))
    }
  }, [employeeId, state.activeEntry, stopTimer])

  const selectSite = useCallback((siteId: string) => {
    setState(prev => ({ ...prev, selectedSiteId: siteId, error: null }))
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  // Cleanup beim Unmount
  useEffect(() => {
    return () => {
      stopTimer()
    }
  }, [stopTimer])

  return {
    ...state,
    handleStartWork,
    handleStartPause,
    handleEndPause,
    handleStopWork,
    selectSite,
    clearError,
    reload: loadData,
  }
}
