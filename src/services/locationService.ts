// Location Service – Vereinheitlichte GPS-Schicht
// Nutzt Capacitor Geolocation nativ, Browser Geolocation API als Fallback
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
// Aktuelle Position ermitteln
// =========================================

/**
 * Ermittelt die aktuelle GPS-Position.
 * - Nativ: Capacitor Geolocation Plugin (hohe Genauigkeit)
 * - Web: navigator.geolocation (Browser API)
 * Gibt null zurück bei jedem Fehler – blockiert nie.
 */
export async function getCurrentPosition(): Promise<GeoPosition | null> {
  try {
    if (isNativeApp()) {
      const Geolocation = await getCapacitorGeolocation()
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      })
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }
    }

    // Web-Fallback
    if (!navigator.geolocation) return null

    return new Promise<GeoPosition | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      )
    })
  } catch (error) {
    console.warn('GPS-Position konnte nicht ermittelt werden:', error)
    return null
  }
}

// =========================================
// Berechtigungsstatus prüfen
// =========================================

/**
 * Prüft den aktuellen GPS-Berechtigungsstatus.
 * - Nativ: Capacitor Geolocation.checkPermissions()
 * - Web: navigator.permissions.query
 */
export async function checkLocationPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unavailable'> {
  try {
    if (isNativeApp()) {
      const Geolocation = await getCapacitorGeolocation()
      const status = await Geolocation.checkPermissions()
      // Capacitor gibt 'granted' | 'denied' | 'prompt' zurück
      if (status.location === 'granted') return 'granted'
      if (status.location === 'denied') return 'denied'
      return 'prompt'
    }

    // Web-Fallback
    if (!navigator.geolocation) return 'unavailable'

    if (navigator.permissions) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' })
        return result.state as 'granted' | 'denied' | 'prompt'
      } catch {
        // Fallback wenn Permissions API nicht verfügbar
      }
    }

    return 'prompt'
  } catch {
    return 'unavailable'
  }
}

// =========================================
// Berechtigung anfragen
// =========================================

/**
 * Fordert GPS-Berechtigung aktiv an.
 * - Nativ: Capacitor Geolocation.requestPermissions()
 * - Web: Triggert Browser-Dialog via getCurrentPosition()
 */
export async function requestLocationPermission(): Promise<'granted' | 'denied'> {
  try {
    if (isNativeApp()) {
      const Geolocation = await getCapacitorGeolocation()
      const status = await Geolocation.requestPermissions()
      return status.location === 'granted' ? 'granted' : 'denied'
    }

    // Web-Fallback: getCurrentPosition triggert den Browser-Dialog
    const pos = await getCurrentPosition()
    return pos ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}

// =========================================
// Distanz- und Geofence-Berechnung
// (Delegiert an bestehenden gpsService)
// =========================================

/**
 * Berechnet die Entfernung zwischen Position und Baustelle in Metern
 * H8 FIX: Gibt null zurück wenn Baustelle kein GPS hat (statt 0 = "am Standort")
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
// Service-Objekt
// =========================================

export const locationService = {
  getCurrentPosition,
  checkLocationPermission,
  requestLocationPermission,
  calculateDistanceFromSite,
  isInsideConstructionSite,
}

export default locationService
