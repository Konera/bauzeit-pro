// CSV-Export-Service für Admin-Stundenzettel mit allen Phase-2-Feldern
// Erweitert den Basis-CSV-Export um GPS-Warnung, Entfernung und Genehmigungsfelder
import Papa from 'papaparse'
import type { TimeEntry } from '../types/database'
import { formatDate, formatTime, formatDateTime } from '../utils/timeUtils'

// =========================================
// Status-Übersetzung (Deutsch)
// =========================================

const statusMap: Record<string, string> = {
  open: 'Offen',
  submitted: 'Eingereicht',
  approved: 'Genehmigt',
  corrected: 'Korrigiert',
  rejected: 'Abgelehnt',
}

/**
 * Übersetzt den internen Status-Schlüssel ins Deutsche
 */
function translateStatus(status: string): string {
  return statusMap[status] || status
}

// =========================================
// GPS-Koordinaten formatieren
// =========================================

/**
 * Formatiert GPS-Koordinaten als lesbaren String
 * Gibt 'Nicht verfügbar' zurück wenn keine Daten vorhanden
 */
function formatGPS(lat: number | null, lng: number | null): string {
  if (lat === null || lng === null) return 'Nicht verfügbar'
  return `${lat}, ${lng}`
}

// =========================================
// CSV-Zeilen aus Einträgen erzeugen
// =========================================

/**
 * Wandelt einen Zeiteintrag in ein Objekt mit deutschen Spaltenüberschriften um
 */
function mapEntryToRow(entry: TimeEntry): Record<string, string | number> {
  return {
    'Mitarbeiter': entry.employee?.full_name || '',
    'Baustelle': entry.site?.name || '',
    'Datum': formatDate(entry.start_time),
    'Startzeit': formatTime(entry.start_time),
    'Endzeit': entry.end_time ? formatTime(entry.end_time) : '',
    'Pause (Minuten)': entry.pause_minutes,
    'Gesamtstunden': (entry.total_minutes / 60).toFixed(2),
    'Status': translateStatus(entry.status),
    'GPS Start': formatGPS(entry.start_lat, entry.start_lng),
    'GPS Ende': formatGPS(entry.end_lat, entry.end_lng),
    'GPS Warnung': entry.gps_warning ? 'Ja' : 'Nein',
    'Entfernung Start (m)': entry.start_distance_m ?? '',
    'Entfernung Ende (m)': entry.end_distance_m ?? '',
    'Admin Kommentar': entry.admin_comment || '',
    'Genehmigt von': entry.approved_by_profile?.full_name || '',
    'Genehmigt am': entry.approved_at ? formatDateTime(entry.approved_at) : '',
    'Ablehnungsgrund': entry.rejected_reason || '',
  }
}

// =========================================
// Dateiname generieren
// =========================================

/**
 * Erzeugt einen standardisierten Dateinamen mit aktuellem Datum
 * Format: stundenzettel_export_2024-01-15.csv
 */
function generateFilename(): string {
  const today = new Date().toISOString().split('T')[0]
  return `stundenzettel_export_${today}.csv`
}

// =========================================
// Download über Blob + Link auslösen
// =========================================

/**
 * Erstellt einen Blob mit BOM-Header und löst den Download im Browser aus
 * BOM (Byte Order Mark) sorgt für korrekte Umlaut-Darstellung in Excel
 */
function triggerDownload(csvContent: string, filename: string): void {
  const bom = '\uFEFF'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()

  // Aufräumen: Link entfernen und Objekt-URL freigeben
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// =========================================
// Haupt-Exportfunktion
// =========================================

/**
 * Exportiert Zeiteinträge als CSV-Datei mit allen Admin-/Phase-2-Feldern.
 *
 * Enthält GPS-Warnung, Entfernungen, Genehmigungsinformationen und
 * Ablehnungsgrund. Verwendet Semikolon als Trennzeichen für deutsche
 * Excel-Kompatibilität.
 *
 * @param entries - Array von Zeiteinträgen (mit geladenen Joins)
 * @param filename - Optionaler Dateiname, Standard: stundenzettel_export_YYYY-MM-DD.csv
 */
export function exportAdminCSV(entries: TimeEntry[], filename?: string): void {
  if (entries.length === 0) {
    console.warn('CSV-Export: Keine Einträge zum Exportieren vorhanden')
    return
  }

  // Alle Einträge in Zeilenobjekte mit deutschen Spaltenüberschriften umwandeln
  const rows = entries.map(mapEntryToRow)

  // CSV mit Semikolon-Trennzeichen für deutsches Excel erzeugen
  const csvContent = Papa.unparse(rows, {
    delimiter: ';',
    header: true,
  })

  // Download mit BOM für korrekte Umlaute auslösen
  const outputFilename = filename || generateFilename()
  triggerDownload(csvContent, outputFilename)
}
