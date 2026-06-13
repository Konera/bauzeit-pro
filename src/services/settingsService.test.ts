// Unit Tests für settingsService.ts – Einstellungen laden/speichern
import { describe, it, expect, vi, beforeEach } from 'vitest'

// idb-keyval mocken BEVOR der Service importiert wird
vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
  createStore: vi.fn().mockReturnValue({}),
}))

// Modul frisch laden bei jedem Test (wegen in-memory Cache)
let getSettings: typeof import('./settingsService').getSettings
let saveSettings: typeof import('./settingsService').saveSettings
let updateSettings: typeof import('./settingsService').updateSettings
let defaultSettings: typeof import('./settingsService').defaultSettings

beforeEach(async () => {
  // Cache zurücksetzen durch frischen Import
  vi.resetModules()
  vi.mock('idb-keyval', () => ({
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    createStore: vi.fn().mockReturnValue({}),
  }))
  localStorage.clear()

  const module = await import('./settingsService')
  getSettings = module.getSettings
  saveSettings = module.saveSettings
  updateSettings = module.updateSettings
  defaultSettings = module.defaultSettings
})

// =========================================
// getSettings – Standardwerte
// =========================================

describe('getSettings', () => {
  it('sollte Standard-Einstellungen zurückgeben wenn leer', () => {
    const settings = getSettings()

    expect(settings.maxWorkHours).toBe(defaultSettings.maxWorkHours)
    expect(settings.maxPauseMinutes).toBe(defaultSettings.maxPauseMinutes)
    expect(settings.geofenceEnabled).toBe(false)
    expect(settings.motionDetectionEnabled).toBe(false)
  })

  it('sollte alle erwarteten Felder enthalten', () => {
    const settings = getSettings()

    expect(settings).toHaveProperty('maxWorkHours')
    expect(settings).toHaveProperty('maxPauseMinutes')
    expect(settings).toHaveProperty('warningBeforePauseEnd')
    expect(settings).toHaveProperty('reminderAfterMinutes')
    expect(settings).toHaveProperty('workStartReminder')
    expect(settings).toHaveProperty('workStartTime')
    expect(settings).toHaveProperty('workDays')
    expect(settings).toHaveProperty('autoPause')
    expect(settings).toHaveProperty('geofenceEnabled')
    expect(settings).toHaveProperty('motionDetectionEnabled')
  })

  it('sollte Werte aus localStorage lesen wenn vorhanden', () => {
    localStorage.setItem('bauzeit_settings', JSON.stringify({
      maxWorkHours: 12,
      maxPauseMinutes: 45,
    }))

    // Wir müssen den Module-Cache nochmal zurücksetzen
    const settings = getSettings()
    expect(settings.maxWorkHours).toBe(12)
    expect(settings.maxPauseMinutes).toBe(45)
  })

  it('sollte fehlende Felder mit Defaults ergänzen beim localStorage-Lesen', () => {
    localStorage.setItem('bauzeit_settings', JSON.stringify({
      maxWorkHours: 8,
    }))

    const settings = getSettings()
    // Gespeicherter Wert
    expect(settings.maxWorkHours).toBe(8)
    // Nicht gespeicherter Wert → Default
    expect(settings.geofenceEnabled).toBe(defaultSettings.geofenceEnabled)
  })

  it('sollte eine Kopie zurückgeben (keine Referenz auf internen Cache)', () => {
    const settings1 = getSettings()
    const settings2 = getSettings()
    expect(settings1).not.toBe(settings2) // Verschiedene Objekte
    expect(settings1).toEqual(settings2) // Gleiche Werte
  })
})

// =========================================
// saveSettings
// =========================================

describe('saveSettings', () => {
  it('sollte Einstellungen in localStorage persistieren', async () => {
    const newSettings = { ...defaultSettings, maxWorkHours: 12 }
    await saveSettings(newSettings)

    const stored = localStorage.getItem('bauzeit_settings')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.maxWorkHours).toBe(12)
  })

  it('sollte danach die neuen Werte über getSettings verfügbar machen', async () => {
    const newSettings = { ...defaultSettings, maxPauseMinutes: 60 }
    await saveSettings(newSettings)

    const settings = getSettings()
    expect(settings.maxPauseMinutes).toBe(60)
  })
})

// =========================================
// updateSettings – Teilaktualisierung
// =========================================

describe('updateSettings', () => {
  it('sollte nur angegebene Felder aktualisieren', async () => {
    const updated = await updateSettings({ maxWorkHours: 6 })

    expect(updated.maxWorkHours).toBe(6)
    // Andere Felder bleiben auf Default
    expect(updated.maxPauseMinutes).toBe(defaultSettings.maxPauseMinutes)
  })

  it('sollte das aktualisierte Settings-Objekt zurückgeben', async () => {
    const updated = await updateSettings({
      geofenceEnabled: true,
      motionDetectionEnabled: true,
    })

    expect(updated.geofenceEnabled).toBe(true)
    expect(updated.motionDetectionEnabled).toBe(true)
  })

  it('sollte die aktualisierten Werte danach per getSettings verfügbar machen', async () => {
    await updateSettings({ workStartTime: '06:30' })

    const settings = getSettings()
    expect(settings.workStartTime).toBe('06:30')
  })

  it('sollte mehrere Teilaktualisierungen korrekt kumulieren', async () => {
    await updateSettings({ maxWorkHours: 8 })
    await updateSettings({ maxPauseMinutes: 45 })

    const settings = getSettings()
    expect(settings.maxWorkHours).toBe(8)
    expect(settings.maxPauseMinutes).toBe(45)
  })
})
