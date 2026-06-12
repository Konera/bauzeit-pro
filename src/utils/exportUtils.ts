// Export-Hilfsfunktionen: PDF und CSV für Stundenzettel
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Papa from 'papaparse'
import type { TimeEntry, ExportOptions } from '../types/database'
import { formatDateTime, formatMinutes, formatDate } from './timeUtils'

// =========================================
// PDF-Export
// =========================================

/**
 * Exportiert Stundenzettel als PDF
 */
export function exportToPDF(
  entries: TimeEntry[],
  options: Partial<ExportOptions> & { companyName?: string }
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()

  // Header
  doc.setFillColor(249, 115, 22) // Orange
  doc.rect(0, 0, pageWidth, 25, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('BauZeit Pro', 14, 10)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Stundenzettel', 14, 17)

  // Datum
  doc.text(
    `Erstellt am: ${formatDate(new Date().toISOString())}`,
    pageWidth - 14,
    10,
    { align: 'right' }
  )
  if (options.dateFrom && options.dateTo) {
    doc.text(
      `Zeitraum: ${formatDate(options.dateFrom)} – ${formatDate(options.dateTo)}`,
      pageWidth - 14,
      17,
      { align: 'right' }
    )
  }

  doc.setTextColor(0, 0, 0)

  // Zusammenfassung
  const totalMinutes = entries.reduce((sum, e) => sum + (e.total_minutes || 0), 0)
  const approvedCount = entries.filter(e => e.status === 'approved').length

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Übersicht', 14, 35)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Einträge gesamt: ${entries.length}`, 14, 42)
  doc.text(`Genehmigt: ${approvedCount}`, 14, 48)
  doc.text(`Gesamtstunden: ${formatMinutes(totalMinutes)} h`, 14, 54)

  // Tabelle
  const tableData = entries.map(entry => [
    entry.employee?.full_name || '—',
    entry.site?.name || '—',
    formatDateTime(entry.start_time),
    entry.end_time ? formatDateTime(entry.end_time) : 'Noch aktiv',
    `${entry.pause_minutes} min`,
    formatMinutes(entry.total_minutes),
    translateStatus(entry.status),
    entry.admin_comment || '',
  ])

  autoTable(doc, {
    startY: 62,
    head: [[
      'Mitarbeiter',
      'Baustelle',
      'Start',
      'Ende',
      'Pause',
      'Stunden',
      'Status',
      'Kommentar',
    ]],
    body: tableData,
    headStyles: {
      fillColor: [249, 115, 22],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 30 },
      2: { cellWidth: 30 },
      3: { cellWidth: 30 },
      4: { cellWidth: 15 },
      5: { cellWidth: 15 },
      6: { cellWidth: 20 },
      7: { cellWidth: 'auto' },
    },
    margin: { left: 14, right: 14 },
  })

  // Footer
  // BUG-007 Fix: Direkter Methodenaufruf statt fragiler TypeScript-Cast
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Seite ${i} von ${pageCount} | BauZeit Pro | Vertraulich`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 5,
      { align: 'center' }
    )
  }

  // Datei speichern
  const filename = `stundenzettel_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}

// =========================================
// CSV-Export
// =========================================

/**
 * Exportiert Stundenzettel als CSV
 */
export function exportToCSV(entries: TimeEntry[]): void {
  const csvData = entries.map(entry => ({
    Mitarbeiter: entry.employee?.full_name || '',
    Baustelle: entry.site?.name || '',
    Datum: formatDate(entry.start_time),
    Startzeit: formatDateTime(entry.start_time),
    Endzeit: entry.end_time ? formatDateTime(entry.end_time) : '',
    'Pause (min)': entry.pause_minutes,
    'Gesamt (h)': (entry.total_minutes / 60).toFixed(2),
    'Gesamt (min)': entry.total_minutes,
    Status: translateStatus(entry.status),
    GPS_Start_Lat: entry.start_lat || '',
    GPS_Start_Lng: entry.start_lng || '',
    GPS_Ende_Lat: entry.end_lat || '',
    GPS_Ende_Lng: entry.end_lng || '',
    Quelle: entry.source,
    Kommentar: entry.admin_comment || '',
    Erstellt: formatDateTime(entry.created_at),
    Aktualisiert: formatDateTime(entry.updated_at),
  }))

  const csv = Papa.unparse(csvData, {
    delimiter: ';', // Für Excel in Deutschland
    header: true,
  })

  // BOM für korrekte Umlaute in Excel
  const bom = '\uFEFF'
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `stundenzettel_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// =========================================
// Hilfsfunktionen
// =========================================

function translateStatus(status: string): string {
  const map: Record<string, string> = {
    open: 'Offen',
    submitted: 'Eingereicht',
    approved: 'Genehmigt',
    corrected: 'Korrigiert',
  }
  return map[status] || status
}
