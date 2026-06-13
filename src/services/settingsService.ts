// H3 FIX: Zentraler Settings-Service mit IndexedDB-Persistenz
// Ersetzt die bisherige localStorage-basierte Speicherung
import { get, set, createStore } from 'idb-keyval'

// =========================================
// IndexedDB Store
// =========================================

const settingsStore = createStore('bauzeit-settings', 'settings')
const SETTINGS_KEY = 'app-settings'

// =========================================
// Standard-Einstellungen
// =========================================

export interface AppSettings {
  maxWorkHours: number
  maxPauseMinutes: number
  warningBeforePauseEnd: number
  reminderAfterMinutes: number
  workStartReminder: boolean
  workStartTime: string
  workDays: number[]
  autoPause: boolean
  autoPauseAfterMinutes: number
  autoPauseDurationMinutes: number
  geofenceEnabled: boolean
  geofenceAutoClockIn: boolean
  geofenceAutoClockOut: boolean
  motionDetectionEnabled: boolean
}

export const defaultSettings: AppSettings = {
  maxWorkHours: 10,
  maxPauseMinutes: 30,
  warningBeforePauseEnd: 5,
  reminderAfterMinutes: 15,
  workStartReminder: false,
  workStartTime: '07:00',
  workDays: [1, 2, 3, 4, 5, 6],
  autoPause: false,
  autoPauseAfterMinutes: 360,
  autoPauseDurationMinutes: 30,
  geofenceEnabled: false,
  geofenceAutoClockIn: false,
  geofenceAutoClockOut: false,
  motionDetectionEnabled: false,
}

// =========================================
// In-Memory Cache (schneller Zugriff, synchron)
// =========================================

let cachedSettings: AppSettings = { ...defaultSettings }
let initialized = false

// Initialisierung: Lade aus IndexedDB, Fallback auf localStorage
async function initializeSettings(): Promise<AppSettings> {
  if (initialized) return cachedSettings

  try {
    // Versuch IndexedDB
    const stored = await get<AppSettings>(SETTINGS_KEY, settingsStore)
    if (stored) {
      cachedSettings = { ...defaultSettings, ...stored }
      initialized = true
      return cachedSettings
    }
  } catch {
    // IndexedDB nicht verfügbar (Private Browsing etc.)
  }

  // Fallback: localStorage migrieren
  try {
    const legacy = localStorage.getItem('bauzeit_settings')
    if (legacy) {
      const parsed = JSON.parse(legacy)
      cachedSettings = { ...defaultSettings, ...parsed }
      // In IndexedDB migrieren
      try {
        await set(SETTINGS_KEY, cachedSettings, settingsStore)
        // localStorage nach Migration aufräumen
        // localStorage.removeItem('bauzeit_settings')  // Erst wenn alles stabil
      } catch {
        // Stille Migration
      }
    }
  } catch {
    // localStorage auch nicht verfügbar
  }

  initialized = true
  return cachedSettings
}

// =========================================
// Öffentliche API
// =========================================

/**
 * Synchroner Zugriff auf aktuelle Settings (aus Cache)
 * Für Services die synchron zugreifen müssen (autoClockService etc.)
 */
export function getSettings(): AppSettings {
  if (!initialized) {
    // Synchroner Fallback auf localStorage beim ersten Aufruf
    try {
      const legacy = localStorage.getItem('bauzeit_settings')
      if (legacy) {
        cachedSettings = { ...defaultSettings, ...JSON.parse(legacy) }
      }
    } catch {
      // Ignorieren
    }
    // Async-Init im Hintergrund starten
    initializeSettings().catch(() => {})
  }
  return { ...cachedSettings }
}

/**
 * Asynchroner Zugriff auf Settings (aus IndexedDB)
 */
export async function getSettingsAsync(): Promise<AppSettings> {
  return initializeSettings()
}

/**
 * Settings speichern (IndexedDB + localStorage Fallback)
 */
export async function saveSettings(newSettings: AppSettings): Promise<void> {
  cachedSettings = { ...newSettings }

  // IndexedDB (primär)
  try {
    await set(SETTINGS_KEY, cachedSettings, settingsStore)
  } catch {
    // Fallback
  }

  // localStorage (Backup, für sofortige synchrone Zugriffe)
  try {
    localStorage.setItem('bauzeit_settings', JSON.stringify(cachedSettings))
  } catch {
    // Storage voll
  }
}

/**
 * Einzelne Setting-Werte aktualisieren
 */
export async function updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  const current = getSettings()
  const updated = { ...current, ...partial }
  await saveSettings(updated)
  return updated
}

// Default Export für Service-Pattern
export const settingsService = {
  getSettings,
  getSettingsAsync,
  saveSettings,
  updateSettings,
  defaultSettings,
}

export default settingsService
