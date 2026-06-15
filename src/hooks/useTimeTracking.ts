// useTimeTracking Hook: Verwaltung des aktiven Zeiteintrags
// FIXES: BUG-001 (stale closure timer), BUG-002 (double reminder start),
//        BUG-006 (timer restart after pause end), BUG-012 (infinite re-renders from settings)
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

// H1 FIX: Mutex Ref für Doppelklick-Schutz (synchron, nicht async state)
const isSubmittingRef = { current: false }
import type { TimeEntry, BreakEntry, WorkingStatus, ConstructionSite } from '../types/database'
import {
  getOpenTimeEntry,
  getOpenBreak,
  startWork,
  startPause,
  endPause,
  stopWork,
  forceStopWork,
  getSiteAssignments,
} from '../services/timeTrackingService'
import { mobileNotificationService } from '../services/mobileNotificationService'
import { locationService } from '../services/locationService'
import { pauseTimerService } from '../services/pauseTimerService'
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
  // Phase 2: GPS
  gpsStatus: 'checking' | 'available' | 'unavailable' | 'denied'
  gpsWarning: string | null
}

interface AppSettings {
  maxWorkHours: number
  reminderAfterMinutes: number
  maxPauseMinutes: number
  pauseWarningBeforeMinutes: number
  autoPauseEnd: boolean
}

export function useTimeTracking(
  employeeId: string | undefined,
  settings: AppSettings = { maxWorkHours: 8, reminderAfterMinutes: 15, maxPauseMinutes: 45, pauseWarningBeforeMinutes: 5, autoPauseEnd: false }
) {
  // BUG-012 Fix: Einstellungen über useMemo stabilisieren damit kein infinite loop entsteht
  const stableSettings = useMemo(() => ({
    maxWorkHours: settings.maxWorkHours,
    reminderAfterMinutes: settings.reminderAfterMinutes,
    maxPauseMinutes: settings.maxPauseMinutes,
    pauseWarningBeforeMinutes: settings.pauseWarningBeforeMinutes,
    autoPauseEnd: settings.autoPauseEnd,
  }), [settings.maxWorkHours, settings.reminderAfterMinutes, settings.maxPauseMinutes, settings.pauseWarningBeforeMinutes, settings.autoPauseEnd])

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
    gpsStatus: 'checking',
    gpsWarning: null,
  })

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Refs für stabile Zugriffe in Closures (BUG-001 Fix)
  const activeEntryRef = useRef<TimeEntry | null>(null)
  const currentBreakRef = useRef<BreakEntry | null>(null)

  // GPS-Status: Einfacher Check im Hintergrund (blockiert NIE die UI)
  useEffect(() => {
    // GPS-Status verzögert prüfen — App soll zuerst vollständig laden
    const timer = setTimeout(async () => {
      try {
        const pos = await locationService.getCurrentPosition()
        setState(prev => ({
          ...prev,
          gpsStatus: pos ? 'available' : 'unavailable',
        }))
      } catch {
        setState(prev => ({ ...prev, gpsStatus: 'unavailable' }))
      }
    }, 2000) // 2s warten bis App geladen ist
    return () => clearTimeout(timer)
  }, [])

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
      // Promise.allSettled: Einzelner Fehler blockiert nicht alles
      const [entryResult, sitesResult] = await Promise.allSettled([
        getOpenTimeEntry(employeeId),
        getSiteAssignments(employeeId),
      ])

      const openEntry = entryResult.status === 'fulfilled' ? entryResult.value : null
      const assignedSites = sitesResult.status === 'fulfilled' ? sitesResult.value : []

      if (entryResult.status === 'rejected') {
        console.error('getOpenTimeEntry fehlgeschlagen:', entryResult.reason)
      }
      if (sitesResult.status === 'rejected') {
        console.error('getSiteAssignments fehlgeschlagen:', sitesResult.reason)
      }

      const sites = assignedSites as unknown as ConstructionSite[]
      console.log('📊 Daten geladen:', { openEntry: !!openEntry, sites: sites.length, employeeId })

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

        // Notifications NON-BLOCKING (dürfen UI nicht blockieren)
        ;(async () => {
          try {
            await mobileNotificationService.cancelWorkReminder()
            await mobileNotificationService.scheduleWorkReminder({
              timeEntryId: openEntry.id,
              employeeId,
              startTime: openEntry.start_time,
              maxHours: stableSettings.maxWorkHours,
            })
            await mobileNotificationService.scheduleRepeatedStopReminder({
              timeEntryId: openEntry.id,
              employeeId,
              intervalMinutes: stableSettings.reminderAfterMinutes,
            })
          } catch (err) {
            console.warn('Notification-Setup fehlgeschlagen (non-blocking):', err)
          }
        })()
      } else {
        // Notifications NON-BLOCKING stornieren
        mobileNotificationService.cancelWorkReminder().catch(() => {})
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
    // H1 FIX: Synchroner Doppelklick-Schutz
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true

    if (!employeeId || !state.selectedSiteId) {
      setState(prev => ({
        ...prev,
        error: 'Bitte zuerst eine Baustelle auswählen',
      }))
      isSubmittingRef.current = false
      return
    }

    setState(prev => ({ ...prev, syncing: true, error: null, gpsWarning: null }))

    // 15s HARD-TIMEOUT: Button darf NIE ewig laden
    const timeoutId = setTimeout(() => {
      console.error('handleStartWork: 15s Hard-Timeout erreicht!')
      setState(prev => ({
        ...prev,
        syncing: false,
        error: 'Zeitüberschreitung. Bitte nochmal versuchen.',
      }))
      isSubmittingRef.current = false
    }, 15000)

    try {
      const { entry, error } = await startWork(employeeId, state.selectedSiteId)

      clearTimeout(timeoutId)

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

      // Notifications NON-BLOCKING (dürfen UI nicht blockieren)
      ;(async () => {
        try {
          await mobileNotificationService.cancelWorkReminder()
          await mobileNotificationService.scheduleWorkReminder({
            timeEntryId: entry.id,
            employeeId,
            startTime: entry.start_time,
            maxHours: stableSettings.maxWorkHours,
          })
          await mobileNotificationService.scheduleRepeatedStopReminder({
            timeEntryId: entry.id,
            employeeId,
            intervalMinutes: stableSettings.reminderAfterMinutes,
          })
        } catch (err) {
          console.warn('Notification-Setup fehlgeschlagen (non-blocking):', err)
        }
      })()
    } catch (error) {
      clearTimeout(timeoutId)
      setState(prev => ({
        ...prev,
        syncing: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      }))
    } finally {
      isSubmittingRef.current = false
    }
  }, [employeeId, state.selectedSiteId, state.sites, stableSettings, startTimer])

  const handleStartPause = useCallback(async () => {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    if (!employeeId || !state.activeEntry) { isSubmittingRef.current = false; return }

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

      // Phase 3: Pausen-Timer NON-BLOCKING
      ;(async () => {
        try {
          await pauseTimerService.schedulePauseWarning({
            pauseStartTime: newBreak.start_time,
            maxPauseMinutes: stableSettings.maxPauseMinutes,
            warningBeforeMinutes: stableSettings.pauseWarningBeforeMinutes,
          })
          await pauseTimerService.schedulePauseAlarm({
            pauseStartTime: newBreak.start_time,
            maxPauseMinutes: stableSettings.maxPauseMinutes,
          })
        } catch (err) {
          console.warn('Pausen-Timer-Setup fehlgeschlagen (non-blocking):', err)
        }
      })()
    } catch (error) {
      setState(prev => ({
        ...prev,
        syncing: false,
        error: error instanceof Error ? error.message : 'Pause starten fehlgeschlagen',
      }))
    } finally {
      isSubmittingRef.current = false
    }
  }, [employeeId, state.activeEntry, stableSettings])

  const handleEndPause = useCallback(async () => {
    if (!employeeId || !state.activeEntry) return

    setState(prev => ({ ...prev, syncing: true, error: null }))

    try {
      const { updatedEntry } = await endPause(state.activeEntry.id, employeeId)

      // Phase 3: Pausen-Alarme stornieren NON-BLOCKING
      pauseTimerService.cancelPauseAlarms().catch(() => {})

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
    const entryId = state.activeEntry.id

    // UI sofort zurücksetzen — NICHT auf Netzwerk warten
    mobileNotificationService.cancelWorkReminder().catch(() => {})
    stopTimer()
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

    // Netzwerk-Call im Hintergrund — UI ist bereits zurückgesetzt
    try {
      await forceStopWork(entryId, employeeId)
      console.log('[StopWork] Erfolgreich')
    } catch (error) {
      console.error('[StopWork] Hintergrund-Fehler (UI bereits zurückgesetzt):', error)
      // Eintrag trotzdem als gestoppt anzeigen — beim nächsten Laden wird es korrigiert
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
