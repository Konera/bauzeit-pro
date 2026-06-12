// useNotifications Hook: Notification-Zustand und Berechtigungen
import { useState, useEffect, useCallback } from 'react'
import {
  requestNotificationPermission,
  isNotificationGranted,
  subscribeToPush,
  vibrate,
} from '../services/notificationService'

export function useNotifications(userId?: string) {
  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  )
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  // Berechtigungsstatus prüfen
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  // Berechtigung anfordern
  const requestPermission = useCallback(async () => {
    setLoading(true)
    try {
      const result = await requestNotificationPermission()
      setPermission(result)

      if (result === 'granted' && userId) {
        const subscription = await subscribeToPush(userId)
        setIsSubscribed(!!subscription)
      }
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Vibration testen
  const testVibration = useCallback(() => {
    vibrate([200, 100, 200, 100, 400])
  }, [])

  // Benachrichtigung testen
  const testNotification = useCallback(async () => {
    if (!isNotificationGranted()) {
      await requestPermission()
      return
    }

    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification('BauZeit Pro Test', {
        body: 'Notifications funktionieren korrekt! 🎉',
        icon: '/icon-192.png',
      } as NotificationOptions)
    }
  }, [requestPermission])

  return {
    permission,
    isGranted: permission === 'granted',
    isDenied: permission === 'denied',
    isPending: permission === 'default',
    isSubscribed,
    loading,
    requestPermission,
    testVibration,
    testNotification,
    supportsNotifications: 'Notification' in window,
    supportsVibration: 'vibrate' in navigator,
    supportsPush: 'PushManager' in window,
  }
}
