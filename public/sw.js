// Service Worker für BauZeit Pro PWA
// Unterstützt: Push Notifications, Offline-Caching, Background Sync

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'

// Precache-Manifest (wird von Vite PWA injiziert)
precacheAndRoute(self.__WB_MANIFEST || [])
cleanupOutdatedCaches()

// =========================================
// Push Notification Handler
// =========================================

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = {
      title: 'BauZeit Pro',
      body: event.data.text(),
      icon: '/icon-192.png',
    }
  }

  const options = {
    body: payload.message || payload.body,
    icon: payload.icon || '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: payload.type || 'bauzeit-notification',
    requireInteraction: payload.requireInteraction || false,
    data: payload.data || {},
    actions: payload.actions || [
      { action: 'stop_work', title: '✅ Arbeit beenden' },
      { action: 'continue', title: '▶️ Weiterarbeiten' },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'BauZeit Pro', options)
  )
})

// =========================================
// Notification Click Handler
// =========================================

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const action = event.action
  const data = event.notification.data

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Bestehenden Tab fokussieren
      const existingClient = clients.find(c => c.url.includes(self.location.origin))

      if (existingClient) {
        existingClient.focus()
        // Aktion an App senden
        existingClient.postMessage({
          type: 'NOTIFICATION_ACTION',
          action,
          data,
        })
      } else {
        // Neuen Tab öffnen
        self.clients.openWindow('/')
      }
    })
  )
})

// =========================================
// Background Sync (für Offline-Daten)
// =========================================

self.addEventListener('sync', (event) => {
  if (event.tag === 'bauzeit-sync') {
    event.waitUntil(syncOfflineData())
  }
})

async function syncOfflineData() {
  // Die eigentliche Sync-Logik ist im offlineSyncService.ts
  // Hier nur ein Signal an alle Tabs senden
  const clients = await self.clients.matchAll({ type: 'window' })
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_REQUESTED' })
  })
}

// =========================================
// Install und Activate Events
// =========================================

self.addEventListener('install', (event) => {
  console.log('BauZeit Pro Service Worker installiert')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('BauZeit Pro Service Worker aktiviert')
  event.waitUntil(self.clients.claim())
})

// =========================================
// Fetch Handler für Offline-Support
// =========================================

self.addEventListener('fetch', (event) => {
  // Supabase API: Network-First mit 5s Timeout
  if (event.request.url.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Offline: Leere Antwort für API-Calls
          return new Response(JSON.stringify({ data: null, error: { message: 'Offline' } }), {
            headers: { 'Content-Type': 'application/json' },
          })
        })
    )
    return
  }

  // Statische Assets: Cache-First
  if (event.request.destination === 'image' ||
      event.request.destination === 'font' ||
      event.request.destination === 'style' ||
      event.request.destination === 'script') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          const responseClone = response.clone()
          caches.open('bauzeit-assets').then(cache => {
            cache.put(event.request, responseClone)
          })
          return response
        })
      })
    )
    return
  }

  // Alle anderen Requests: Network-First
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request) || caches.match('/')
    })
  )
})
