// Background Geofence Service – GPS-Polling, Geofence-Monitoring, Bewegungserkennung
// Nutzt Foreground-GPS via @capacitor/geolocation mit 30s Intervall
// Native Background-GPS-Watcher ist vorbereitet, Plugin aber nicht installiert

import { locationService } from './locationService'
import { gpsService } from './gpsService'
import type { GeoPosition, ConstructionSite } from '../types/database'
import { getPlatformInfo } from '../utils/platform'

// Inline-Typen für den optionalen Background-GPS-Watcher (Plugin nicht installiert)
interface BackgroundGeolocationPlugin {
  addWatcher(opts: Record<string, unknown>, cb: (loc: Location | undefined, err: CallbackError | undefined) => void): Promise<string>
  removeWatcher(opts: { id: string }): Promise<void>
}
interface Location { latitude: number; longitude: number; accuracy: number }
interface CallbackError { code: string }

// =========================================
// State
// =========================================

interface GeofenceState {
  isMonitoring: boolean
  lastPosition: GeoPosition | null
  lastPositionTime: number | null
  previousPosition: GeoPosition | null
  previousPositionTime: number | null
  insideSites: Set<string>
  distanceToNearest: number | null
  nearestSite: ConstructionSite | null
  accuracy: number | null
  lastUpdateTime: number | null
  speedKmh: number
  isNativeBackground: boolean
  consecutiveFastReadings: number
}

const state: GeofenceState = {
  isMonitoring: false,
  lastPosition: null,
  lastPositionTime: null,
  previousPosition: null,
  previousPositionTime: null,
  insideSites: new Set(),
  distanceToNearest: null,
  nearestSite: null,
  accuracy: null,
  lastUpdateTime: null,
  speedKmh: 0,
  isNativeBackground: false,
  consecutiveFastReadings: 0,
}

let pollingInterval: ReturnType<typeof setInterval> | null = null
let monitoredSites: ConstructionSite[] = []
let nativeWatcherId: string | null = null

// =========================================
// Event Callbacks
// =========================================

type GeofenceCallback = (siteId: string, siteName: string) => void
type MotionCallback = (speedKmh: number) => void

let onEnterCallbacks: GeofenceCallback[] = []
let onExitCallbacks: GeofenceCallback[] = []
let onMotionCallbacks: MotionCallback[] = []

// =========================================
// Geschwindigkeit berechnen (direkte Haversine)
// =========================================

function calculateSpeedKmh(
  pos1: GeoPosition, time1: number,
  pos2: GeoPosition, time2: number
): number {
  // H8 FIX: Direkte Haversine statt calculateDistanceFromSite
  const distanceM = gpsService.calculateDistance(pos1.lat, pos1.lng, pos2.lat, pos2.lng)
  const timeDiffSeconds = (time2 - time1) / 1000
  if (timeDiffSeconds <= 0) return 0
  return (distanceM / timeDiffSeconds) * 3.6
}

// =========================================
// GPS-Position verarbeiten & Events auslösen
// =========================================

function processPosition(position: GeoPosition): void {
  const now = Date.now()

  // Genauigkeitsfilter: Positionen > 100m ignorieren
  if (position.accuracy > 100) return

  // Geschwindigkeit berechnen
  if (state.lastPosition && state.lastPositionTime) {
    const speed = calculateSpeedKmh(
      state.lastPosition, state.lastPositionTime,
      position, now
    )
    state.speedKmh = speed < 200 ? speed : state.speedKmh

    // M5 FIX: Konsekutiv-Filter für Bewegungserkennung
    if (state.speedKmh > 15) {
      state.consecutiveFastReadings++
      if (state.consecutiveFastReadings >= 3 && state.previousPosition && state.previousPositionTime) {
        const prevSpeed = calculateSpeedKmh(
          state.previousPosition, state.previousPositionTime,
          state.lastPosition, state.lastPositionTime
        )
        if (prevSpeed < 5) {
          onMotionCallbacks.forEach(cb => {
            try { cb(state.speedKmh) } catch (e) { console.warn('Motion callback error:', e) }
          })
        }
      }
    } else {
      state.consecutiveFastReadings = 0
    }
  }

  // Position updaten
  state.previousPosition = state.lastPosition
  state.previousPositionTime = state.lastPositionTime
  state.lastPosition = position
  state.lastPositionTime = now
  state.accuracy = position.accuracy
  state.lastUpdateTime = now

  // Geofence-Checks
  let nearestDist = Infinity
  let nearestSite: ConstructionSite | null = null

  for (const site of monitoredSites) {
    if (site.gps_lat === null || site.gps_lng === null) continue

    const result = locationService.isInsideConstructionSite(position, site)
    const wasInside = state.insideSites.has(site.id)
    const isNowInside = result.isInside

    if (result.distanceMeters < nearestDist) {
      nearestDist = result.distanceMeters
      nearestSite = site
    }

    if (isNowInside && !wasInside) {
      state.insideSites.add(site.id)
      onEnterCallbacks.forEach(cb => {
        try { cb(site.id, site.name) } catch (e) { console.warn('Enter callback error:', e) }
      })
    }

    if (!isNowInside && wasInside) {
      state.insideSites.delete(site.id)
      onExitCallbacks.forEach(cb => {
        try { cb(site.id, site.name) } catch (e) { console.warn('Exit callback error:', e) }
      })
    }
  }

  state.distanceToNearest = nearestDist === Infinity ? null : Math.round(nearestDist)
  state.nearestSite = nearestSite
}

async function checkPosition(): Promise<void> {
  try {
    const position = await locationService.getCurrentPosition()
    if (!position) return
    processPosition(position)
  } catch (error) {
    console.warn('GPS-Check fehlgeschlagen (non-blocking):', error)
  }
}

// =========================================
// H4: Native Background Geolocation
// =========================================

async function startNativeBackground(): Promise<boolean> {
  try {
    // Capacitor Plugin dynamisch laden (registerPlugin Muster)
    const { registerPlugin } = await import('@capacitor/core')
    const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')

    nativeWatcherId = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: 'BauZeit Pro überwacht Ihren Standort für die Zeiterfassung.',
        backgroundTitle: 'BauZeit Pro – GPS aktiv',
        requestPermissions: true,
        stale: false,
        distanceFilter: 20,
      },
      (location: Location | undefined, error: CallbackError | undefined) => {
        if (error) {
          if (error.code === 'NOT_AUTHORIZED') {
            console.warn('Background GPS: Keine Berechtigung')
          }
          return
        }
        if (location) {
          processPosition({
            lat: location.latitude,
            lng: location.longitude,
            accuracy: location.accuracy,
          })
        }
      }
    )

    state.isNativeBackground = true
    console.log('✅ Native Background GPS gestartet')
    return true
  } catch (err) {
    console.warn('Native Background GPS nicht verfügbar:', err)
    return false
  }
}

async function stopNativeBackground(): Promise<void> {
  if (nativeWatcherId) {
    try {
      const { registerPlugin } = await import('@capacitor/core')
      const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')
      await BackgroundGeolocation.removeWatcher({ id: nativeWatcherId })
      nativeWatcherId = null
      state.isNativeBackground = false
    } catch (err) {
      console.warn('Native Background GPS Stop Fehler:', err)
    }
  }
}

// =========================================
// Public API
// =========================================

async function startMonitoring(sites: ConstructionSite[]): Promise<void> {
  if (state.isMonitoring) stopMonitoring()

  monitoredSites = sites.filter(s => s.gps_lat !== null && s.gps_lng !== null)
  if (monitoredSites.length === 0) return

  state.isMonitoring = true
  state.insideSites.clear()
  state.consecutiveFastReadings = 0

  // H4: Native Background GPS auf mobilen Plattformen
  const platform = getPlatformInfo()
  if (platform.isNative) {
    const nativeStarted = await startNativeBackground()
    if (nativeStarted) return
  }

  // Fallback: Polling im Vordergrund
  checkPosition().catch(() => {})
  pollingInterval = setInterval(() => {
    checkPosition().catch(() => {})
  }, 30_000)
}

function stopMonitoring(): void {
  state.isMonitoring = false

  if (state.isNativeBackground) {
    stopNativeBackground().catch(() => {})
  }

  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }

  state.insideSites.clear()
  state.lastPosition = null
  state.distanceToNearest = null
  state.nearestSite = null
  state.speedKmh = 0
  state.consecutiveFastReadings = 0
}

function onGeofenceEnter(callback: GeofenceCallback): () => void {
  onEnterCallbacks.push(callback)
  return () => { onEnterCallbacks = onEnterCallbacks.filter(cb => cb !== callback) }
}

function onGeofenceExit(callback: GeofenceCallback): () => void {
  onExitCallbacks.push(callback)
  return () => { onExitCallbacks = onExitCallbacks.filter(cb => cb !== callback) }
}

function onMotionChange(callback: MotionCallback): () => void {
  onMotionCallbacks.push(callback)
  return () => { onMotionCallbacks = onMotionCallbacks.filter(cb => cb !== callback) }
}

function getState(): Readonly<GeofenceState> {
  return { ...state, insideSites: new Set(state.insideSites) }
}

function isActive(): boolean {
  return state.isMonitoring
}

async function forceCheck(): Promise<void> {
  await checkPosition()
}

// =========================================
// Export
// =========================================

export const backgroundGeofenceService = {
  startMonitoring,
  stopMonitoring,
  onGeofenceEnter,
  onGeofenceExit,
  onMotionChange,
  getState,
  isActive,
  forceCheck,
}

export default backgroundGeofenceService
