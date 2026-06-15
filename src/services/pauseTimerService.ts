// Pausen-Timer Service – Plant Vorwarnungen und Alarme für Pausen
// Nutzt mobileNotificationService intern (Capacitor nativ, Web fallback)
// Pausen-Alarme dürfen NIEMALS die App crashen.

import { isNativeApp } from '../utils/platform'
import {
  showLocalNotification,
} from './notificationService'

// =========================================
// Konstanten für Notification IDs
// =========================================

const PAUSE_WARNING_ID = 3001      // Vorwarnung "Noch X Minuten Pause"
const PAUSE_ALARM_ID = 3002        // Alarm "Pausenzeit abgelaufen!"
const PAUSE_REPEAT_BASE_ID = 3100  // Wiederholte Erinnerungen 3101, 3102, ...
const MAX_PAUSE_REPEATS = 6        // Max 30 Min bei 5-Min-Intervall

// =========================================
// Web-Timer-Referenzen
// =========================================

let pauseWarningTimer: ReturnType<typeof setTimeout> | null = null
let pauseAlarmTimer: ReturnType<typeof setTimeout> | null = null
let pauseRepeatTimers: ReturnType<typeof setTimeout>[] = []

// =========================================
// Capacitor Plugin dynamisch laden
// =========================================

async function getCapacitorLocalNotifications() {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  return LocalNotifications
}

// =========================================
// Vorwarnung planen (z.B. 5 Min vor Ende)
// =========================================

/**
 * Plant eine Vorwarnung vor Pause-Ende.
 * z.B. Bei maxPause=45min, warningBefore=5min → Alarm nach 40min
 */
export async function schedulePauseWarning(params: {
  pauseStartTime: string
  maxPauseMinutes: number
  warningBeforeMinutes: number
}): Promise<void> {
  const { pauseStartTime, maxPauseMinutes, warningBeforeMinutes } = params
  const warningDelayMs = (maxPauseMinutes - warningBeforeMinutes) * 60 * 1000
  const pauseStart = new Date(pauseStartTime).getTime()
  const triggerTime = new Date(pauseStart + warningDelayMs)
  const now = Date.now()
  const delayMs = triggerTime.getTime() - now

  // Bereits überschritten → überspringen
  if (delayMs <= 0) return

  try {
    if (isNativeApp()) {
      const LocalNotifications = await getCapacitorLocalNotifications()
      await LocalNotifications.schedule({
        notifications: [{
          id: PAUSE_WARNING_ID,
          title: '⏸️ Pause endet bald',
          body: `Noch ${warningBeforeMinutes} Minuten Pause übrig!`,
          schedule: { at: triggerTime },
          sound: 'default',
          channelId: 'pause_alerts',
          extra: { type: 'pause_warning' },
        }],
      })
      return
    }

    // Web-Fallback
    pauseWarningTimer = setTimeout(async () => {
      try {
        await showLocalNotification({
          type: 'pause_warning',
          title: '⏸️ Pause endet bald',
          message: `Noch ${warningBeforeMinutes} Minuten Pause übrig!`,
        })
      } catch { /* silent */ }
    }, delayMs)
  } catch (error) {
    console.warn('Pausen-Vorwarnung konnte nicht geplant werden:', error)
  }
}

// =========================================
// Alarm bei Pause-Ende
// =========================================

/**
 * Plant einen Alarm wenn die maximale Pausendauer erreicht ist.
 */
export async function schedulePauseAlarm(params: {
  pauseStartTime: string
  maxPauseMinutes: number
}): Promise<void> {
  const { pauseStartTime, maxPauseMinutes } = params
  const pauseStart = new Date(pauseStartTime).getTime()
  const alarmTime = new Date(pauseStart + maxPauseMinutes * 60 * 1000)
  const now = Date.now()
  const delayMs = alarmTime.getTime() - now

  // Bereits überschritten → sofort
  if (delayMs <= 0) {
    await showPauseExpiredNotification()
    return
  }

  try {
    if (isNativeApp()) {
      const LocalNotifications = await getCapacitorLocalNotifications()

      // Haupt-Alarm
      const notifications: any[] = [{
        id: PAUSE_ALARM_ID,
        title: '🚨 Pausenzeit abgelaufen!',
        body: `Deine ${maxPauseMinutes}-Minuten-Pause ist vorbei. Bitte zurück zur Arbeit!`,
        schedule: { at: alarmTime },
        sound: 'default',
        channelId: 'pause_alerts',
        extra: { type: 'pause_expired' },
      }]

      // Wiederholte Erinnerungen alle 5 Min nach Ablauf
      for (let i = 0; i < MAX_PAUSE_REPEATS; i++) {
        notifications.push({
          id: PAUSE_REPEAT_BASE_ID + i + 1,
          title: '⚠️ Pause überschritten!',
          body: `Du bist seit ${maxPauseMinutes + (i + 1) * 5} Minuten in Pause!`,
          schedule: { at: new Date(alarmTime.getTime() + (i + 1) * 5 * 60 * 1000) },
          sound: 'default',
          channelId: 'pause_alerts',
          extra: { type: 'pause_overdue' },
        })
      }

      await LocalNotifications.schedule({ notifications })
      return
    }

    // Web-Fallback: Haupt-Alarm
    pauseAlarmTimer = setTimeout(async () => {
      await showPauseExpiredNotification()

      // Wiederholte Web-Erinnerungen
      for (let i = 0; i < MAX_PAUSE_REPEATS; i++) {
        const repeatTimer = setTimeout(async () => {
          try {
            await showLocalNotification({
              type: 'pause_overdue',
              title: '⚠️ Pause überschritten!',
              message: `Du bist seit ${maxPauseMinutes + (i + 1) * 5} Minuten in Pause!`,
            })
          } catch { /* silent */ }
        }, (i + 1) * 5 * 60 * 1000)
        pauseRepeatTimers.push(repeatTimer)
      }
    }, delayMs)
  } catch (error) {
    console.warn('Pausen-Alarm konnte nicht geplant werden:', error)
  }
}

// =========================================
// Sofortige "Pause abgelaufen" Notification
// =========================================

async function showPauseExpiredNotification(): Promise<void> {
  try {
    if (isNativeApp()) {
      const LocalNotifications = await getCapacitorLocalNotifications()
      await LocalNotifications.schedule({
        notifications: [{
          id: PAUSE_ALARM_ID,
          title: '🚨 Pausenzeit abgelaufen!',
          body: 'Deine Pause ist vorbei. Bitte zurück zur Arbeit!',
          schedule: { at: new Date(Date.now() + 100) },
          sound: 'default',
          channelId: 'pause_alerts',
        }],
      })
      return
    }

    await showLocalNotification({
      type: 'pause_expired',
      title: '🚨 Pausenzeit abgelaufen!',
      message: 'Deine Pause ist vorbei. Bitte zurück zur Arbeit!',
    })
  } catch (error) {
    console.warn('Pausen-Expired Notification fehlgeschlagen:', error)
  }
}

// =========================================
// Alle Pausen-Alarme stornieren
// =========================================

/**
 * Storniert alle geplanten Pausen-Alarme und -Warnungen.
 */
export async function cancelPauseAlarms(): Promise<void> {
  try {
    if (isNativeApp()) {
      const LocalNotifications = await getCapacitorLocalNotifications()
      const idsToCancel = [
        { id: PAUSE_WARNING_ID },
        { id: PAUSE_ALARM_ID },
        ...Array.from({ length: MAX_PAUSE_REPEATS }, (_, i) => ({
          id: PAUSE_REPEAT_BASE_ID + i + 1,
        })),
      ]
      await LocalNotifications.cancel({ notifications: idsToCancel })
      return
    }

    // Web-Fallback
    if (pauseWarningTimer) { clearTimeout(pauseWarningTimer); pauseWarningTimer = null }
    if (pauseAlarmTimer) { clearTimeout(pauseAlarmTimer); pauseAlarmTimer = null }
    pauseRepeatTimers.forEach(t => clearTimeout(t))
    pauseRepeatTimers = []
  } catch (error) {
    console.warn('Pausen-Alarme konnten nicht storniert werden:', error)
  }
}

// =========================================
// Verbleibende Pausenzeit berechnen
// =========================================

/**
 * Berechnet die verbleibende Pausenzeit in Sekunden.
 * Negativ = Pause überschritten.
 */
export function getPauseRemainingSeconds(
  pauseStartTime: string,
  maxPauseMinutes: number
): number {
  const pauseStart = new Date(pauseStartTime).getTime()
  const maxMs = maxPauseMinutes * 60 * 1000
  const elapsed = Date.now() - pauseStart
  return Math.round((maxMs - elapsed) / 1000)
}

// =========================================
// Service-Objekt
// =========================================

export const pauseTimerService = {
  schedulePauseWarning,
  schedulePauseAlarm,
  cancelPauseAlarms,
  getPauseRemainingSeconds,
}

export default pauseTimerService
