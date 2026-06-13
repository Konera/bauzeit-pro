// Zeitberechnungs-Hilfsfunktionen für BauZeit Pro
import { format, formatDistance, differenceInMinutes, differenceInSeconds, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay, addDays } from 'date-fns'
import { de } from 'date-fns/locale'

// =========================================
// Formatierungsfunktionen
// =========================================

/**
 * Formatiert Minuten in HH:MM Format
 * Beispiel: 90 → "1:30"
 */
export function formatMinutes(minutes: number): string {
  if (minutes < 0) minutes = 0
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}:${mins.toString().padStart(2, '0')}`
}

/**
 * Formatiert Sekunden als Countdown HH:MM:SS
 */
export function formatSeconds(totalSeconds: number): string {
  if (totalSeconds < 0) totalSeconds = 0
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * Formatiert ein Datum als Uhrzeit: "14:30 Uhr"
 */
export function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return format(parseISO(dateStr), 'HH:mm', { locale: de }) + ' Uhr'
}

/**
 * Formatiert ein Datum als deutsches Datum: "12. Jun 2026"
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return format(parseISO(dateStr), 'dd. MMM yyyy', { locale: de })
}

/**
 * Formatiert ein Datum mit Uhrzeit: "12. Jun 2026, 14:30 Uhr"
 */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return format(parseISO(dateStr), "dd. MMM yyyy, HH:mm 'Uhr'", { locale: de })
}

/**
 * Formatiert ein Datum als Tagesname: "Donnerstag, 12. Juni"
 */
export function formatDayName(dateStr: string): string {
  return format(parseISO(dateStr), 'EEEE, dd. MMMM', { locale: de })
}

/**
 * Gibt relative Zeit zurück: "vor 5 Minuten"
 */
export function formatRelativeTime(dateStr: string): string {
  return formatDistance(parseISO(dateStr), new Date(), {
    addSuffix: true,
    locale: de,
  })
}

// =========================================
// Berechnungsfunktionen
// =========================================

/**
 * Berechnet gearbeitete Minuten zwischen Start und Jetzt (oder End)
 */
export function calculateWorkedMinutes(
  startTime: string,
  endTime: string | null,
  pauseMinutes: number
): number {
  const end = endTime ? parseISO(endTime) : new Date()
  const total = differenceInMinutes(end, parseISO(startTime))
  return Math.max(0, total - pauseMinutes)
}

/**
 * Berechnet gearbeitete Sekunden (für Live-Timer)
 */
export function calculateWorkedSeconds(
  startTime: string,
  pauseMinutes: number,
  currentBreakStart?: string | null
): number {
  const now = new Date()
  const totalSeconds = differenceInSeconds(now, parseISO(startTime))
  const pauseSeconds = pauseMinutes * 60

  // Aktuelle Pause abziehen, wenn gerade in Pause
  const currentPauseSeconds = currentBreakStart
    ? differenceInSeconds(now, parseISO(currentBreakStart))
    : 0

  return Math.max(0, totalSeconds - pauseSeconds - currentPauseSeconds)
}

/**
 * Berechnet Pausen-Minuten aus allen Break-Einträgen
 */
export function calculateTotalPauseMinutes(
  breaks: Array<{ start_time: string; end_time: string | null }>
): number {
  return breaks.reduce((total, brk) => {
    const end = brk.end_time ? parseISO(brk.end_time) : new Date()
    const minutes = differenceInMinutes(end, parseISO(brk.start_time))
    return total + Math.max(0, minutes)
  }, 0)
}

/**
 * Prüft ob Arbeitszeit die Grenze überschreitet
 * H7 FIX: Pausenminuten werden jetzt abgezogen
 */
export function isOverTimeLimit(startTime: string, limitHours: number, pauseMinutes: number = 0): boolean {
  const elapsedMinutes = differenceInMinutes(new Date(), parseISO(startTime))
  const workedMinutes = elapsedMinutes - pauseMinutes
  return workedMinutes > limitHours * 60
}

// =========================================
// Datumsbereiche
// =========================================

export function getTodayRange(): { from: string; to: string } {
  // K9 FIX: Timezone-korrekte Tagesgrenzen (UTC+1/+2 für DE)
  const today = new Date()
  return {
    from: startOfDay(today).toISOString(),
    to: endOfDay(today).toISOString(),
  }
}

export function getWeekRange(date: Date = new Date()): { from: string; to: string } {
  const start = startOfWeek(date, { weekStartsOn: 1 }) // Montag
  const end = endOfWeek(date, { weekStartsOn: 1 })
  return {
    from: startOfDay(start).toISOString(),
    to: endOfDay(end).toISOString(),
  }
}

export function getMonthRange(date: Date = new Date()): { from: string; to: string } {
  const start = startOfMonth(date)
  const end = endOfMonth(date)
  return {
    from: startOfDay(start).toISOString(),
    to: endOfDay(end).toISOString(),
  }
}

/**
 * Gibt die letzten N Tage als Array von Datum-Strings zurück
 */
export function getLastNDays(n: number): string[] {
  const days: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const date = addDays(new Date(), -i)
    days.push(format(date, 'yyyy-MM-dd'))
  }
  return days
}

// =========================================
// GPS-Hilfsfunktionen
// =========================================

/**
 * Berechnet Distanz in Metern zwischen zwei GPS-Koordinaten (Haversine-Formel)
 */
export function calculateGPSDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000 // Erdradius in Metern
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Prüft ob Position innerhalb des Baustellen-Radius liegt
 */
export function isWithinSiteRadius(
  userLat: number, userLng: number,
  siteLat: number, siteLng: number,
  radiusM: number
): boolean {
  const distance = calculateGPSDistance(userLat, userLng, siteLat, siteLng)
  return distance <= radiusM
}

/**
 * Holt aktuelle GPS-Position
 */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation wird nicht unterstützt'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    )
  })
}
