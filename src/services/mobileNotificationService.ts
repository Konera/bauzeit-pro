// Mobile Notification Service – Vereinheitlichte Benachrichtigungs-Schicht
// Nutzt Capacitor LocalNotifications nativ, Web Notification API als Fallback
// Benachrichtigungen dürfen NIEMALS die App crashen.

import { isNativeApp } from '../utils/platform'
import {
  showLocalNotification,
  requestNotificationPermission as webRequestPermission,
  isNotificationGranted,
} from './notificationService'

// =========================================
// Konstanten für Notification IDs (nativ)
// =========================================

const WORK_REMINDER_ID = 1001
const STOP_REMINDER_BASE_ID = 2000
const TEST_NOTIFICATION_ID = 9999
const MAX_SCHEDULED_REMINDERS = 12 // Max 3 Stunden bei 15-Min-Intervall

// =========================================
// Web-Timer-Referenzen (Fallback)
// =========================================

let webTimers: ReturnType<typeof setTimeout>[] = []
let webIntervalId: ReturnType<typeof setInterval> | null = null

// =========================================
// Capacitor Plugin dynamisch laden
// =========================================

async function getCapacitorLocalNotifications() {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  return LocalNotifications
}

// =========================================
// Berechtigung anfragen
// =========================================

/**
 * Fordert die Benachrichtigungs-Berechtigung an.
 * - Nativ: Capacitor LocalNotifications.requestPermissions()
 * - Web: Notification.requestPermission()
 */
export async function requestNotificationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  try {
    if (isNativeApp()) {
      const LocalNotifications = await getCapacitorLocalNotifications()
      const status = await LocalNotifications.requestPermissions()
      if (status.display === 'granted') return 'granted'
      if (status.display === 'denied') return 'denied'
      return 'prompt'
    }

    // Web-Fallback
    const result = await webRequestPermission()
    return result as 'granted' | 'denied' | 'prompt'
  } catch {
    return 'denied'
  }
}

// =========================================
// Arbeits-Erinnerung planen (einmalig)
// =========================================

/**
 * Plant eine Erinnerung nach maxHours Stunden Arbeitszeit.
 * - Nativ: LocalNotifications.schedule() mit Zeitpunkt-Trigger
 * - Web: setTimeout + showLocalNotification
 */
export async function scheduleWorkReminder(params: {
  timeEntryId: string
  employeeId: string
  startTime: string
  maxHours: number
}): Promise<void> {
  const { startTime, maxHours, timeEntryId, employeeId } = params
  const triggerTime = new Date(new Date(startTime).getTime() + maxHours * 60 * 60 * 1000)
  const now = Date.now()
  const delayMs = triggerTime.getTime() - now

  // Bereits überschritten → sofort anzeigen
  if (delayMs <= 0) {
    await showImmediateReminder(
      '⚠️ Arbeitszeit überschritten!',
      `Du arbeitest seit über ${maxHours} Stunden. Vergiss nicht auszustempeln!`,
    )
    return
  }

  try {
    if (isNativeApp()) {
      const LocalNotifications = await getCapacitorLocalNotifications()
      await LocalNotifications.schedule({
        notifications: [{
          id: WORK_REMINDER_ID,
          title: '⚠️ Arbeitszeit überschritten!',
          body: `Du arbeitest seit über ${maxHours} Stunden. Vergiss nicht auszustempeln!`,
          schedule: { at: triggerTime },
          sound: 'default',
          extra: { timeEntryId, employeeId, type: 'overtime_warning' },
        }],
      })
      return
    }

    // Web-Fallback
    const timerId = setTimeout(async () => {
      await showLocalNotification({
        type: 'overtime_warning',
        title: '⚠️ Arbeitszeit überschritten!',
        message: `Du arbeitest seit über ${maxHours} Stunden. Vergiss nicht auszustempeln!`,
        actions: [
          { action: 'stop_work', title: 'Arbeit beenden' },
          { action: 'continue', title: 'Weiterarbeiten' },
        ],
        data: { timeEntryId, employeeId },
      })
    }, delayMs)
    webTimers.push(timerId)
  } catch (error) {
    console.warn('Arbeits-Erinnerung konnte nicht geplant werden:', error)
  }
}

// =========================================
// Wiederholte Stop-Erinnerung
// =========================================

/**
 * Plant wiederholte Erinnerungen alle intervalMinutes Minuten.
 * - Nativ: Mehrere geplante Notifications in die Zukunft
 * - Web: setInterval + showLocalNotification
 */
export async function scheduleRepeatedStopReminder(params: {
  timeEntryId: string
  employeeId: string
  intervalMinutes: number
  maxRepetitions?: number
}): Promise<void> {
  const { timeEntryId, employeeId, intervalMinutes, maxRepetitions = MAX_SCHEDULED_REMINDERS } = params
  const intervalMs = intervalMinutes * 60 * 1000

  try {
    if (isNativeApp()) {
      const LocalNotifications = await getCapacitorLocalNotifications()
      // Mehrere Notifications in die Zukunft planen
      const notifications = Array.from({ length: maxRepetitions }, (_, i) => ({
        id: STOP_REMINDER_BASE_ID + i + 1,
        title: '🔔 Noch eingestempelt',
        body: 'Du bist noch eingestempelt. Arbeit beenden?',
        schedule: { at: new Date(Date.now() + intervalMs * (i + 1)) },
        sound: 'default',
        extra: { timeEntryId, employeeId, type: 'forgot_stop' },
      }))
      await LocalNotifications.schedule({ notifications })
      return
    }

    // Web-Fallback: setInterval
    if (webIntervalId) clearInterval(webIntervalId)
    webIntervalId = setInterval(async () => {
      await showLocalNotification({
        type: 'forgot_stop',
        title: '🔔 Noch eingestempelt',
        message: 'Du bist noch eingestempelt. Arbeit beenden?',
        actions: [
          { action: 'stop_work', title: 'Arbeit beenden' },
          { action: 'start_pause', title: 'Pause starten' },
          { action: 'continue', title: 'Weiterarbeiten' },
        ],
        data: { timeEntryId, employeeId },
      })
    }, intervalMs)
  } catch (error) {
    console.warn('Wiederholte Erinnerung konnte nicht geplant werden:', error)
  }
}

// =========================================
// Alle Erinnerungen stornieren
// =========================================

/**
 * Storniert alle geplanten Erinnerungen.
 * - Nativ: LocalNotifications.cancel()
 * - Web: clearTimeout/clearInterval
 */
export async function cancelWorkReminder(): Promise<void> {
  try {
    if (isNativeApp()) {
      const LocalNotifications = await getCapacitorLocalNotifications()
      // Alle bekannten IDs stornieren
      const idsToCancel = [
        { id: WORK_REMINDER_ID },
        ...Array.from({ length: MAX_SCHEDULED_REMINDERS }, (_, i) => ({
          id: STOP_REMINDER_BASE_ID + i + 1,
        })),
      ]
      await LocalNotifications.cancel({ notifications: idsToCancel })
      return
    }

    // Web-Fallback
    webTimers.forEach(t => clearTimeout(t))
    webTimers = []
    if (webIntervalId) {
      clearInterval(webIntervalId)
      webIntervalId = null
    }
  } catch (error) {
    console.warn('Erinnerungen konnten nicht storniert werden:', error)
  }
}

// =========================================
// Sofortige Erinnerung
// =========================================

/**
 * Zeigt sofort eine lokale Notification an.
 * - Nativ: LocalNotifications.schedule() mit sofortigem Trigger
 * - Web: showLocalNotification()
 */
export async function showImmediateReminder(title: string, body: string): Promise<void> {
  try {
    if (isNativeApp()) {
      const LocalNotifications = await getCapacitorLocalNotifications()
      await LocalNotifications.schedule({
        notifications: [{
          id: Date.now() % 100000, // Eindeutige ID
          title,
          body,
          schedule: { at: new Date(Date.now() + 100) }, // Sofort (100ms Verzögerung)
          sound: 'default',
        }],
      })
      return
    }

    // Web-Fallback
    await showLocalNotification({
      type: 'system',
      title,
      message: body,
    })
  } catch (error) {
    console.warn('Sofortige Erinnerung fehlgeschlagen:', error)
  }
}

// =========================================
// Test-Notification
// =========================================

/**
 * Sendet eine Test-Notification für die Einstellungsseite.
 */
export async function testNotification(): Promise<void> {
  try {
    if (isNativeApp()) {
      const LocalNotifications = await getCapacitorLocalNotifications()
      await LocalNotifications.schedule({
        notifications: [{
          id: TEST_NOTIFICATION_ID,
          title: '🔔 BauZeit Pro',
          body: 'Test-Benachrichtigung erfolgreich! 🎉',
          schedule: { at: new Date(Date.now() + 100) },
          sound: 'default',
        }],
      })
      return
    }

    // Web-Fallback
    if (isNotificationGranted()) {
      await showLocalNotification({
        type: 'system',
        title: '🔔 BauZeit Pro',
        message: 'Test-Benachrichtigung erfolgreich! 🎉',
      })
    } else {
      await webRequestPermission()
    }
  } catch (error) {
    console.warn('Test-Notification fehlgeschlagen:', error)
  }
}

// =========================================
// Service-Objekt
// =========================================

export const mobileNotificationService = {
  requestPermission: requestNotificationPermission,
  scheduleWorkReminder,
  cancelWorkReminder,
  scheduleRepeatedStopReminder,
  showImmediateReminder,
  testNotification,
}

export default mobileNotificationService
