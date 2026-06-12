// AdminTimeTable: Stundenzettel-Tabelle für Admin
import React, { useState } from 'react'
import { Edit2, Check, ChevronDown, ChevronUp, MapPin, Clock } from 'lucide-react'
import { TimeEntryStatusBadge } from './StatusBadge'
import type { TimeEntry } from '../types/database'
import { formatDateTime, formatMinutes, formatDate } from '../utils/timeUtils'
import { clsx } from 'clsx'

interface AdminTimeTableProps {
  entries: TimeEntry[]
  onApprove?: (id: string) => void
  onCorrect?: (entry: TimeEntry) => void
  loading?: boolean
}

export function AdminTimeTable({
  entries,
  onApprove,
  onCorrect,
  loading = false,
}: AdminTimeTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<'start_time' | 'total_minutes'>('start_time')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...entries].sort((a, b) => {
    const aVal = sortKey === 'start_time' ? new Date(a.start_time).getTime() : a.total_minutes
    const bVal = sortKey === 'start_time' ? new Date(b.start_time).getTime() : b.total_minutes
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal
  })

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-slate-700 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="card text-center py-12">
        <Clock size={48} className="mx-auto text-slate-600 mb-3" />
        <p className="text-slate-400 font-medium">Keine Einträge gefunden</p>
        <p className="text-slate-500 text-sm mt-1">Passe die Filter an oder wähle einen anderen Zeitraum</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Desktop Tabellen-Header */}
      <div className="hidden md:grid grid-cols-6 gap-4 px-4 py-2 text-xs text-slate-500 font-medium uppercase tracking-wider">
        <button
          onClick={() => toggleSort('start_time')}
          className="flex items-center gap-1 hover:text-slate-300 text-left"
        >
          Datum {sortKey === 'start_time' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
        </button>
        <span>Mitarbeiter</span>
        <span>Baustelle</span>
        <button
          onClick={() => toggleSort('total_minutes')}
          className="flex items-center gap-1 hover:text-slate-300"
        >
          Stunden {sortKey === 'total_minutes' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
        </button>
        <span>Status</span>
        <span>Aktionen</span>
      </div>

      {/* Einträge */}
      {sorted.map(entry => (
        <div key={entry.id} className="card hover:border-slate-600 transition-colors">
          {/* Hauptzeile */}
          <div
            className="grid md:grid-cols-6 gap-3 md:gap-4 cursor-pointer md:cursor-default"
            onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
          >
            {/* Datum + Zeiten */}
            <div>
              <p className="text-sm font-medium text-white">
                {formatDate(entry.start_time)}
              </p>
              <p className="text-xs text-slate-500">
                {formatDateTime(entry.start_time).split(',')[1]} →{' '}
                {entry.end_time ? formatDateTime(entry.end_time).split(',')[1] : 'Aktiv'}
              </p>
            </div>

            {/* Mitarbeiter */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-admin/20 flex items-center justify-center text-xs font-bold text-admin flex-shrink-0">
                {entry.employee?.full_name?.charAt(0) || '?'}
              </div>
              <span className="text-sm text-white truncate">
                {entry.employee?.full_name || '—'}
              </span>
            </div>

            {/* Baustelle */}
            <div className="flex items-center gap-1.5 text-sm text-slate-300">
              <MapPin size={12} className="text-slate-500 flex-shrink-0" />
              <span className="truncate">{entry.site?.name || '—'}</span>
            </div>

            {/* Stunden */}
            <div>
              <p className={clsx(
                'text-sm font-bold',
                entry.total_minutes > 480 ? 'text-stopped' : 'text-working'
              )}>
                {formatMinutes(entry.total_minutes)} h
              </p>
              <p className="text-xs text-slate-500">{entry.pause_minutes} min Pause</p>
            </div>

            {/* Status */}
            <div className="flex items-center">
              <TimeEntryStatusBadge status={entry.status} />
            </div>

            {/* Aktionen */}
            <div className="flex items-center gap-2">
              {entry.status !== 'approved' && onApprove && (
                <button
                  onClick={(e) => { e.stopPropagation(); onApprove(entry.id) }}
                  className="p-2 bg-working/20 hover:bg-working/40 text-working rounded-lg transition-colors"
                  title="Genehmigen"
                >
                  <Check size={14} />
                </button>
              )}
              {onCorrect && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCorrect(entry) }}
                  className="p-2 bg-admin/20 hover:bg-admin/40 text-admin rounded-lg transition-colors"
                  title="Bearbeiten"
                >
                  <Edit2 size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Erweiterte Details */}
          {expandedId === entry.id && (
            <div className="mt-3 pt-3 border-t border-slate-700 space-y-2 text-sm">
              {entry.admin_comment && (
                <div className="bg-slate-900 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-1">Admin-Kommentar:</p>
                  <p className="text-slate-300">{entry.admin_comment}</p>
                </div>
              )}
              {(entry.start_lat || entry.end_lat) && (
                <div className="flex gap-4 text-xs text-slate-500">
                  {entry.start_lat && (
                    <span>📍 Start: {entry.start_lat.toFixed(4)}, {entry.start_lng?.toFixed(4)}</span>
                  )}
                  {entry.end_lat && (
                    <span>📍 Ende: {entry.end_lat.toFixed(4)}, {entry.end_lng?.toFixed(4)}</span>
                  )}
                </div>
              )}
              {entry.breaks && entry.breaks.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">Pausen:</p>
                  {entry.breaks.map(brk => (
                    <p key={brk.id} className="text-xs text-slate-500">
                      {formatDateTime(brk.start_time)} → {brk.end_time ? formatDateTime(brk.end_time) : 'Aktiv'}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default AdminTimeTable
