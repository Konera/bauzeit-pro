// Stundenzettel-Seite: Tages-, Wochen- und Monatsansicht
import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from '../i18n/LanguageContext'
import {
  Calendar, ChevronLeft, ChevronRight, Clock, ArrowLeft,
  TrendingUp, Coffee, CheckCircle2
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getTimeEntries, getSiteAssignments } from '../services/timeTrackingService'
import { TimeEntryStatusBadge } from '../components/StatusBadge'
import { ExportButton } from '../components/ExportButton'
import type { TimeEntry } from '../types/database'
import {
  formatTime, formatDateTime, formatDate, formatDayName,
  formatMinutes, getWeekRange, getMonthRange
} from '../utils/timeUtils'
import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns'
import { de } from 'date-fns/locale'
import { clsx } from 'clsx'

type ViewMode = 'day' | 'week' | 'month'

export function TimesheetsPage() {
  const { user, isAdmin, isAdminOrManager } = useAuth()
  const { t } = useTranslation()
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)

  const loadEntries = useCallback(async () => {
    if (!user) return
    setLoading(true)

    try {
      let from: string, to: string
      if (viewMode === 'day') {
        from = format(currentDate, 'yyyy-MM-dd') + 'T00:00:00'
        to = format(currentDate, 'yyyy-MM-dd') + 'T23:59:59'
      } else if (viewMode === 'week') {
        const r = getWeekRange(currentDate)
        from = r.from; to = r.to
      } else {
        const r = getMonthRange(currentDate)
        from = r.from; to = r.to
      }

      // BUG-008 Fix: Manager sehen nur ihre Baustellen, Admins sehen alles
      let managerSiteId: string | undefined = undefined
      if (user.profile.role === 'manager') {
        const managedSites = await getSiteAssignments(user.id)
        // Manager sieht Einträge von ALLEN seinen Baustellen
        // Da getTimeEntries nur einen siteId-Filter hat, laden wir alle Baustellen parallel
        if (managedSites.length === 0) {
          setEntries([])
          setLoading(false)
          return
        }
        // Wenn nur 1 Baustelle: direkt filtern. Bei mehreren: alle laden + client-seitig filtern
        if (managedSites.length === 1) {
          managerSiteId = managedSites[0].id
        } else {
          // Mehrere Baustellen: alle separat laden und zusammenführen
          const allEntries = await Promise.all(
            managedSites.map(site => getTimeEntries({ siteId: site.id, from, to }))
          )
          const merged = allEntries.flat().sort(
            (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
          )
          setEntries(merged)
          setLoading(false)
          return
        }
      }

      const data = await getTimeEntries({
        // Mitarbeiter sehen nur eigene Einträge, Admin alle, Manager nach Baustellen gefiltert
        employeeId: isAdminOrManager ? undefined : user.id,
        siteId: managerSiteId,
        from,
        to,
      })
      setEntries(data || [])
    } catch (error) {
      console.error(t('error_load_data'), error)
    } finally {
      setLoading(false)
    }
  }, [user, viewMode, currentDate, isAdminOrManager])

  useEffect(() => { loadEntries() }, [loadEntries])

  // Navigation
  const navigate = (direction: 'prev' | 'next') => {
    setCurrentDate(d => {
      if (viewMode === 'day') return direction === 'prev' ? subDays(d, 1) : addDays(d, 1)
      if (viewMode === 'week') return direction === 'prev' ? subWeeks(d, 1) : addWeeks(d, 1)
      return direction === 'prev' ? subMonths(d, 1) : addMonths(d, 1)
    })
  }

  const navigateToToday = () => setCurrentDate(new Date())

  // Zeitraum-Beschriftung
  const periodLabel = () => {
    if (viewMode === 'day') return formatDayName(format(currentDate, 'yyyy-MM-dd'))
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = endOfWeek(currentDate, { weekStartsOn: 1 })
      return `${format(start, 'dd. MMM', { locale: de })} – ${format(end, 'dd. MMM yyyy', { locale: de })}`
    }
    return format(currentDate, 'MMMM yyyy', { locale: de })
  }

  // Statistiken
  const totalWorkedMinutes = entries.reduce((sum, e) => sum + (e.total_minutes || 0), 0)
  const totalPauseMinutes = entries.reduce((sum, e) => sum + (e.pause_minutes || 0), 0)
  const approvedCount = entries.filter(e => e.status === 'approved').length
  const pendingCount = entries.filter(e => e.status === 'submitted' || e.status === 'open').length

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-4 safe-top">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <Link
            to={isAdminOrManager ? '/admin' : '/dashboard'}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">{t('ts_title')}</h1>
            <p className="text-xs text-slate-500">
              {isAdminOrManager ? 'Alle Mitarbeiter' : user?.profile.full_name}
            </p>
          </div>
          <ExportButton entries={entries} className="flex-shrink-0" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* View-Mode Tabs */}
        <div className="flex gap-1.5 bg-slate-900 p-1 rounded-2xl">
          {(['day', 'week', 'month'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                viewMode === mode
                  ? 'bg-construction-500 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {mode === 'day' ? t('ts_day') : mode === 'week' ? t('ts_week') : t('ts_month')}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('prev')}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex-1 text-center">
            <p className="text-white font-semibold">{periodLabel()}</p>
            <button
              onClick={navigateToToday}
              className="text-xs text-construction-400 hover:text-construction-300 mt-0.5 transition-colors"
            >
              {t('admin_today')}
            </button>
          </div>

          <button
            onClick={() => navigate('next')}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Zusammenfassung */}
        {!loading && entries.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: t('emp_hours'), value: `${formatMinutes(totalWorkedMinutes)}h`, icon: TrendingUp, color: 'text-working' },
              { label: t('emp_pause'), value: `${totalPauseMinutes}min`, icon: Coffee, color: 'text-paused' },
              { label: t('entry_approved'), value: approvedCount, icon: CheckCircle2, color: 'text-working' },
              { label: t('entry_open'), value: pendingCount, icon: Clock, color: 'text-slate-400' },
            ].map(stat => (
              <div key={stat.label} className="card bg-slate-800/50 border-slate-700 p-3 text-center">
                <stat.icon size={16} className={clsx('mx-auto mb-1', stat.color)} />
                <p className={clsx('text-lg font-bold', stat.color)}>{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Einträge */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-800 rounded-2xl animate-pulse" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="card text-center py-16">
            <Calendar size={48} className="mx-auto text-slate-700 mb-3" />
            <p className="text-slate-400 font-medium">{t('ts_no_entries')}</p>
            <p className="text-slate-500 text-sm mt-1">In diesem Zeitraum wurden keine Stunden erfasst</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map(entry => (
              <div key={entry.id} className="card hover:border-slate-600 transition-colors">
                {/* Kopfzeile */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-white">
                      {formatDate(entry.start_time)}
                    </p>
                    {isAdminOrManager && entry.employee && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        👤 {entry.employee.full_name}
                      </p>
                    )}
                    {entry.site && (
                      <p className="text-xs text-slate-400">
                        🏗️ {entry.site.name}
                      </p>
                    )}
                  </div>
                  <TimeEntryStatusBadge status={entry.status} />
                </div>

                {/* Zeit-Details */}
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-700">
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">Start</p>
                    <p className="text-sm font-medium text-white">{formatTime(entry.start_time)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">Ende</p>
                    <p className={clsx(
                      'text-sm font-medium',
                      entry.end_time ? 'text-white' : 'text-paused'
                    )}>
                      {entry.end_time ? formatTime(entry.end_time) : t('admin_active')}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">{t('ts_total_hours')}</p>
                    <p className={clsx(
                      'text-sm font-bold',
                      entry.total_minutes > 480 ? 'text-stopped' : 'text-working'
                    )}>
                      {formatMinutes(entry.total_minutes)}h
                    </p>
                  </div>
                </div>

                {/* Pause */}
                {entry.pause_minutes > 0 && (
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    ⏸️ {entry.pause_minutes} min {t('emp_pause')}
                  </p>
                )}

                {/* Admin-Kommentar */}
                {entry.admin_comment && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <p className="text-xs text-slate-400">
                      💬 <span className="text-slate-300">{entry.admin_comment}</span>
                    </p>
                  </div>
                )}

                {/* Phase 2: Ablehnungsgrund */}
                {entry.rejected_reason && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <p className="text-xs text-stopped">
                      ❌ <span className="text-slate-300">{entry.rejected_reason}</span>
                    </p>
                  </div>
                )}

                {/* Phase 2: Genehmigungs-Info */}
                {entry.approved_by_profile && entry.approved_at && (
                  <div className="mt-2">
                    <p className="text-xs text-slate-500">
                      {entry.status === 'rejected' ? `❌ ${t('entry_rejected')}` : `✅ ${t('entry_approved')}`} von {entry.approved_by_profile.full_name} am {formatDateTime(entry.approved_at)}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default TimesheetsPage
