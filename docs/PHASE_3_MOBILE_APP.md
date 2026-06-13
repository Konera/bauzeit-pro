# BauZeit Pro – Phase 3: Mobile App Architektur

## Überblick

BauZeit Pro läuft in drei Modi:

| Modus | Technologie | Erkennung |
|---|---|---|
| **Browser** | Vite + React im Browser-Tab | `isBrowser()` |
| **PWA** | Installierte Web-App (standalone) | `isPWA()` |
| **Native App** | Capacitor 8 (Android/iOS) | `isNativeApp()` |

## Service-Schichten

```
┌──────────────────────────────────────────────────┐
│                   UI Layer                        │
│  EmployeeDashboard · AdminDashboard · Settings    │
├──────────────────────────────────────────────────┤
│                  Hook Layer                       │
│          useTimeTracking · useAuth                │
├──────────────────────────────────────────────────┤
│              Abstraktions-Layer (Phase 3)         │
│  locationService · mobileNotificationService     │
│              hapticsService · platform.ts         │
├──────────────┬──────────────┬────────────────────┤
│  Native API  │              │    Web API          │
│  (Capacitor) │  isNative?   │   (Browser)         │
├──────────────┤              ├────────────────────┤
│ Geolocation  │     ✓ → L    │ navigator.         │
│ Plugin       │     ✗ → R    │ geolocation         │
├──────────────┤              ├────────────────────┤
│ LocalNotif.  │     ✓ → L    │ Notification        │
│ Plugin       │     ✗ → R    │ API                 │
├──────────────┤              ├────────────────────┤
│ Haptics      │     ✓ → L    │ navigator.          │
│ Plugin       │     ✗ → R    │ vibrate()           │
└──────────────┴──────────────┴────────────────────┘
```

## Entscheidungsmatrix: Native vs. Web API

| Feature | Native (Capacitor) | Web (Browser) | Fallback |
|---|---|---|---|
| GPS | `@capacitor/geolocation` | `navigator.geolocation` | `null` → nicht blockierend |
| Notifications | `@capacitor/local-notifications` | `Notification API` | Warnung → kein Crash |
| Vibration | `@capacitor/haptics` | `navigator.vibrate()` | Silent fail |
| Push (Server) | `@capacitor/push-notifications` | Web Push API | Lokale Notifications |
| Kamera | `@capacitor/camera` (Phase 4) | `getUserMedia` | Nicht implementiert |

## Dateistruktur

```
src/
├── utils/
│   └── platform.ts              ← App-Modus-Erkennung
├── services/
│   ├── locationService.ts       ← GPS-Abstraktionsschicht
│   ├── mobileNotificationService.ts ← Notification-Abstraktionsschicht
│   ├── hapticsService.ts        ← Vibrations-Abstraktionsschicht
│   ├── gpsService.ts            ← Haversine/Geofence (intern)
│   ├── notificationService.ts   ← Web Notification (intern)
│   ├── timeTrackingService.ts   ← Kern-Zeiterfassung
│   └── offlineSyncService.ts    ← IndexedDB Offline-Sync
```

## Sicherheit

- **Keine Keys im Android-Code**: Supabase Keys werden via `import.meta.env` geladen
- **RLS bleibt Pflicht**: Alle Datenzugriffe über Supabase Row-Level Security
- **Admin-Rechte serverseitig**: `is_admin()` Funktion in PostgreSQL
- **VAPID Keys als Secrets**: In Supabase Edge Function Secrets, nie im Client
