// Arbeitsbeginn-Erinnerung Service
// Plant tägliche Erinnerungen an Werktagen (Mo-Sa konfigurierbar)
// Nutzt Capacitor LocalNotifications nativ, Web fallback

import { isNativeApp } from '../utils/platform'
import {
  showLocalNotification,
} from './notificationService'

// =========================================
// Konstanten für Notification IDs
// =========================================

const WORK_START_REMINDER_ID = 4001       // Erste Erinnerung
const WORK_START_FOLLOWUP_ID = 4002       // Folgeerinnerung (+15 Min)
const WORK_START_URGENT_ID = 4003         // Dringende Erinnerung (+30 Min)

// =========================================
// Web-Timer-Referenzen
// =========================================

let workStartTimers: ReturnType<typeof setTimeout>[] = []
let dailyCheckInterval: ReturnType<typeof setInterval> | null = null

// =========================================
// Capacitor Plugin dynamisch laden
// =========================================

async function getCapacitorLocalNotifications() {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  return LocalNotifications
}

// =========================================
// Arbeitstag prüfen
// =========================================

/**
 * Prüft ob ein Datum ein Arbeitstag ist.
 * workDays: Array mit ISO-Wochentagen [1=Mo, 2=Di, ..., 6=Sa, 7=So]
 */
export function isWorkDay(date: Date, workDays: number[]): boolean {
  // JS: 0=So, 1=Mo, ..., 6=Sa → ISO: 1=Mo, ..., 7=So
  const jsDay = date.getDay()
  const isoDay = jsDay === 0 ? 7 : jsDay
  return workDays.includes(isoDay)
}

// =========================================
// Nächste Erinnerungszeit berechnen
// =========================================

/**
 * Berechnet die nächste Trigger-Zeit für die Arbeitsbeginn-Erinnerung.
 * Wenn heute ein Arbeitstag ist UND die Uhrzeit noch nicht vorbei → heute.
 * Sonst → nächster Arbeitstag.
 */
export function getNextReminderTime(
  workStartTime: string, // "HH:MM" Format
  workDays: number[]
): Date | null {
  if (workDays.length === 0) return null

  const [hours, minutes] = workStartTime.split(':').map(Number)
  const now = new Date()

  // Heute prüfen
  const todayTrigger = new Date()
  todayTrigger.setHours(hours, minutes, 0, 0)

  if (isWorkDay(now, workDays) && todayTrigger.getTime() > now.getTime()) {
    return todayTrigger
  }

  // Nächsten Arbeitstag finden (max 7 Tage voraus)
  for (let i = 1; i <= 7; i++) {
    const nextDay = new Date(now)
    nextDay.setDate(nextDay.getDate() + i)
    nextDay.setHours(hours, minutes, 0, 0)
    if (isWorkDay(nextDay, workDays)) {
      return nextDay
    }
  }

  return null
}

// =========================================
// Erinnerungen planen
// =========================================

/**
 * Plant Arbeitsbeginn-Erinnerungen.
 * Wird beim App-Start und nach Settings-Änderungen aufgerufen.
 */
export async function scheduleWorkStartReminders(params: {
  workStartTime: string  // "HH:MM"
  workDays: number[]     // [1,2,3,4,5,6] = Mo-Sa
  enabled: boolean
}): Promise<void> {
  const { workStartTime, workDays, enabled } = params

  // Zuerst alle alten stornieren
  await cancelWorkStartReminders()

  if (!enabled || workDays.length === 0) return

  const nextTrigger = getNextReminderTime(workStartTime, workDays)
  if (!nextTrigger) return

  const [hours, minutes] = workStartTime.split(':').map(Number)
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

  try {
    if (isNativeApp()) {
      const LocalNotifications = await getCapacitorLocalNotifications()

      // 3 gestufte Erinnerungen
      const notifications = [
        {
          id: WORK_START_REMINDER_ID,
          title: '🔔 Arbeitsbeginn!',
          body: `Es ist ${timeStr} Uhr. Vergiss nicht dich einzustempeln!`,
          schedule: { at: nextTrigger },
          sound: 'default',
          extra: { type: 'work_start_reminder' },
        },
        {
          id: WORK_START_FOLLOWUP_ID,
          title: '⚠️ Noch nicht eingestempelt!',
          body: `Du bist seit 15 Minuten nicht eingestempelt. Bitte jetzt einstempeln.`,
          schedule: { at: new Date(nextTrigger.getTime() + 15 * 60 * 1000) },
          sound: 'default',
          extra: { type: 'work_start_followup' },
        },
        {
          id: WORK_START_URGENT_ID,
          title: '🚨 Letzte Erinnerung!',
          body: `Du hast dich 30 Minuten nach Arbeitsbeginn immer noch nicht eingestempelt!`,
          schedule: { at: new Date(nextTrigger.getTime() + 30 * 60 * 1000) },
          sound: 'default',
          extra: { type: 'work_start_urgent' },
        },
      ]

      await LocalNotifications.schedule({ notifications })
      console.log('📅 Arbeitsbeginn-Erinnerungen geplant für:', nextTrigger.toLocaleString())
      return
    }

    // Web-Fallback: setTimeout für heute
    const now = Date.now()
    const delays = [
      nextTrigger.getTime() - now,           // Pünktlich
      nextTrigger.getTime() + 15 * 60 * 1000 - now, // +15 Min
      nextTrigger.getTime() + 30 * 60 * 1000 - now, // +30 Min
    ]

    const messages = [
      { title: '🔔 Arbeitsbeginn!', body: `Es ist ${timeStr} Uhr. Vergiss nicht dich einzustempeln!` },
      { title: '⚠️ Noch nicht eingestempelt!', body: 'Du bist seit 15 Minuten nicht eingestempelt.' },
      { title: '🚨 Letzte Erinnerung!', body: 'Du hast dich 30 Minuten nach Arbeitsbeginn noch nicht eingestempelt!' },
    ]

    delays.forEach((delayMs, i) => {
      if (delayMs > 0) {
        const timerId = setTimeout(async () => {
          try {
            await showLocalNotification({
              type: 'work_start_reminder',
              title: messages[i].title,
              message: messages[i].body,
            })
          } catch { /* silent */ }
        }, delayMs)
        workStartTimers.push(timerId)
      }
    })

    console.log('📅 Web: Arbeitsbeginn-Erinnerungen geplant für:', nextTrigger.toLocaleString())
  } catch (error) {
    console.warn('Arbeitsbeginn-Erinnerungen konnten nicht geplant werden:', error)
  }
}

// =========================================
// Alle Erinnerungen stornieren
// =========================================

export async function cancelWorkStartReminders(): Promise<void> {
  try {
    if (isNativeApp()) {
      const LocalNotifications = await getCapacitorLocalNotifications()
      await LocalNotifications.cancel({
        notifications: [
          { id: WORK_START_REMINDER_ID },
          { id: WORK_START_FOLLOWUP_ID },
          { id: WORK_START_URGENT_ID },
        ],
      })
      return
    }

    // Web-Fallback
    workStartTimers.forEach(t => clearTimeout(t))
    workStartTimers = []
    if (dailyCheckInterval) {
      clearInterval(dailyCheckInterval)
      dailyCheckInterval = null
    }
  } catch (error) {
    console.warn('Arbeitsbeginn-Erinnerungen konnten nicht storniert werden:', error)
  }
}

// =========================================
// Service-Objekt
// =========================================

export const workStartReminderService = {
  scheduleWorkStartReminders,
  cancelWorkStartReminders,
  isWorkDay,
  getNextReminderTime,
}

export default workStartReminderService
