// Unit Tests für timeUtils.ts – Zeitberechnungs-Hilfsfunktionen
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  formatMinutes,
  formatSeconds,
  calculateWorkedSeconds,
  isOverTimeLimit,
  getTodayRange,
  getWeekRange,
  getMonthRange,
  calculateTotalPauseMinutes,
} from './timeUtils'

// =========================================
// formatMinutes
// =========================================

describe('formatMinutes', () => {
  it('sollte 0 Minuten als "0:00" formatieren', () => {
    expect(formatMinutes(0)).toBe('0:00')
  })

  it('sollte 60 Minuten als "1:00" formatieren', () => {
    expect(formatMinutes(60)).toBe('1:00')
  })

  it('sollte 90 Minuten als "1:30" formatieren', () => {
    expect(formatMinutes(90)).toBe('1:30')
  })

  it('sollte 125 Minuten als "2:05" formatieren', () => {
    expect(formatMinutes(125)).toBe('2:05')
  })

  it('sollte negative Werte als "0:00" behandeln', () => {
    expect(formatMinutes(-10)).toBe('0:00')
  })
})

// =========================================
// formatSeconds
// =========================================

describe('formatSeconds', () => {
  it('sollte 0 Sekunden als "00:00:00" formatieren', () => {
    expect(formatSeconds(0)).toBe('00:00:00')
  })

  it('sollte 3661 Sekunden als "01:01:01" formatieren (1h 1m 1s)', () => {
    expect(formatSeconds(3661)).toBe('01:01:01')
  })

  it('sollte 59 Sekunden als "00:00:59" formatieren', () => {
    expect(formatSeconds(59)).toBe('00:00:59')
  })

  it('sollte negative Werte als "00:00:00" behandeln', () => {
    expect(formatSeconds(-100)).toBe('00:00:00')
  })
})

// =========================================
// calculateWorkedSeconds
// =========================================

describe('calculateWorkedSeconds', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sollte gearbeitete Sekunden ohne Pause berechnen', () => {
    const now = new Date('2026-06-13T14:00:00Z')
    vi.setSystemTime(now)

    // Arbeitsbeginn vor 3600 Sekunden (1 Stunde)
    const startTime = '2026-06-13T13:00:00Z'
    const result = calculateWorkedSeconds(startTime, 0)
    expect(result).toBe(3600)
  })

  it('sollte Pausenminuten korrekt abziehen', () => {
    const now = new Date('2026-06-13T14:00:00Z')
    vi.setSystemTime(now)

    // 1 Stunde gearbeitet, 15 Minuten Pause
    const startTime = '2026-06-13T13:00:00Z'
    const result = calculateWorkedSeconds(startTime, 15)
    // 3600 - (15 * 60) = 3600 - 900 = 2700
    expect(result).toBe(2700)
  })

  it('sollte aktuelle Pause berücksichtigen wenn currentBreakStart angegeben', () => {
    const now = new Date('2026-06-13T14:00:00Z')
    vi.setSystemTime(now)

    // 1 Stunde gearbeitet, keine vergangene Pause, aktuelle Pause seit 10 Minuten
    const startTime = '2026-06-13T13:00:00Z'
    const currentBreakStart = '2026-06-13T13:50:00Z'
    const result = calculateWorkedSeconds(startTime, 0, currentBreakStart)
    // 3600 - 0 - 600 = 3000
    expect(result).toBe(3000)
  })

  it('sollte nicht unter 0 fallen', () => {
    const now = new Date('2026-06-13T13:05:00Z')
    vi.setSystemTime(now)

    // 5 Minuten gearbeitet, aber 60 Minuten Pause eingetragen
    const startTime = '2026-06-13T13:00:00Z'
    const result = calculateWorkedSeconds(startTime, 60)
    expect(result).toBe(0)
  })
})

// =========================================
// isOverTimeLimit
// =========================================

describe('isOverTimeLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sollte false zurückgeben wenn unter dem Limit', () => {
    const now = new Date('2026-06-13T15:00:00Z')
    vi.setSystemTime(now)

    // 2 Stunden gearbeitet, Limit 10 Stunden
    const startTime = '2026-06-13T13:00:00Z'
    expect(isOverTimeLimit(startTime, 10)).toBe(false)
  })

  it('sollte true zurückgeben wenn über dem Limit', () => {
    const now = new Date('2026-06-13T23:30:00Z')
    vi.setSystemTime(now)

    // 10.5 Stunden gearbeitet, Limit 10 Stunden
    const startTime = '2026-06-13T13:00:00Z'
    expect(isOverTimeLimit(startTime, 10)).toBe(true)
  })

  it('sollte Pausenminuten bei Limit-Berechnung abziehen (H7 Fix)', () => {
    const now = new Date('2026-06-13T23:30:00Z')
    vi.setSystemTime(now)

    // 10.5 Stunden vergangen, ABER 60 Min Pause → 9.5 Stunden gearbeitet
    const startTime = '2026-06-13T13:00:00Z'
    expect(isOverTimeLimit(startTime, 10, 60)).toBe(false)
  })

  it('sollte mit Pause trotzdem über Limit sein wenn tatsächlich überschritten', () => {
    const now = new Date('2026-06-14T00:30:00Z')
    vi.setSystemTime(now)

    // 11.5 Stunden vergangen, 30 Min Pause → 11 Stunden gearbeitet
    const startTime = '2026-06-13T13:00:00Z'
    expect(isOverTimeLimit(startTime, 10, 30)).toBe(true)
  })
})

// =========================================
// getTodayRange
// =========================================

describe('getTodayRange', () => {
  it('sollte gültige ISO-Strings zurückgeben', () => {
    const range = getTodayRange()
    expect(range.from).toBeDefined()
    expect(range.to).toBeDefined()
    // Prüfe dass es gültige ISO-Strings sind
    expect(() => new Date(range.from)).not.toThrow()
    expect(() => new Date(range.to)).not.toThrow()
    // "from" muss vor "to" liegen
    expect(new Date(range.from).getTime()).toBeLessThan(new Date(range.to).getTime())
  })

  it('sollte Tagesanfang und Tagesende des heutigen Tages zurückgeben', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-13T12:00:00Z'))

    const range = getTodayRange()
    const from = new Date(range.from)
    const to = new Date(range.to)

    // "from" sollte Mitternacht sein (00:00:00)
    expect(from.getHours()).toBe(0)
    expect(from.getMinutes()).toBe(0)
    expect(from.getSeconds()).toBe(0)

    // "to" sollte Ende des Tages sein (23:59:59)
    expect(to.getHours()).toBe(23)
    expect(to.getMinutes()).toBe(59)
    expect(to.getSeconds()).toBe(59)

    vi.useRealTimers()
  })
})

// =========================================
// getWeekRange
// =========================================

describe('getWeekRange', () => {
  it('sollte eine Woche ab Montag starten', () => {
    // Mittwoch, 10. Juni 2026
    const date = new Date('2026-06-10T12:00:00Z')
    const range = getWeekRange(date)

    const from = new Date(range.from)
    // Montag = Tag 1 in JS getDay() (Montag=1)
    expect(from.getDay()).toBe(1) // Montag
  })

  it('sollte am Sonntag enden', () => {
    const date = new Date('2026-06-10T12:00:00Z')
    const range = getWeekRange(date)

    const to = new Date(range.to)
    // Sonntag = Tag 0 in JS
    expect(to.getDay()).toBe(0) // Sonntag
  })

  it('sollte gültige ISO-Strings zurückgeben', () => {
    const range = getWeekRange()
    expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(range.to).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

// =========================================
// getMonthRange
// =========================================

describe('getMonthRange', () => {
  it('sollte am 1. des Monats beginnen', () => {
    const date = new Date('2026-06-15T12:00:00Z')
    const range = getMonthRange(date)

    const from = new Date(range.from)
    expect(from.getDate()).toBe(1)
  })

  it('sollte am letzten Tag des Monats enden', () => {
    // Juni hat 30 Tage
    const date = new Date('2026-06-15T12:00:00Z')
    const range = getMonthRange(date)

    const to = new Date(range.to)
    expect(to.getDate()).toBe(30) // Juni = 30 Tage
  })

  it('sollte auch für Februar korrekt sein', () => {
    // Februar 2026 (kein Schaltjahr) = 28 Tage
    const date = new Date('2026-02-15T12:00:00Z')
    const range = getMonthRange(date)

    const to = new Date(range.to)
    expect(to.getDate()).toBe(28)
  })

  it('sollte gültige ISO-Strings zurückgeben', () => {
    const range = getMonthRange()
    expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(range.to).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

// =========================================
// calculateTotalPauseMinutes
// =========================================

describe('calculateTotalPauseMinutes', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-13T14:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sollte 0 zurückgeben bei leerer Pausen-Liste', () => {
    expect(calculateTotalPauseMinutes([])).toBe(0)
  })

  it('sollte eine abgeschlossene Pause korrekt berechnen', () => {
    const breaks = [
      {
        start_time: '2026-06-13T12:00:00Z',
        end_time: '2026-06-13T12:30:00Z',
      },
    ]
    expect(calculateTotalPauseMinutes(breaks)).toBe(30)
  })

  it('sollte mehrere Pausen addieren', () => {
    const breaks = [
      {
        start_time: '2026-06-13T10:00:00Z',
        end_time: '2026-06-13T10:15:00Z',
      },
      {
        start_time: '2026-06-13T12:00:00Z',
        end_time: '2026-06-13T12:30:00Z',
      },
    ]
    // 15 + 30 = 45 Minuten
    expect(calculateTotalPauseMinutes(breaks)).toBe(45)
  })

  it('sollte offene Pause bis "jetzt" berechnen', () => {
    // "Jetzt" = 14:00, offene Pause seit 13:30 → 30 Minuten
    const breaks = [
      {
        start_time: '2026-06-13T13:30:00Z',
        end_time: null,
      },
    ]
    expect(calculateTotalPauseMinutes(breaks)).toBe(30)
  })
})
