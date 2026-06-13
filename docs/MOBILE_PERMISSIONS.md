# BauZeit Pro – Mobile Permissions

## Übersicht

| Permission | Android Manifest | Runtime | Grund |
|---|---|---|---|
| `ACCESS_FINE_LOCATION` | ✅ | ✅ | GPS-Geofencing für Baustellenprüfung |
| `ACCESS_COARSE_LOCATION` | ✅ | ✅ | Fallback wenn Fine Location verweigert |
| `POST_NOTIFICATIONS` | ✅ | ✅ (Android 13+) | Überstunden-Erinnerungen |
| `SCHEDULE_EXACT_ALARM` | ✅ | ❌ | Geplante Erinnerungen |
| `VIBRATE` | ✅ | ❌ | Haptic Feedback |
| `INTERNET` | ✅ | ❌ | Supabase API-Zugriff |
| `CAMERA` | ❌ (Phase 4) | ✅ | Baustellenfotos (vorbereitet) |

## Runtime Permission Flow

### GPS (Geolocation)

```
App gestartet
  │
  ├── locationService.checkLocationPermission()
  │     ├── 'granted' → GPS sofort nutzbar
  │     ├── 'prompt' → Bei erster Nutzung wird Dialog gezeigt
  │     └── 'denied' → Warnung im UI, App funktioniert weiterhin
  │
  ├── Mitarbeiter startet Arbeit
  │     └── locationService.getCurrentPosition()
  │           ├── Erfolg → Geofence-Check
  │           └── Fehler → null → Arbeit startet trotzdem
  │
  └── WICHTIG: GPS blockiert die App NIEMALS
```

### Notifications

```
App gestartet
  │
  ├── NotificationPermissionCard zeigt Banner
  │     └── User klickt "Erinnerungen erlauben"
  │           └── mobileNotificationService.requestPermission()
  │                 ├── 'granted' → Erinnerungen werden geplant
  │                 └── 'denied' → Kein Banner mehr, App funktioniert
  │
  ├── Mitarbeiter > 8h eingestempelt
  │     └── mobileNotificationService.scheduleWorkReminder()
  │           ├── Nativ: LocalNotifications.schedule()
  │           └── Web: setTimeout + Notification API
  │
  └── WICHTIG: Ohne Permission funktioniert nur der Timer im UI
```

### Vibration (Haptics)

- **Keine Runtime Permission nötig**
- `hapticsService` prüft Verfügbarkeit automatisch
- Bei nicht-unterstützten Geräten: Silent fail

## Android Manifest Einträge

Die Capacitor Plugins setzen automatisch:

```xml
<!-- android/app/src/main/AndroidManifest.xml -->

<!-- Geolocation Plugin -->
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-feature android:name="android.hardware.location.gps" android:required="false" />

<!-- Local Notifications Plugin -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />

<!-- Push Notifications Plugin -->
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

<!-- Haptics Plugin -->
<uses-permission android:name="android.permission.VIBRATE" />
```

## iOS Info.plist Einträge (vorbereitet)

```xml
<!-- ios/App/App/Info.plist -->

<!-- GPS -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>BauZeit Pro benötigt deinen Standort, um zu prüfen ob du auf der Baustelle bist.</string>

<!-- Notifications -->
<!-- Wird automatisch beim ersten requestPermission() Dialog angezeigt -->

<!-- Kamera (Phase 4) -->
<key>NSCameraUsageDescription</key>
<string>BauZeit Pro benötigt die Kamera für Baustellenfotos.</string>
```

## Datenschutz-Hinweis

- GPS-Daten werden **nur** bei Start/Stop der Arbeit erfasst
- Kein Tracking im Hintergrund
- GPS-Position wird in `time_entries` gespeichert (Start + Ende)
- Mitarbeiter sehen nur eigene Daten (RLS)
- Admin sieht GPS-Warnungen, keine Echtzeit-Position
