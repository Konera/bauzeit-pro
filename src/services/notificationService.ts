// Notification Service – Push, Vibration, lokale Erinnerungen
import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

export type NotificationType = 'overtime_warning' | 'forgot_stop' | 'left_site' | 'break_reminder' | 'system' | 'pause_warning' | 'pause_expired' | 'pause_overdue' | 'work_start_reminder' | 'geofence_enter' | 'geofence_exit' | 'motion_detected'

export interface NotificationPayload {
  type: NotificationType
  title: string
  message: string
  actions?: Array<{ action: string; title: string }>
  data?: Record<string, unknown>
}

// =========================================
// Berechtigungen
// =========================================

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  return await Notification.requestPermission()
}

export function isNotificationGranted(): boolean {
  return 'Notification' in window && Notification.permission === 'granted'
}

// =========================================
// Push Subscription
// =========================================

export async function subscribeToPush(userId: string): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  if (!VAPID_PUBLIC_KEY) return null

  try {
    const registration = await navigator.serviceWorker.ready
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })

    // Subscription in DB speichern
    await supabase.from('notifications').insert({
      employee_id: userId,
      type: 'push_subscription',
      title: 'Push Subscription',
      message: JSON.stringify(subscription),
      read: false,
    })

    return subscription
  } catch (error) {
    console.error('Push Subscription fehlgeschlagen:', error)
    return null
  }
}

// =========================================
// Lokale Notifications
// =========================================

export async function showLocalNotification(payload: NotificationPayload): Promise<void> {
  if (!isNotificationGranted()) return

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(payload.title, {
        body: payload.message,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: payload.type,
        requireInteraction: payload.type === 'forgot_stop',
        // vibrate ist ein Extended Option, wird von manchen Browsern unterstützt
        ...(payload.actions && { actions: payload.actions.map(a => ({ action: a.action, title: a.title })) }),
        data: payload.data,
      } as NotificationOptions)
      return
    } catch (err) {
      console.warn('SW Notification Fallback:', err)
    }
  }

  new Notification(payload.title, {
    body: payload.message,
    icon: '/icon-192.png',
  })
}

// =========================================
// Vibration
// =========================================

export function vibrate(pattern: number | number[] = [300, 200, 300]): void {
  if (navigator.vibrate) navigator.vibrate(pattern)
}

export function vibrateOvertimeWarning(): void {
  vibrate([400, 200, 400, 200, 400])
}

// =========================================
// Erinnerungstimer
// =========================================

let reminderInterval: ReturnType<typeof setInterval> | null = null
let overtimeCheckInterval: ReturnType<typeof setInterval> | null = null

export function startReminderTimer(
  employeeId: string,
  timeEntryId: string,
  startTime: string,
  maxHours = 8,
  reminderIntervalMinutes = 15
): void {
  stopReminderTimer()

  // Überstunden-Check alle 5 Minuten
  overtimeCheckInterval = setInterval(async () => {
    const workedMinutes = Math.floor((Date.now() - new Date(startTime).getTime()) / 60000)
    if (workedMinutes >= maxHours * 60) {
      await showLocalNotification({
        type: 'overtime_warning',
        title: '⚠️ Arbeitszeit überschritten!',
        message: `Du arbeitest seit ${Math.floor(workedMinutes / 60)}h ${workedMinutes % 60}min. Vergiss nicht auszustempeln!`,
        actions: [
          { action: 'stop_work', title: 'Arbeit beenden' },
          { action: 'continue', title: 'Weiterarbeiten' },
        ],
        data: { timeEntryId, employeeId },
      })
      vibrateOvertimeWarning()

      await supabase.from('notifications').insert({
        employee_id: employeeId,
        type: 'overtime_warning',
        title: 'Überstunden-Warnung',
        message: `Seit ${Math.floor(workedMinutes / 60)}h ${workedMinutes % 60}min aktiv`,
        read: false,
      })
    }
  }, 5 * 60 * 1000)

  // Periodische Erinnerung alle X Minuten nach Überschreitung
  reminderInterval = setInterval(async () => {
    const workedMinutes = Math.floor((Date.now() - new Date(startTime).getTime()) / 60000)
    if (workedMinutes > maxHours * 60) {
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
      vibrate([300, 200, 300])
    }
  }, reminderIntervalMinutes * 60 * 1000)
}

export function stopReminderTimer(): void {
  if (reminderInterval)      { clearInterval(reminderInterval);      reminderInterval = null }
  if (overtimeCheckInterval) { clearInterval(overtimeCheckInterval); overtimeCheckInterval = null }
}

export async function showLeftSiteWarning(employeeId: string, timeEntryId: string): Promise<void> {
  await showLocalNotification({
    type: 'left_site',
    title: '📍 Baustelle verlassen',
    message: 'Du hast die Baustelle verlassen. Ausstempeln?',
    actions: [
      { action: 'stop_work', title: 'Ausstempeln' },
      { action: 'ignore',    title: 'Ignorieren' },
    ],
    data: { timeEntryId, employeeId },
  })
  vibrate([100, 100, 100])
}

// =========================================
// Hilfsfunktionen
// =========================================

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i)
  return output
}

export const notificationService = {
  requestPermission: requestNotificationPermission,
  isGranted: isNotificationGranted,
  show: showLocalNotification,
  vibrate,
  startReminder: startReminderTimer,
  stopReminder: stopReminderTimer,
  showLeftSiteWarning,
  subscribeToPush,
}
