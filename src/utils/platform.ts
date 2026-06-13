// Platform-Erkennung für BauZeit Pro
// Erkennt ob die App als PWA, native Android oder iOS läuft
// und welche Gerätefunktionen verfügbar sind.

import { Capacitor } from '@capacitor/core'

// =========================================
// App-Modus Erkennung
// =========================================

/**
 * Prüft ob die App als native Capacitor-App läuft (Android/iOS)
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

/**
 * Prüft ob die App als PWA (Progressive Web App) installiert ist
 */
export function isPWA(): boolean {
  if (isNativeApp()) return false
  // standalone = PWA installiert, browser = normal im Browser
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as Record<string, unknown>).standalone === true // iOS Safari
}

/**
 * Prüft ob die App im normalen Browser läuft (weder nativ noch PWA)
 */
export function isBrowser(): boolean {
  return !isNativeApp() && !isPWA()
}

/**
 * Prüft ob die App auf Android läuft
 */
export function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android'
}

/**
 * Prüft ob die App auf iOS läuft
 */
export function isIOS(): boolean {
  return Capacitor.getPlatform() === 'ios'
}

/**
 * Gibt die aktuelle Plattform als lesbaren String zurück
 */
export function getPlatformName(): string {
  if (isAndroid()) return 'Android App'
  if (isIOS()) return 'iOS App'
  if (isPWA()) return 'PWA'
  return 'Browser'
}

/**
 * Gibt die Capacitor-Plattform-ID zurück ('web' | 'android' | 'ios')
 */
export function getPlatformId(): 'web' | 'android' | 'ios' {
  return Capacitor.getPlatform() as 'web' | 'android' | 'ios'
}

// =========================================
// Feature-Support Erkennung
// =========================================

/**
 * Prüft ob Push Notifications unterstützt werden
 * - Nativ: immer unterstützt
 * - Web: nur wenn Notification API vorhanden
 */
export function supportsPush(): boolean {
  if (isNativeApp()) return true
  return 'Notification' in window
}

/**
 * Prüft ob Vibration unterstützt wird
 * - Nativ: über Capacitor Haptics
 * - Web: über navigator.vibrate
 */
export function supportsVibration(): boolean {
  if (isNativeApp()) return true
  return 'vibrate' in navigator
}

/**
 * Prüft ob Geolocation unterstützt wird
 * - Nativ: über Capacitor Geolocation
 * - Web: über navigator.geolocation
 */
export function supportsGeolocation(): boolean {
  if (isNativeApp()) return true
  return 'geolocation' in navigator
}

/**
 * Prüft ob die Kamera verfügbar ist (für spätere Nutzung)
 */
export function supportsCamera(): boolean {
  if (isNativeApp()) return true
  return 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices
}

// =========================================
// Plattform-Info Objekt
// =========================================

export interface PlatformInfo {
  name: string
  id: 'web' | 'android' | 'ios'
  isNative: boolean
  isPWA: boolean
  isBrowser: boolean
  supports: {
    push: boolean
    vibration: boolean
    geolocation: boolean
    camera: boolean
  }
}

/**
 * Gibt ein vollständiges Plattform-Info-Objekt zurück
 * Nützlich für Diagnose und UI-Anzeige
 */
export function getPlatformInfo(): PlatformInfo {
  return {
    name: getPlatformName(),
    id: getPlatformId(),
    isNative: isNativeApp(),
    isPWA: isPWA(),
    isBrowser: isBrowser(),
    supports: {
      push: supportsPush(),
      vibration: supportsVibration(),
      geolocation: supportsGeolocation(),
      camera: supportsCamera(),
    },
  }
}
