// useNotifications Hook: Notification-Zustand und Berechtigungen
// Nutzt mobileNotificationService + Timeout-Schutz gegen Hänger
import { useState, useEffect, useCallback, useRef } from 'react'
import { isNativeApp } from '../utils/platform'
import {
  requestNotificationPermission as mobileRequestPermission,
  testNotification as mobileTestNotification,
} from '../services/mobileNotificationService'
import { vibrate } from '../services/notificationService'

// Timeout-Wrapper: Verhindert dass ein Promise ewig hängt
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ])
}

export function useNotifications(userId?: string) {
  const [permission, setPermission] = useState<'granted' | 'denied' | 'default'>('default')
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Berechtigungsstatus beim Mount prüfen
  useEffect(() => {
    async function checkPermission() {
      if (isNativeApp()) {
        try {
          const { LocalNotifications } = await import('@capacitor/local-notifications')
          // 3-Sekunden-Timeout: Wenn checkPermissions hängt → als granted annehmen
          // (Android erteilt oft automatisch Berechtigungen)
          const status = await withTimeout(
            LocalNotifications.checkPermissions(),
            3000,
            { display: 'granted' as const }
          )
          if (!mountedRef.current) return
          if (status.display === 'granted') setPermission('granted')
          else if (status.display === 'denied') setPermission('denied')
          else setPermission('default')
        } catch {
          // Plugin-Fehler → als granted annehmen (viele Android-Geräte brauchen keine Erlaubnis)
          if (mountedRef.current) setPermission('granted')
        }
      } else {
        if ('Notification' in window) {
          setPermission(Notification.permission)
        } else {
          setPermission('denied')
        }
      }
    }
    checkPermission()
  }, [])

  // Berechtigung anfordern mit 5s Timeout
  const requestPermission = useCallback(async () => {
    setLoading(true)
    try {
      // 5-Sekunden-Timeout: Wenn requestPermission hängt → als granted setzen
      const result = await withTimeout(mobileRequestPermission(), 5000, 'granted' as const)
      if (!mountedRef.current) return
      if (result === 'granted') setPermission('granted')
      else if (result === 'denied') setPermission('denied')
      else setPermission('default')
    } catch {
      // Bei Fehler → als granted setzen (Benachrichtigungen funktionieren trotzdem meist)
      if (mountedRef.current) setPermission('granted')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  // Vibration testen
  const testVibration = useCallback(() => {
    vibrate([200, 100, 200, 100, 400])
  }, [])

  // Test-Notification senden
  const testNotification = useCallback(async () => {
    if (permission !== 'granted') {
      await requestPermission()
      return
    }
    try {
      await mobileTestNotification()
    } catch {
      // Non-blocking
    }
  }, [permission, requestPermission])

  // Plattform-Checks
  const supportsNotifications = isNativeApp() || ('Notification' in window)
  const supportsVibration = isNativeApp() || ('vibrate' in navigator)

  return {
    permission,
    isGranted: permission === 'granted',
    isDenied: permission === 'denied',
    isPending: permission === 'default',
    loading,
    requestPermission,
    testVibration,
    testNotification,
    supportsNotifications,
    supportsVibration,
    supportsPush: isNativeApp() || ('PushManager' in window),
  }
}
