// PDF-Export-Service – Detaillierter Einzelmitarbeiter-Stundenzettel
// Erzeugt professionelle PDF-Dokumente mit vollständiger Zeiterfassungsübersicht
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { TimeEntry } from '../types/database'
import { formatDateTime, formatMinutes, formatDate, formatTime } from '../utils/timeUtils'

// =========================================
// Status-Übersetzung
// =========================================

/** Übersetzt den englischen Status in deutschen Klartext */
const statusMap: Record<string, string> = {
  open: 'Offen',
  submitted: 'Eingereicht',
  approved: 'Genehmigt',
  corrected: 'Korrigiert',
  rejected: 'Abgelehnt',
}

function translateStatus(status: string): string {
  return statusMap[status] || status
}

// =========================================
// Hauptexport-Funktion
// =========================================

/**
 * Exportiert einen detaillierten Stundenzettel als PDF für einen einzelnen Mitarbeiter.
 * Enthält Header, Zusammenfassung, Detailtabelle und Fußzeile auf jeder Seite.
 */
export function exportEmployeePDF(params: {
  entries: TimeEntry[]
  employeeName: string
  companyName?: string
  dateFrom?: string
  dateTo?: string
}): void {
  const {
    entries,
    employeeName,
    companyName = 'BauZeit Pro',
    dateFrom,
    dateTo,
  } = params

  // PDF-Dokument erstellen (A4 Hochformat)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // =========================================
  // Header-Bereich mit orangenem Balken
  // =========================================
  doc.setFillColor(249, 115, 22) // #F97316 – Orange
  doc.rect(0, 0, pageWidth, 28, 'F')

  // Firmenname links oben
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(companyName, 14, 12)

  // Dokumenttitel unter Firmennamen
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Stundenzettel', 14, 20)

  // Erstellungsdatum rechts oben
  doc.setFontSize(9)
  doc.text(
    `Erstellt am: ${formatDate(new Date().toISOString())}`,
    pageWidth - 14,
    12,
    { align: 'right' }
  )

  // Zeitraum rechts unter Erstellungsdatum
  if (dateFrom && dateTo) {
    doc.text(
      `Zeitraum: ${formatDate(dateFrom)} – ${formatDate(dateTo)}`,
      pageWidth - 14,
      20,
      { align: 'right' }
    )
  }

  // =========================================
  // Zusammenfassungsbereich
  // =========================================
  doc.setTextColor(0, 0, 0)

  // Trennlinie unter Header
  doc.setDrawColor(229, 231, 235) // Grau
  doc.setLineWidth(0.5)
  doc.line(14, 35, pageWidth - 14, 35)

  // Mitarbeitername
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(`Mitarbeiter: ${employeeName}`, 14, 42)

  // Zeitraum unter Mitarbeitername
  if (dateFrom && dateTo) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Zeitraum: ${formatDate(dateFrom)} – ${formatDate(dateTo)}`, 14, 49)
  }

  // Kennzahlen berechnen
  const totalMinutes = entries.reduce((sum, e) => sum + (e.total_minutes || 0), 0)
  const totalHours = (totalMinutes / 60).toFixed(1)
  const approvedCount = entries.filter(e => e.status === 'approved').length

  // Kennzahlen als kompakte Übersicht
  const statsY = dateFrom && dateTo ? 58 : 52
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Übersicht', 14, statsY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const statsDetailY = statsY + 6
  doc.text(`Einträge gesamt: ${entries.length}`, 14, statsDetailY)
  doc.text(`Gesamtstunden: ${formatMinutes(totalMinutes)} h (${totalHours} h)`, 80, statsDetailY)
  doc.text(`Genehmigt: ${approvedCount} von ${entries.length}`, 14, statsDetailY + 6)

  // =========================================
  // Detailtabelle mit allen Feldern
  // =========================================

  // Tabellendaten aus Einträgen aufbauen
  const tableData = entries.map(entry => [
    entry.site?.name || '—',
    formatDate(entry.start_time),
    formatTime(entry.start_time),
    entry.end_time ? formatTime(entry.end_time) : 'Noch aktiv',
    `${entry.pause_minutes} min`,
    formatMinutes(entry.total_minutes),
    translateStatus(entry.status),
    entry.admin_comment || '—',
    entry.approved_by_profile?.full_name || '—',
    entry.approved_at ? formatDateTime(entry.approved_at) : '—',
  ])

  // Tabelle mit autoTable rendern
  const tableStartY = statsDetailY + 14
  autoTable(doc, {
    startY: tableStartY,
    head: [[
      'Baustelle',
      'Datum',
      'Startzeit',
      'Endzeit',
      'Pause',
      'Stunden',
      'Status',
      'Kommentar',
      'Genehmigt von',
      'Datum der\nGenehmigung',
    ]],
    body: tableData,
    headStyles: {
      fillColor: [249, 115, 22],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7,
      cellPadding: 1.5,
    },
    alternateRowStyles: {
      fillColor: [255, 247, 237], // Helles Orange als Wechselfarbe
    },
    columnStyles: {
      0: { cellWidth: 24 },  // Baustelle
      1: { cellWidth: 20 },  // Datum
      2: { cellWidth: 16 },  // Startzeit
      3: { cellWidth: 16 },  // Endzeit
      4: { cellWidth: 13 },  // Pause
      5: { cellWidth: 14 },  // Stunden
      6: { cellWidth: 17 },  // Status
      7: { cellWidth: 28 },  // Kommentar
      8: { cellWidth: 22 },  // Genehmigt von
      9: { cellWidth: 'auto' }, // Datum der Genehmigung
    },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      // Fußzeile auf jeder Seite zeichnen (wird auch unten nochmal gemacht,
      // aber für Seiten die autoTable automatisch anlegt brauchen wir das hier)
    },
  })

  // =========================================
  // Fußzeile auf allen Seiten
  // =========================================
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Seite ${i} von ${pageCount} | BauZeit Pro | Vertraulich`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    )
  }

  // =========================================
  // PDF herunterladen
  // =========================================

  // Dateiname aus Mitarbeitername und Datum zusammensetzen
  const sanitizedName = employeeName
    .replace(/[^a-zA-Z0-9äöüÄÖÜß\- ]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase()
  const dateStamp = new Date().toISOString().split('T')[0]
  const filename = `stundenzettel_${sanitizedName}_${dateStamp}.pdf`

  doc.save(filename)
}
