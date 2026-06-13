// ExportButton: PDF und CSV Export
import React, { useState } from 'react'
import { Download, FileText, Table, ChevronDown, UserCheck } from 'lucide-react'
import { clsx } from 'clsx'
import type { TimeEntry, ExportOptions } from '../types/database'
import { exportToPDF, exportToCSV } from '../utils/exportUtils'
import { exportAdminCSV } from '../services/csvExportService'
import { exportEmployeePDF } from '../services/pdfExportService'

interface ExportButtonProps {
  entries: TimeEntry[]
  options?: Partial<ExportOptions>
  className?: string
}

export function ExportButton({ entries, options, className }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState<'pdf' | 'csv' | null>(null)
  // BUG-014 Fix: Fehler dem Nutzer anzeigen
  const [exportError, setExportError] = useState<string | null>(null)

  const handleExport = async (format: 'pdf' | 'csv') => {
    setLoading(format)
    setIsOpen(false)
    setExportError(null)

    // Kleiner Delay für UX
    await new Promise(r => setTimeout(r, 100))

    try {
      if (format === 'pdf') {
        await exportToPDF(entries, options || {})
      } else {
        await exportToCSV(entries)
      }
    } catch (error) {
      console.error('Export fehlgeschlagen:', error)
      // BUG-014 Fix: Nutzer informieren
      setExportError(format === 'pdf' ? 'PDF-Export fehlgeschlagen' : 'CSV-Export fehlgeschlagen')
      setTimeout(() => setExportError(null), 4000)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className={clsx('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={entries.length === 0 || loading !== null}
        className={clsx(
          'flex items-center gap-2 py-2.5 px-4 rounded-xl font-medium text-sm',
          exportError
            ? 'bg-stopped/20 hover:bg-stopped/30 text-stopped border border-stopped/30'
            : 'bg-admin/20 hover:bg-admin/30 text-admin border border-admin/30',
          'transition-all duration-150 active:scale-95',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {loading ? (
          <div className="w-4 h-4 spinner" />
        ) : (
          <Download size={16} />
        )}
        {exportError
          ? exportError
          : loading === 'pdf' ? 'PDF...' : loading === 'csv' ? 'CSV...' : 'Exportieren'}
        {!loading && !exportError && <ChevronDown size={14} className={clsx('transition-transform', isOpen && 'rotate-180')} />}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-20 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden min-w-[200px]">
            <button
              onClick={() => handleExport('pdf')}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 transition-colors text-left"
            >
              <FileText size={16} className="text-stopped" />
              <div>
                <p className="font-medium">PDF exportieren</p>
                <p className="text-xs text-slate-500">{entries.length} Einträge</p>
              </div>
            </button>
            <div className="border-t border-slate-700" />
            <button
              onClick={() => {
                setIsOpen(false)
                setLoading('pdf')
                try {
                  // Phase 2: Detailliertes Einzel-PDF mit allen Feldern
                  const employeeNames = [...new Set(entries.map(e => e.employee?.full_name).filter(Boolean))]
                  exportEmployeePDF({
                    entries,
                    employeeName: employeeNames.length === 1 ? employeeNames[0]! : 'Alle Mitarbeiter',
                  })
                } catch (error) {
                  console.error('Detaillierter PDF-Export fehlgeschlagen:', error)
                  setExportError('PDF-Export fehlgeschlagen')
                  setTimeout(() => setExportError(null), 4000)
                } finally {
                  setLoading(null)
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 transition-colors text-left"
            >
              <UserCheck size={16} className="text-admin" />
              <div>
                <p className="font-medium">Detailliertes PDF</p>
                <p className="text-xs text-slate-500">Mit Genehmigungs-Info</p>
              </div>
            </button>
            <div className="border-t border-slate-700" />
            <button
              onClick={() => {
                setIsOpen(false)
                setLoading('csv')
                try {
                  // Phase 2: Erweiterter CSV mit GPS + Genehmigungs-Feldern
                  exportAdminCSV(entries)
                } catch (error) {
                  console.error('CSV-Export fehlgeschlagen:', error)
                  setExportError('CSV-Export fehlgeschlagen')
                  setTimeout(() => setExportError(null), 4000)
                } finally {
                  setLoading(null)
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 transition-colors text-left"
            >
              <Table size={16} className="text-working" />
              <div>
                <p className="font-medium">CSV für Excel</p>
                <p className="text-xs text-slate-500">Alle Felder inkl. GPS</p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default ExportButton
