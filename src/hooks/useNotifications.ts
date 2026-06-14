// useNotifications Hook: Notification-Zustand und Berechtigungen
// FIX: Nutzt mobileNotificationService statt Web-only Notification API
import { useState, useEffect, useCallback } from 'react'
import { isNativeApp } from '../utils/platform'
import {
  requestNotificationPermission as mobileRequestPermission,
  testNotification as mobileTestNotification,
} from '../services/mobileNotificationService'
import { vibrate } from '../services/notificationService'

export function useNotifications(userId?: string) {
  const [permission, setPermission] = useState<'granted' | 'denied' | 'default'>('default')
  const [loading, setLoading] = useState(false)

  // Berechtigungsstatus beim Mount prüfen
  useEffect(() => {
    async function checkPermission() {
      if (isNativeApp()) {
        // Capacitor: Local Notifications prüfen
        try {
          const { LocalNotifications } = await import('@capacitor/local-notifications')
          const status = await LocalNotifications.checkPermissions()
          if (status.display === 'granted') setPermission('granted')
          else if (status.display === 'denied') setPermission('denied')
          else setPermission('default')
        } catch {
          // Plugin nicht verfügbar → default lassen
          setPermission('default')
        }
      } else {
        // Web: Browser Notification API
        if ('Notification' in window) {
          setPermission(Notification.permission)
        } else {
          setPermission('denied')
        }
      }
    }

    checkPermission()
  }, [])

  // Berechtigung anfordern (nutzt mobileNotificationService für Native + Web)
  const requestPermission = useCallback(async () => {
    setLoading(true)
    try {
      const result = await mobileRequestPermission()
      // Mapping: mobileNotificationService gibt 'granted' | 'denied' | 'prompt' zurück
      if (result === 'granted') setPermission('granted')
      else if (result === 'denied') setPermission('denied')
      else setPermission('default')
    } catch {
      // Fehler → Status beibehalten
    } finally {
      setLoading(false)
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
