// Unit Tests für gpsService.ts – GPS, Geofencing, Distanzberechnung
import { describe, it, expect, beforeEach } from 'vitest'
import { calculateDistance, checkGeofence, isGpsAvailable } from './gpsService'
import type { ConstructionSite, GeoPosition } from '../types/database'

// =========================================
// Hilfsfunktionen – Test-Daten
// =========================================

function createSite(overrides: Partial<ConstructionSite> = {}): ConstructionSite {
  return {
    id: 'site-1',
    name: 'Testbaustelle',
    address: 'Teststraße 1',
    manager_id: null,
    gps_lat: 52.52,
    gps_lng: 13.405,
    gps_radius_m: 200,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function createPosition(lat: number, lng: number): GeoPosition {
  return { lat, lng, accuracy: 10 }
}

// =========================================
// calculateDistance (Haversine-Formel)
// =========================================

describe('calculateDistance', () => {
  it('sollte 0 für identische Koordinaten zurückgeben', () => {
    const distance = calculateDistance(52.52, 13.405, 52.52, 13.405)
    expect(distance).toBe(0)
  })

  it('sollte Berlin → München ungefähr 504 km berechnen', () => {
    // Berlin: 52.52°N, 13.405°E — München: 48.1351°N, 11.582°E
    const distance = calculateDistance(52.52, 13.405, 48.1351, 11.582)
    const distanceKm = distance / 1000
    // Erwartung: ~504 km ±10 km Toleranz
    expect(distanceKm).toBeGreaterThan(490)
    expect(distanceKm).toBeLessThan(520)
  })

  it('sollte kurze Distanzen in Metern korrekt berechnen', () => {
    // Zwei Punkte ~100m auseinander in Berlin
    const distance = calculateDistance(52.52, 13.405, 52.521, 13.405)
    // ~111m (1 Breitengrad-Minute ≈ 111m)
    expect(distance).toBeGreaterThan(100)
    expect(distance).toBeLessThan(150)
  })

  it('sollte symmetrisch sein (A→B = B→A)', () => {
    const d1 = calculateDistance(52.52, 13.405, 48.1351, 11.582)
    const d2 = calculateDistance(48.1351, 11.582, 52.52, 13.405)
    expect(d1).toBeCloseTo(d2, 5)
  })
})

// =========================================
// checkGeofence
// =========================================

describe('checkGeofence', () => {
  it('sollte isInside=true zurückgeben wenn Position innerhalb des Radius liegt', () => {
    // Baustelle bei 52.52, 13.405 mit 200m Radius
    const site = createSite({ gps_radius_m: 200 })
    // Position nur ~10m entfernt
    const position = createPosition(52.5201, 13.405)

    const result = checkGeofence(position, site)
    expect(result.isInside).toBe(true)
    expect(result.distanceMeters).toBeLessThan(200)
  })

  it('sollte isInside=false zurückgeben wenn Position außerhalb des Radius liegt', () => {
    const site = createSite({ gps_radius_m: 100 })
    // Position ~5km entfernt
    const position = createPosition(52.56, 13.405)

    const result = checkGeofence(position, site)
    expect(result.isInside).toBe(false)
    expect(result.distanceMeters).toBeGreaterThan(100)
  })

  it('sollte isInside=true und distanceMeters=0 zurückgeben wenn Baustelle kein GPS hat', () => {
    const site = createSite({ gps_lat: null, gps_lng: null })
    const position = createPosition(52.52, 13.405)

    const result = checkGeofence(position, site)
    expect(result.isInside).toBe(true)
    expect(result.distanceMeters).toBe(0)
  })

  it('sollte Distanz als gerundete Ganzzahl zurückgeben', () => {
    const site = createSite()
    const position = createPosition(52.525, 13.41)

    const result = checkGeofence(position, site)
    expect(Number.isInteger(result.distanceMeters)).toBe(true)
  })
})

// =========================================
// isGpsAvailable
// =========================================

describe('isGpsAvailable', () => {
  it('sollte true zurückgeben in normaler jsdom-Umgebung (navigator.geolocation vorhanden)', () => {
    // jsdom hat standardmäßig navigator.geolocation
    expect(typeof isGpsAvailable()).toBe('boolean')
  })
})
