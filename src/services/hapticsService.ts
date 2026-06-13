// Haptics Service – Vereinheitlichte Vibrations-Schicht
// Nutzt Capacitor Haptics nativ, navigator.vibrate als Fallback
// Vibration darf NIEMALS die App crashen – alle Fehler werden abgefangen.

import { isNativeApp } from '../utils/platform'

// =========================================
// Capacitor Plugin dynamisch laden
// =========================================

async function getCapacitorHaptics() {
  const mod = await import('@capacitor/haptics')
  return {
    Haptics: mod.Haptics,
    ImpactStyle: mod.ImpactStyle,
    NotificationType: mod.NotificationType,
  }
}

// =========================================
// Web-Fallback Vibration
// =========================================

function webVibrate(pattern: number | number[]): void {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  } catch {
    // Vibration nicht verfügbar – ignorieren
  }
}

// =========================================
// Kurze Vibration (UI-Feedback bei Tap)
// =========================================

/**
 * Leichte Vibration für UI-Interaktionen.
 * Nativ: Haptics.impact(Light) – kurzes Tippen
 * Web: navigator.vibrate(50ms)
 */
export async function vibrateShort(): Promise<void> {
  try {
    if (isNativeApp()) {
      const { Haptics, ImpactStyle } = await getCapacitorHaptics()
      await Haptics.impact({ style: ImpactStyle.Light })
      return
    }
    webVibrate(50)
  } catch {
    // Vibration fehlgeschlagen – kein Problem
  }
}

// =========================================
// Warnungs-Vibration
// =========================================

/**
 * Spürbare Vibration für Warnungen (GPS-Warnung, Überstunden).
 * Nativ: Haptics.notification(Warning) – deutliches Feedback
 * Web: navigator.vibrate([300, 200, 300]) – Muster
 */
export async function vibrateWarning(): Promise<void> {
  try {
    if (isNativeApp()) {
      const { Haptics, NotificationType } = await getCapacitorHaptics()
      await Haptics.notification({ type: NotificationType.Warning })
      return
    }
    webVibrate([300, 200, 300])
  } catch {
    // Vibration fehlgeschlagen – kein Problem
  }
}

// =========================================
// Erfolgs-Vibration
// =========================================

/**
 * Positive Vibration bei Erfolg (Arbeit gestartet, Pause beendet).
 * Nativ: Haptics.notification(Success) – sanftes Feedback
 * Web: navigator.vibrate([100, 50, 100])
 */
export async function vibrateSuccess(): Promise<void> {
  try {
    if (isNativeApp()) {
      const { Haptics, NotificationType } = await getCapacitorHaptics()
      await Haptics.notification({ type: NotificationType.Success })
      return
    }
    webVibrate([100, 50, 100])
  } catch {
    // Vibration fehlgeschlagen – kein Problem
  }
}

// =========================================
// Fehler-Vibration
// =========================================

/**
 * Starke Vibration bei Fehler (Aktion fehlgeschlagen).
 * Nativ: Haptics.notification(Error) – kräftiges Feedback
 * Web: navigator.vibrate([400, 200, 400])
 */
export async function vibrateError(): Promise<void> {
  try {
    if (isNativeApp()) {
      const { Haptics, NotificationType } = await getCapacitorHaptics()
      await Haptics.notification({ type: NotificationType.Error })
      return
    }
    webVibrate([400, 200, 400])
  } catch {
    // Vibration fehlgeschlagen – kein Problem
  }
}

// =========================================
// Service-Objekt
// =========================================

export const hapticsService = {
  vibrateShort,
  vibrateWarning,
  vibrateSuccess,
  vibrateError,
}

export default hapticsService
