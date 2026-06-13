// GPS Service – Geolokalisierung, Geofencing, Distanzberechnung
import type { GeoPosition, ConstructionSite } from '../types/database'

// Erdradius in Metern für die Haversine-Formel
const EARTH_RADIUS_M = 6_371_000

// Standard-Timeout für GPS-Abfragen (10 Sekunden)
const GPS_TIMEOUT_MS = 10_000

// =========================================
// Geofence-Ergebnis
// =========================================

export interface GeofenceResult {
  isInside: boolean
  distanceMeters: number
}

// =========================================
// Aktuelle Position ermitteln
// =========================================

/**
 * Ermittelt die aktuelle GPS-Position des Geräts.
 * Gibt null zurück bei Fehler oder fehlender Berechtigung.
 */
export function getCurrentPosition(): Promise<GeoPosition | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('GPS nicht verfügbar: Geolocation API fehlt')
      resolve(null)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            console.warn('GPS-Berechtigung verweigert')
            break
          case error.POSITION_UNAVAILABLE:
            console.warn('GPS-Position nicht verfügbar')
            break
          case error.TIMEOUT:
            console.warn('GPS-Abfrage Timeout nach', GPS_TIMEOUT_MS, 'ms')
            break
          default:
            console.warn('GPS-Fehler:', error.message)
        }
        resolve(null)
      },
      {
        enableHighAccuracy: true,
        timeout: GPS_TIMEOUT_MS,
        maximumAge: 0,
      },
    )
  })
}

// =========================================
// Distanzberechnung (Haversine-Formel)
// =========================================

/**
 * Berechnet die Entfernung zwischen zwei GPS-Koordinaten
 * nach der Haversine-Formel. Rückgabe in Metern.
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS_M * c
}

// =========================================
// Geofence-Prüfung
// =========================================

/**
 * Prüft ob eine Position innerhalb des Geofence einer Baustelle liegt.
 * Wenn die Baustelle keine GPS-Koordinaten hat, wird immer { isInside: true, distanceMeters: 0 } zurückgegeben.
 */
export function checkGeofence(position: GeoPosition, site: ConstructionSite): GeofenceResult {
  // Baustelle ohne GPS-Koordinaten – Geofence-Prüfung nicht möglich
  if (site.gps_lat === null || site.gps_lng === null) {
    return { isInside: true, distanceMeters: 0 }
  }

  const distanceMeters = calculateDistance(
    position.lat,
    position.lng,
    site.gps_lat,
    site.gps_lng,
  )

  return {
    isInside: distanceMeters <= site.gps_radius_m,
    distanceMeters: Math.round(distanceMeters),
  }
}

// =========================================
// GPS-Verfügbarkeit
// =========================================

/**
 * Prüft ob die Geolocation API im Browser verfügbar ist.
 */
export function isGpsAvailable(): boolean {
  return 'geolocation' in navigator
}

// =========================================
// Berechtigungsstatus
// =========================================

/**
 * Ermittelt den aktuellen GPS-Berechtigungsstatus.
 * Nutzt die Permissions API mit Fallback für ältere Browser.
 */
export async function getGpsPermissionStatus(): Promise<'granted' | 'denied' | 'prompt' | 'unavailable'> {
  if (!isGpsAvailable()) return 'unavailable'

  // Permissions API nutzen (falls verfügbar)
  if (navigator.permissions) {
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' })
      return status.state as 'granted' | 'denied' | 'prompt'
    } catch (error) {
      console.warn('Permissions API Fehler, nutze Fallback:', error)
    }
  }

  // Fallback: Kurze GPS-Abfrage um den Status zu ermitteln
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve('prompt')
    }, 1000)

    navigator.geolocation.getCurrentPosition(
      () => {
        clearTimeout(timeoutId)
        resolve('granted')
      },
      (error) => {
        clearTimeout(timeoutId)
        resolve(error.code === error.PERMISSION_DENIED ? 'denied' : 'prompt')
      },
      { timeout: 1000, maximumAge: Infinity },
    )
  })
}

// =========================================
// Service-Objekt mit allen Methoden
// =========================================

export const gpsService = {
  getCurrentPosition,
  calculateDistance,
  checkGeofence,
  isGpsAvailable,
  getGpsPermissionStatus,
}

export default gpsService
