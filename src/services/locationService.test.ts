// Unit Tests für locationService.ts – Distanz- und Geofence-Berechnungen
// HINWEIS: Capacitor-abhängige Funktionen (getCurrentPosition etc.) werden NICHT getestet.
import { describe, it, expect } from 'vitest'
import { calculateDistanceFromSite, isInsideConstructionSite } from './locationService'
import type { ConstructionSite, GeoPosition } from '../types/database'

// =========================================
// Hilfsfunktionen – Test-Daten
// =========================================

function createSite(overrides: Partial<ConstructionSite> = {}): ConstructionSite {
  return {
    id: 'site-1',
    name: 'Testbaustelle Berlin',
    address: 'Alexanderplatz 1, Berlin',
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
// calculateDistanceFromSite
// =========================================

describe('calculateDistanceFromSite', () => {
  it('sollte Distanz in Metern berechnen für normale Baustelle', () => {
    const site = createSite()
    const position = createPosition(52.525, 13.41)

    const distance = calculateDistanceFromSite(position, site)
    expect(distance).not.toBeNull()
    expect(distance).toBeGreaterThan(0)
  })

  it('sollte null zurückgeben wenn Baustelle kein GPS hat (H8 Fix)', () => {
    const site = createSite({ gps_lat: null, gps_lng: null })
    const position = createPosition(52.52, 13.405)

    const distance = calculateDistanceFromSite(position, site)
    expect(distance).toBeNull()
  })

  it('sollte null zurückgeben wenn nur gps_lat null ist', () => {
    const site = createSite({ gps_lat: null, gps_lng: 13.405 })
    const position = createPosition(52.52, 13.405)

    const distance = calculateDistanceFromSite(position, site)
    expect(distance).toBeNull()
  })

  it('sollte null zurückgeben wenn nur gps_lng null ist', () => {
    const site = createSite({ gps_lat: 52.52, gps_lng: null })
    const position = createPosition(52.52, 13.405)

    const distance = calculateDistanceFromSite(position, site)
    expect(distance).toBeNull()
  })

  it('sollte ~0 Meter zurückgeben für identische Position', () => {
    const site = createSite({ gps_lat: 52.52, gps_lng: 13.405 })
    const position = createPosition(52.52, 13.405)

    const distance = calculateDistanceFromSite(position, site)
    expect(distance).toBe(0)
  })
})

// =========================================
// isInsideConstructionSite
// =========================================

describe('isInsideConstructionSite', () => {
  it('sollte isInside=true zurückgeben wenn Position innerhalb des Radius liegt', () => {
    const site = createSite({ gps_radius_m: 500 })
    // Position nur ~11m entfernt
    const position = createPosition(52.5201, 13.405)

    const result = isInsideConstructionSite(position, site)
    expect(result.isInside).toBe(true)
  })

  it('sollte isInside=false zurückgeben wenn Position weit außerhalb liegt', () => {
    const site = createSite({ gps_radius_m: 100 })
    // Position ~5km entfernt
    const position = createPosition(52.56, 13.45)

    const result = isInsideConstructionSite(position, site)
    expect(result.isInside).toBe(false)
  })

  it('sollte isInside=true zurückgeben bei Baustelle ohne GPS-Koordinaten', () => {
    const site = createSite({ gps_lat: null, gps_lng: null })
    const position = createPosition(52.52, 13.405)

    const result = isInsideConstructionSite(position, site)
    expect(result.isInside).toBe(true)
    expect(result.distanceMeters).toBe(0)
  })

  it('sollte distanceMeters als Zahl zurückgeben', () => {
    const site = createSite()
    const position = createPosition(52.525, 13.41)

    const result = isInsideConstructionSite(position, site)
    expect(typeof result.distanceMeters).toBe('number')
    expect(result.distanceMeters).toBeGreaterThan(0)
  })
})
