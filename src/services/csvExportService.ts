// CSV-Export-Service für Admin-Stundenzettel mit allen Phase-2-Feldern
// Erweitert den Basis-CSV-Export um GPS-Warnung, Entfernung und Genehmigungsfelder
// Nutzt non-React Translation-Helper für mehrsprachige CSV-Headers
import Papa from 'papaparse'
import type { TimeEntry } from '../types/database'
import { formatDate, formatTime, formatDateTime } from '../utils/timeUtils'
import { translations } from '../i18n/translations'
import type { Language } from '../i18n/translations'

// =========================================
// Non-React Translation Helper
// =========================================

function getLanguage(): Language {
  try {
    return (localStorage.getItem('bauzeit_language') as Language) || 'de'
  } catch {
    return 'de'
  }
}

function t(key: string): string {
  const lang = getLanguage()
  const dict = translations[lang] || translations.de
  return (dict as Record<string, string>)[key] || (translations.de as Record<string, string>)[key] || key
}

// =========================================
// Status-Übersetzung
// =========================================

function translateStatus(status: string): string {
  const statusKeyMap: Record<string, string> = {
    open: 'entry_open',
    submitted: 'entry_submitted',
    approved: 'entry_approved',
    corrected: 'entry_corrected',
    rejected: 'entry_rejected',
  }
  return t(statusKeyMap[status] || status)
}

// =========================================
// GPS-Koordinaten formatieren
// =========================================

/**
 * Formatiert GPS-Koordinaten als lesbaren String
 */
function formatGPS(lat: number | null, lng: number | null): string {
  if (lat === null || lng === null) return t('settings_unavailable')
  return `${lat}, ${lng}`
}

// =========================================
// CSV-Zeilen aus Einträgen erzeugen
// =========================================

/**
 * Wandelt einen Zeiteintrag in ein Objekt mit übersetzten Spaltenüberschriften um
 */
function mapEntryToRow(entry: TimeEntry): Record<string, string | number> {
  return {
    [t('csv_employee')]: entry.employee?.full_name || '',
    [t('csv_site')]: entry.site?.name || '',
    [t('csv_date')]: formatDate(entry.start_time),
    [t('csv_start_time')]: formatTime(entry.start_time),
    [t('csv_end_time')]: entry.end_time ? formatTime(entry.end_time) : '',
    [t('csv_pause_minutes')]: entry.pause_minutes,
    [t('csv_total_hours')]: (entry.total_minutes / 60).toFixed(2),
    [t('csv_status')]: translateStatus(entry.status),
    [t('csv_gps_start')]: formatGPS(entry.start_lat, entry.start_lng),
    [t('csv_gps_end')]: formatGPS(entry.end_lat, entry.end_lng),
    [t('csv_gps_warning')]: entry.gps_warning ? t('csv_yes') : t('csv_no'),
    [t('csv_distance_start')]: entry.start_distance_m ?? '',
    [t('csv_distance_end')]: entry.end_distance_m ?? '',
    [t('csv_admin_comment')]: entry.admin_comment || '',
    [t('csv_approved_by')]: entry.approved_by_profile?.full_name || '',
    [t('csv_approved_at')]: entry.approved_at ? formatDateTime(entry.approved_at) : '',
    [t('csv_rejection_reason')]: entry.rejected_reason || '',
  }
}

// =========================================
// Dateiname generieren
// =========================================

/**
 * Erzeugt einen standardisierten Dateinamen mit aktuellem Datum
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

  // Alle Einträge in Zeilenobjekte mit übersetzten Spaltenüberschriften umwandeln
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
