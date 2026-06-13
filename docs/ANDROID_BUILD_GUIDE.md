# BauZeit Pro – Android Build Guide

## Voraussetzungen

| Tool | Version | Download |
|---|---|---|
| **Android Studio** | Ladybug+ (2024+) | [developer.android.com](https://developer.android.com/studio) |
| **JDK** | 17+ | Wird mit Android Studio mitgeliefert |
| **Android SDK** | API 34+ | Über Android Studio SDK Manager |
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org) |

## Schritt 1: Projekt bauen & synchronisieren

```bash
# Web-App bauen und in Android-Projekt kopieren
npm run cap:build

# Oder einzeln:
npm run build        # Vite Build → dist/
npx cap sync         # dist/ → android/app/src/main/assets/public/
```

## Schritt 2: Android Studio öffnen

```bash
# Android-Projekt in Android Studio öffnen
npm run cap:open:android
```

Oder manuell: Android Studio → Open → `ZEIT_Manager/android/`

## Schritt 3: App starten

### Emulator
1. Android Studio → Device Manager → Create Device
2. Pixel 7 o.ä. wählen → API 34 Image herunterladen
3. ▶ Run drücken

### Physisches Gerät
1. **USB-Debugging** auf dem Gerät aktivieren:
   - Einstellungen → Über das Telefon → 7x auf "Build-Nummer" tippen
   - Einstellungen → Entwickleroptionen → USB-Debugging aktivieren
2. Gerät per USB anschließen
3. Gerät in Android Studio auswählen → ▶ Run

## Schritt 4: Live-Reload (Entwicklung)

Für schnelle Iteration ohne Rebuild:

1. `capacitor.config.ts` öffnen
2. Server-Block einkommentieren:
```typescript
server: {
  url: 'http://DEINE_IP:5173',
  cleartext: true,
}
```
3. Eigene IP ermitteln: `ifconfig | grep inet`
4. `npm run dev` starten
5. `npx cap sync` (nur einmal nötig)
6. App in Android Studio starten

> ⚠️ **WICHTIG:** Vor Release den `server`-Block wieder auskommentieren!

## Schritt 5: Release Build (APK/AAB)

### Debug APK
```bash
cd android
./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

### Release AAB (für Play Store)
1. Android Studio → Build → Generate Signed Bundle/APK
2. "Android App Bundle" wählen
3. Neuen Keystore erstellen oder vorhandenen laden
4. Build-Variante: "release" wählen
5. Finish

### Keystore erstellen (CLI)
```bash
keytool -genkey -v \
  -keystore bauzeit-release.keystore \
  -alias bauzeit \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

> ⚠️ **KEYSTORE SICHER AUFBEWAHREN!** Niemals in Git einchecken. Bei Verlust können keine Updates mehr signiert werden.

## Berechtigungen (AndroidManifest.xml)

Die folgenden Berechtigungen werden automatisch von Capacitor Plugins gesetzt:

```xml
<!-- GPS / Geolocation -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

<!-- Benachrichtigungen -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />

<!-- Vibration -->
<uses-permission android:name="android.permission.VIBRATE" />

<!-- Internet (für Supabase) -->
<uses-permission android:name="android.permission.INTERNET" />
```

## Häufige Fehler

### `JAVA_HOME is not set`
```bash
export JAVA_HOME=$(/usr/libexec/java_home)
```

### Gradle Sync fehlgeschlagen
```bash
cd android && ./gradlew clean && cd ..
npx cap sync
```

### Weißer Bildschirm in der App
- Prüfe ob `npm run build` erfolgreich war
- Prüfe ob `npx cap sync` nach dem Build gelaufen ist
- Prüfe die Browser-Konsole in Chrome DevTools (chrome://inspect)

### API-Aufrufe schlagen fehl
- Supabase URL und anon key prüfen (`.env`)
- `cleartext` in `capacitor.config.ts` nur für lokale Entwicklung aktivieren
