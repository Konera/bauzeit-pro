// Location Service – Vereinheitlichte GPS-Schicht
// Strategie: Capacitor-Plugin versuchen → bei JEDEM Fehler automatisch auf
// Browser navigator.geolocation zurückfallen. Funktioniert auf ALLEN Android-Geräten.
// GPS blockiert NIEMALS die App – alle Fehler werden graceful behandelt.

import { isNativeApp } from '../utils/platform'
import type { GeoPosition, ConstructionSite } from '../types/database'
import { calculateDistance, checkGeofence } from './gpsService'
import type { GeofenceResult } from './gpsService'

// =========================================
// Capacitor Plugin dynamisch laden
// =========================================

async function getCapacitorGeolocation() {
  const { Geolocation } = await import('@capacitor/geolocation')
  return Geolocation
}

// =========================================
// Browser-API (funktioniert überall — Web UND Android WebView)
// =========================================

/**
 * GPS über die Standard-Browser-API holen.
 * Funktioniert im Browser UND im Android WebView (Capacitor).
 * Das ist die gleiche API die in der Web-App einwandfrei funktioniert.
 */
function _getBrowserPosition(timeout = 10000): Promise<GeoPosition | null> {
  if (!navigator.geolocation) return Promise.resolve(null)

  return new Promise<GeoPosition | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      (err) => {
        console.warn('Browser-GPS Fehler:', err.message)
        resolve(null)
      },
      { enableHighAccuracy: true, timeout, maximumAge: 60000 },
    )
  })
}

// =========================================
// Capacitor-Plugin GPS (nativ, bevorzugt)
// =========================================

/**
 * GPS über das Capacitor-Plugin holen.
 * Fordert bei Bedarf Berechtigungen an.
 * Gibt null zurück bei JEDEM Fehler.
 */
async function _getCapacitorPosition(): Promise<GeoPosition | null> {
  try {
    const Geolocation = await getCapacitorGeolocation()

    // Berechtigung prüfen und ggf. anfordern
    try {
      const permStatus = await Geolocation.checkPermissions()
      console.log('GPS Permission:', permStatus.location)

      if (permStatus.location !== 'granted') {
        // Berechtigung anfordern (zeigt System-Dialog auf Android)
        const reqResult = await Geolocation.requestPermissions()
        console.log('GPS Permission nach Anfrage:', reqResult.location)
        // Nicht abbrechen bei 'denied' — Browser-Fallback wird es versuchen
      }
    } catch (permErr) {
      console.warn('GPS Permission-Check fehlgeschlagen:', permErr)
      // Trotzdem versuchen — Position könnte trotzdem funktionieren
    }

    // Position holen (enableHighAccuracy zuerst, dann Fallback)
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 5000,
      })
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }
    } catch {
      // High-Accuracy fehlgeschlagen → Low-Accuracy versuchen
      try {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 5000,
        })
        return {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }
      } catch {
        return null
      }
    }
  } catch (err) {
    console.warn('Capacitor GPS komplett fehlgeschlagen:', err)
    return null
  }
}

// =========================================
// Hauptfunktion: getCurrentPosition
// =========================================

/**
 * Ermittelt die aktuelle GPS-Position.
 * 
 * Strategie (für ALLE Android-Geräte):
 * 1. Capacitor-Plugin versuchen (beste Genauigkeit)
 * 2. Bei JEDEM Fehler → Browser navigator.geolocation (funktioniert immer)
 * 3. 8s Hard-Timeout — GPS darf die App NIE blockieren
 * 
 * Gibt null zurück wenn GPS komplett nicht verfügbar.
 */
export async function getCurrentPosition(): Promise<GeoPosition | null> {
  try {
    // 8s Hard-Timeout: GPS darf MAXIMAL 8 Sekunden blockieren
    const result = await Promise.race([
      _getPositionWithFallback(),
      new Promise<null>((resolve) => setTimeout(() => {
        console.warn('GPS: 8s Hard-Timeout erreicht')
        resolve(null)
      }, 8000)),
    ])
    return result
  } catch (error) {
    console.warn('GPS komplett fehlgeschlagen:', error)
    return null
  }
}

/**
 * Versucht zuerst Capacitor-Plugin, dann Browser-API als Fallback.
 * Funktioniert auf Samsung, Pixel, Xiaomi, Huawei, OnePlus — ALLE Android-Geräte.
 */
async function _getPositionWithFallback(): Promise<GeoPosition | null> {
  if (isNativeApp()) {
    // Schritt 1: Capacitor-Plugin versuchen (beste Qualität)
    console.log('GPS: Versuche Capacitor-Plugin...')
    const capPosition = await _getCapacitorPosition()
    if (capPosition) {
      console.log('GPS: Capacitor erfolgreich ✅', capPosition.accuracy, 'm Genauigkeit')
      return capPosition
    }

    // Schritt 2: Browser-API als Fallback (funktioniert im Android WebView)
    console.log('GPS: Capacitor fehlgeschlagen, versuche Browser-API...')
    const browserPosition = await _getBrowserPosition(5000)
    if (browserPosition) {
      console.log('GPS: Browser-API erfolgreich ✅', browserPosition.accuracy, 'm Genauigkeit')
      return browserPosition
    }

    console.warn('GPS: Beide Methoden fehlgeschlagen')
    return null
  }

  // Web: Direkt Browser-API nutzen
  return _getBrowserPosition(10000)
}

// =========================================
// Berechtigungsstatus prüfen
// =========================================

/**
 * Prüft den aktuellen GPS-Berechtigungsstatus.
 * Nutzt Capacitor nativ, Browser-API als Fallback.
 */
export async function checkLocationPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unavailable'> {
  try {
    if (isNativeApp()) {
      // Schritt 1: Capacitor-Plugin versuchen
      try {
        const Geolocation = await getCapacitorGeolocation()
        const status = await Promise.race([
          Geolocation.checkPermissions(),
          new Promise<{ location: string }>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 3000)
          ),
        ])
        if (status.location === 'granted') return 'granted'
        if (status.location === 'denied') return 'denied'
        return 'prompt'
      } catch {
        // Capacitor fehlgeschlagen → Browser-Fallback
      }
    }

    // Browser-API: Funktioniert auf Web UND als Fallback auf Android
    if (!navigator.geolocation) return 'unavailable'

    if (navigator.permissions) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' })
        return result.state as 'granted' | 'denied' | 'prompt'
      } catch {
        // Permissions API nicht verfügbar
      }
    }

    return 'prompt'
  } catch {
    return 'prompt'
  }
}

// =========================================
// Berechtigung anfragen
// =========================================

/**
 * Fordert GPS-Berechtigung aktiv an.
 * Versucht Capacitor nativ, dann Browser-Fallback.
 */
export async function requestLocationPermission(): Promise<'granted' | 'denied'> {
  try {
    if (isNativeApp()) {
      // Schritt 1: Capacitor Permission anfordern
      try {
        const Geolocation = await getCapacitorGeolocation()
        const status = await Promise.race([
          Geolocation.requestPermissions(),
          new Promise<{ location: string }>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 5000)
          ),
        ])
        if (status.location === 'granted') return 'granted'
      } catch {
        // Capacitor fehlgeschlagen
      }

      // Schritt 2: Browser-API Fallback (zeigt auch den GPS-Dialog)
      const pos = await _getBrowserPosition(5000)
      return pos ? 'granted' : 'denied'
    }

    // Web: Browser-Dialog triggern
    const pos = await _getBrowserPosition(10000)
    return pos ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}

// =========================================
// Distanz- und Geofence-Berechnung
// =========================================

/**
 * Berechnet die Entfernung zwischen Position und Baustelle in Metern
 */
export function calculateDistanceFromSite(position: GeoPosition, site: ConstructionSite): number | null {
  if (site.gps_lat === null || site.gps_lng === null) return null
  return calculateDistance(position.lat, position.lng, site.gps_lat, site.gps_lng)
}

/**
 * Prüft ob eine Position innerhalb des Geofence der Baustelle liegt
 */
export function isInsideConstructionSite(position: GeoPosition, site: ConstructionSite): GeofenceResult {
  return checkGeofence(position, site)
}

// =========================================
// GPS-Diagnose (für Debugging auf Geräten)
// =========================================

export interface GpsDiagnostics {
  platform: string
  isNative: boolean
  pluginLoaded: boolean
  pluginPermission: string
  browserApiAvailable: boolean
  capacitorPosition: GeoPosition | null
  capacitorError: string | null
  browserPosition: GeoPosition | null
  browserError: string | null
  finalResult: 'success' | 'failed'
}

/**
 * Führt eine vollständige GPS-Diagnose durch.
 * Testet Capacitor-Plugin UND Browser-API separat.
 */
export async function runGpsDiagnostics(): Promise<GpsDiagnostics> {
  const result: GpsDiagnostics = {
    platform: isNativeApp() ? 'native' : 'web',
    isNative: isNativeApp(),
    pluginLoaded: false,
    pluginPermission: 'unknown',
    browserApiAvailable: 'geolocation' in navigator,
    capacitorPosition: null,
    capacitorError: null,
    browserPosition: null,
    browserError: null,
    finalResult: 'failed',
  }

  // Test 1: Capacitor Plugin
  if (isNativeApp()) {
    try {
      const Geolocation = await getCapacitorGeolocation()
      result.pluginLoaded = true

      try {
        const perm = await Geolocation.checkPermissions()
        result.pluginPermission = perm.location
      } catch (e) {
        result.pluginPermission = 'check-error: ' + String(e)
      }

      try {
        const pos = await Promise.race([
          Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 5000 }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('5s timeout')), 5500)),
        ])
        result.capacitorPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }
      } catch (e) {
        result.capacitorError = String(e)
      }
    } catch (e) {
      result.capacitorError = 'Plugin load failed: ' + String(e)
    }
  }

  // Test 2: Browser API
  try {
    const browserPos = await _getBrowserPosition(5000)
    result.browserPosition = browserPos
    if (!browserPos) result.browserError = 'Returned null (denied or timeout)'
  } catch (e) {
    result.browserError = String(e)
  }

  // Final
  if (result.capacitorPosition || result.browserPosition) {
    result.finalResult = 'success'
  }

  return result
}

/**
 * Öffnet die Android Standort-Einstellungen.
 * Auf Web/iOS wird nichts gemacht.
 */
export async function openLocationSettings(): Promise<void> {
  if (isNativeApp()) {
    try {
      // Android: App-Einstellungen öffnen über Custom URL
      window.open('intent://settings/location#Intent;scheme=android-app;end', '_system')
    } catch {
      console.warn('Standort-Einstellungen konnten nicht geöffnet werden')
    }
  }
}

// =========================================
// Service-Objekt
// =========================================

export const locationService = {
  getCurrentPosition,
  checkLocationPermission,
  requestLocationPermission,
  calculateDistanceFromSite,
  isInsideConstructionSite,
  runGpsDiagnostics,
  openLocationSettings,
}

export default locationService

