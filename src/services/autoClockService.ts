// Auto-Clock Service – Entscheidet ob auto-stempeln oder Notification senden
// Verbindet backgroundGeofenceService mit timeTrackingService
// Respektiert alle User-Settings (Auto/Notification/Manuell)

import { backgroundGeofenceService } from './backgroundGeofenceService'
import { mobileNotificationService } from './mobileNotificationService'
import type { AppSettings, ConstructionSite } from '../types/database'

// =========================================
// State
// =========================================

interface AutoClockState {
  isInitialized: boolean
  lastEnterNotifTime: number  // Spam-Schutz
  lastExitNotifTime: number
  lastMotionNotifTime: number
  autoClockInSiteId: string | null  // Letztes auto-gestempeltes Site
}

const state: AutoClockState = {
  isInitialized: false,
  lastEnterNotifTime: 0,
  lastExitNotifTime: 0,
  lastMotionNotifTime: 0,
  autoClockInSiteId: null,
}

// Mindestens 5 Minuten zwischen gleichen Notifications
const NOTIF_COOLDOWN_MS = 5 * 60 * 1000

// =========================================
// Callbacks die von EmployeeDashboard gesetzt werden
// =========================================

type AutoClockHandler = (siteId: string) => Promise<void>
type AutoClockOutHandler = () => Promise<void>

let handleAutoClockIn: AutoClockHandler | null = null
let handleAutoClockOut: AutoClockOutHandler | null = null

// =========================================
// Settings Helper
// =========================================

function getSettings(): Partial<AppSettings> {
  try {
    return JSON.parse(localStorage.getItem('bauzeit_settings') || '{}')
  } catch { return {} }
}

function isWorkDay(): boolean {
  const settings = getSettings()
  const workDays = settings.workDays || [1, 2, 3, 4, 5, 6]
  const today = new Date().getDay() // 0=So, 1=Mo, ..., 6=Sa
  const isoDay = today === 0 ? 7 : today // ISO: 1=Mo, 7=So
  return workDays.includes(isoDay)
}

// =========================================
// Geofence-Event Handler
// =========================================

async function onSiteEnter(siteId: string, siteName: string): Promise<void> {
  const settings = getSettings()
  const now = Date.now()

  // Spam-Schutz
  if (now - state.lastEnterNotifTime < NOTIF_COOLDOWN_MS) return
  state.lastEnterNotifTime = now

  // Nur an Arbeitstagen
  if (!isWorkDay()) return

  if (settings.geofenceAutoClockIn && !settings.geofenceNotifyOnly) {
    // VOLL-AUTO: Direkt einstempeln
    if (handleAutoClockIn) {
      try {
        await handleAutoClockIn(siteId)
        state.autoClockInSiteId = siteId
        // Bestätigungs-Notification
        mobileNotificationService.showImmediateReminder(
          '✅ Automatisch eingestempelt',
          `Du wurdest an "${siteName}" eingestempelt.`
        ).catch(() => {})
      } catch (err) {
        console.warn('Auto-Clock-In fehlgeschlagen:', err)
      }
    }
  } else if (settings.geofenceAutoClockIn) {
    // NOTIFICATION-MODUS: Fragen
    mobileNotificationService.showImmediateReminder(
      `📍 Du bist an "${siteName}" angekommen`,
      'Einstempeln? Öffne die App zum Einstempeln.'
    ).catch(() => {})
  }
}

async function onSiteExit(siteId: string, siteName: string): Promise<void> {
  const settings = getSettings()
  const now = Date.now()

  // Spam-Schutz
  if (now - state.lastExitNotifTime < NOTIF_COOLDOWN_MS) return
  state.lastExitNotifTime = now

  if (settings.geofenceAutoClockOut && !settings.geofenceNotifyOnly) {
    // VOLL-AUTO: Direkt ausstempeln
    if (handleAutoClockOut) {
      try {
        await handleAutoClockOut()
        state.autoClockInSiteId = null
        mobileNotificationService.showImmediateReminder(
          '✅ Automatisch ausgestempelt',
          `Du wurdest an "${siteName}" ausgestempelt.`
        ).catch(() => {})
      } catch (err) {
        console.warn('Auto-Clock-Out fehlgeschlagen:', err)
      }
    }
  } else if (settings.geofenceAutoClockOut) {
    // NOTIFICATION-MODUS: Fragen
    mobileNotificationService.showImmediateReminder(
      `📍 Du hast "${siteName}" verlassen`,
      'Ausstempeln? Öffne die App zum Ausstempeln.'
    ).catch(() => {})
  }
}

async function onMotionDetected(speedKmh: number): Promise<void> {
  const settings = getSettings()
  const now = Date.now()

  if (!settings.motionDetectionEnabled) return
  if (!isWorkDay()) return

  // Spam-Schutz: Max 1x pro 30 Min
  if (now - state.lastMotionNotifTime < 30 * 60 * 1000) return
  state.lastMotionNotifTime = now

  mobileNotificationService.showImmediateReminder(
    '🚗 Du scheinst zur Arbeit zu fahren',
    'Vergiss nicht dich einzustempeln!'
  ).catch(() => {})
}

// =========================================
// Public API
// =========================================

/**
 * Initialisiert den Auto-Clock Service
 * Registriert Event-Handler beim backgroundGeofenceService
 */
function initialize(sites: ConstructionSite[]): void {
  if (state.isInitialized) return

  const settings = getSettings()
  if (!settings.backgroundGpsEnabled) return

  // Geofence-Events registrieren
  backgroundGeofenceService.onGeofenceEnter(onSiteEnter)
  backgroundGeofenceService.onGeofenceExit(onSiteExit)
  backgroundGeofenceService.onMotionChange(onMotionDetected)

  // GPS-Monitoring starten
  backgroundGeofenceService.startMonitoring(sites)

  state.isInitialized = true
}

/**
 * Stoppt den Auto-Clock Service
 */
function stop(): void {
  backgroundGeofenceService.stopMonitoring()
  state.isInitialized = false
  state.autoClockInSiteId = null
}

/**
 * Setzt die Callbacks für Auto-Stempelung
 * Wird vom EmployeeDashboard/useTimeTracking gesetzt
 */
function setAutoClockHandlers(
  clockIn: AutoClockHandler,
  clockOut: AutoClockOutHandler
): void {
  handleAutoClockIn = clockIn
  handleAutoClockOut = clockOut
}

/**
 * Aktualisiert die überwachten Baustellen
 */
function updateSites(sites: ConstructionSite[]): void {
  if (!state.isInitialized) return
  backgroundGeofenceService.stopMonitoring()
  backgroundGeofenceService.startMonitoring(sites)
}

/**
 * Gibt den aktuellen Auto-Clock State zurück
 */
function getAutoClockState(): Readonly<AutoClockState> {
  return { ...state }
}

// =========================================
// Export
// =========================================

export const autoClockService = {
  initialize,
  stop,
  setAutoClockHandlers,
  updateSites,
  getAutoClockState,
}

export default autoClockService
