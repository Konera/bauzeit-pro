// Admin-Dashboard: Live-Übersicht aller Mitarbeiter und Stundenzettel
import React, { useState, useEffect, useCallback } from 'react'
import {
  Users, Building2, Search,
  LogOut, RefreshCw
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { EmployeeLiveCard } from '../components/EmployeeLiveCard'
import { AdminTimeTable } from '../components/AdminTimeTable'
import { ExportButton } from '../components/ExportButton'
import { ConfirmModal } from '../components/ConfirmModal'
import { OfflineStatusBanner } from '../components/OfflineStatusBanner'
import { supabase } from '../lib/supabase'
import { approveTimeEntry, correctTimeEntry, rejectTimeEntry, getTimeEntries, getAllActiveEmployees, getConstructionSites } from '../services/timeTrackingService'
import type { TimeEntry, Profile, ConstructionSite, WorkingStatus } from '../types/database'
import { formatMinutes } from '../utils/timeUtils'
import { differenceInMinutes as dfDiff } from 'date-fns'

interface LiveEmployee {
  employee: Profile
  activeEntry: TimeEntry | null
  status: WorkingStatus
  workedMinutes: number
  isOvertime: boolean
}

type ViewMode = 'live' | 'entries'
type DateFilter = 'today' | 'week' | 'month' | 'all'

export function AdminDashboard() {
  const { user, logout, isAdmin } = useAuth()

  const [liveEmployees, setLiveEmployees] = useState<LiveEmployee[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [sites, setSites] = useState<ConstructionSite[]>([])

  const [viewMode, setViewMode] = useState<ViewMode>('live')
  const [dateFilter, setDateFilter] = useState<DateFilter>('today')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showCorrectModal, setShowCorrectModal] = useState(false)
  const [correctComment, setCorrectComment] = useState('')
  const [correcting, setCorrecting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Phase 2: Reject
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  // =========================================
  // Daten laden
  // =========================================

  const loadData = useCallback(async () => {
    if (!user) return
    setRefreshing(true)

    try {
      const [employees, allSites] = await Promise.all([
        getAllActiveEmployees(),
        getConstructionSites(true),
      ])

      setSites(allSites || [])

      // H6: Alle offenen Einträge + Pausen in EINER Query laden (statt N+1 pro Mitarbeiter)
      const { data: allOpenEntries } = await supabase
        .from('time_entries')
        .select('*, site:construction_sites(*), breaks:break_entries(*)')
        .is('end_time', null)
        .order('start_time', { ascending: false })

      // Map: employee_id → erster offener Eintrag (neuester zuerst durch order)
      const openEntryMap = new Map<string, TimeEntry>()
      for (const entry of (allOpenEntries || []) as TimeEntry[]) {
        if (!openEntryMap.has(entry.employee_id)) {
          openEntryMap.set(entry.employee_id, entry)
        }
      }

      // Live-Status aller Mitarbeiter aus der Map ableiten (0 zusätzliche Queries)
      const liveData = (employees || []).map((emp) => {
        const entry = openEntryMap.get(emp.id) || null

        // Offene Pause aus den bereits geladenen breaks ermitteln
        const openBreak = entry?.breaks?.find(
          (b: { end_time: string | null }) => !b.end_time
        ) || null

        const status: WorkingStatus = !entry
          ? 'not_started'
          : openBreak
          ? 'paused'
          : 'working'

        const workedMinutes = entry
          ? Math.max(0, dfDiff(new Date(), new Date(entry.start_time)) - (entry.pause_minutes || 0))
          : 0

        const isOvertime = status === 'working' && workedMinutes > 8 * 60

        return { employee: emp, activeEntry: entry, status, workedMinutes, isOvertime }
      })

      setLiveEmployees(liveData)

      // Zeiteinträge laden
      const dateRanges: Record<DateFilter, { from?: string; to?: string }> = {
        today: {
          from: new Date().toISOString().split('T')[0] + 'T00:00:00',
          to: new Date().toISOString().split('T')[0] + 'T23:59:59',
        },
        week: (() => {
          const now = new Date()
          const monday = new Date(now)
          // K8 FIX: Am Sonntag (getDay()=0) → 6 Tage zurück statt 1 vorwärts
          const dayOfWeek = now.getDay()
          const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
          monday.setDate(now.getDate() + diff)
          return {
            from: monday.toISOString().split('T')[0] + 'T00:00:00',
            to: now.toISOString().split('T')[0] + 'T23:59:59',
          }
        })(),
        month: {
          from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0] + 'T00:00:00',
          to: new Date().toISOString().split('T')[0] + 'T23:59:59',
        },
        all: {},
      }

      const range = dateRanges[dateFilter]
      const entries = await getTimeEntries({
        ...range,
        siteId: selectedSiteFilter !== 'all' ? selectedSiteFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      })

      setTimeEntries(entries || [])
    } catch (error) {
      console.error('Admin-Daten laden fehlgeschlagen:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user, dateFilter, selectedSiteFilter, statusFilter])

  useEffect(() => {
    loadData()
    // Auto-Refresh alle 30 Sekunden für Live-Daten
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  // Realtime-Subscription für Live-Updates
  useEffect(() => {
    const subscription = supabase
      .channel('admin-live')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'time_entries',
      }, () => loadData())
      .subscribe()

    return () => { subscription.unsubscribe() }
  }, [loadData])

  // =========================================
  // Aktionen
  // =========================================

  const handleApprove = async () => {
    if (!selectedEntry || !user) return
    setCorrecting(true)
    setActionError(null)
    try {
      await approveTimeEntry(selectedEntry.id, user.id, correctComment || undefined)
      await loadData()
      setShowApproveModal(false)
      setCorrectComment('')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Genehmigung fehlgeschlagen')
    } finally {
      setCorrecting(false)
    }
  }

  const handleCorrect = async () => {
    if (!selectedEntry || !user) return
    // Phase 2: Client-seitige Validierung – Kommentar ist Pflicht
    if (!correctComment.trim()) {
      setActionError('Ein Kommentar ist bei Korrekturen Pflicht.')
      return
    }
    setCorrecting(true)
    setActionError(null)
    try {
      await correctTimeEntry(selectedEntry.id, user.id, {
        admin_comment: correctComment,
      })
      await loadData()
      setShowCorrectModal(false)
      setCorrectComment('')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Korrektur fehlgeschlagen')
    } finally {
      setCorrecting(false)
    }
  }

  // Phase 2: Ablehnen
  const handleReject = async () => {
    if (!selectedEntry || !user || !rejectReason.trim()) return
    setCorrecting(true)
    setActionError(null)
    try {
      await rejectTimeEntry(selectedEntry.id, user.id, rejectReason)
      await loadData()
      setShowRejectModal(false)
      setRejectReason('')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ablehnung fehlgeschlagen')
    } finally {
      setCorrecting(false)
    }
  }

  // =========================================
  // Filter
  // =========================================

  const filteredEntries = timeEntries.filter(entry => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      entry.employee?.full_name.toLowerCase().includes(query) ||
      entry.site?.name.toLowerCase().includes(query)
    )
  })

  const filteredLive = liveEmployees.filter(emp => {
    if (!searchQuery) return true
    return emp.employee.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  // =========================================
  // Statistiken
  // =========================================

  const activeCount = liveEmployees.filter(e => e.status === 'working').length
  const pausedCount = liveEmployees.filter(e => e.status === 'paused').length
  const overtimeCount = liveEmployees.filter(e => e.isOvertime).length
  const totalHoursToday = timeEntries.reduce((sum, e) => sum + e.total_minutes, 0)

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <OfflineStatusBanner />

      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-4 safe-top">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <img src="/icon-512.png" alt="BauZeit Pro" className="w-10 h-10 rounded-xl shadow-lg" />
            <div>
              <h1 className="text-lg font-bold text-white">
                {isAdmin ? '⚙️ Admin' : '👷 Bauleiter'}-Dashboard
              </h1>
              <p className="text-xs text-slate-500">{user?.profile.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={refreshing}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              aria-label="Aktualisieren"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
            {isAdmin && (
              <>
                <Link to="/employees" className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors">
                  <Users size={18} />
                </Link>
                <Link to="/sites" className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors">
                  <Building2 size={18} />
                </Link>
              </>
            )}
            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-stopped hover:bg-slate-800 rounded-xl transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-6">
        <div className="max-w-5xl mx-auto px-4 pt-6 space-y-6">

          {/* Statistik-Karten */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Aktiv', value: activeCount, color: 'text-working', bg: 'bg-working/10', icon: '🔨' },
              { label: 'Pause', value: pausedCount, color: 'text-paused', bg: 'bg-paused/10', icon: '⏸️' },
              { label: 'Stop vergessen', value: overtimeCount, color: 'text-stopped', bg: 'bg-stopped/10', icon: '⚠️' },
              { label: 'Stunden heute', value: `${formatMinutes(totalHoursToday)}h`, color: 'text-admin', bg: 'bg-admin/10', icon: '📊' },
            ].map(stat => (
              <div key={stat.label} className={`card ${stat.bg} border-transparent`}>
                <p className="text-2xl mb-1">{stat.icon}</p>
                <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 bg-slate-900 p-1 rounded-2xl">
            <button
              onClick={() => setViewMode('live')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                viewMode === 'live'
                  ? 'bg-construction-500 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🔴 Live-Übersicht
            </button>
            <button
              onClick={() => setViewMode('entries')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                viewMode === 'entries'
                  ? 'bg-construction-500 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📋 Stundenzettel
            </button>
          </div>

          {/* Such- und Filterleiste */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Mitarbeiter oder Baustelle suchen..."
                className="input pl-9"
              />
            </div>

            {viewMode === 'entries' && (
              <>
                <select
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value as DateFilter)}
                  className="input md:w-40"
                >
                  <option value="today">Heute</option>
                  <option value="week">Diese Woche</option>
                  <option value="month">Dieser Monat</option>
                  <option value="all">Alle</option>
                </select>

                <select
                  value={selectedSiteFilter}
                  onChange={e => setSelectedSiteFilter(e.target.value)}
                  className="input md:w-48"
                >
                  <option value="all">Alle Baustellen</option>
                  {sites.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="input md:w-40"
                >
                  <option value="all">Alle Status</option>
                  <option value="open">Offen</option>
                  <option value="submitted">Eingereicht</option>
                  <option value="approved">Genehmigt</option>
                  <option value="corrected">Korrigiert</option>
                  <option value="rejected">Abgelehnt</option>
                </select>

                <ExportButton entries={filteredEntries} />
              </>
            )}
          </div>

          {/* LIVE-ANSICHT */}
          {viewMode === 'live' && (
            <div>
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="h-32 bg-slate-800 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : filteredLive.length === 0 ? (
                <div className="card text-center py-12">
                  <Users size={48} className="mx-auto text-slate-700 mb-3" />
                  <p className="text-slate-400">Keine Mitarbeiter gefunden</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredLive.map(emp => (
                    <EmployeeLiveCard
                      key={emp.employee.id}
                      employee={emp.employee}
                      activeEntry={emp.activeEntry}
                      status={emp.status}
                      workedMinutes={emp.workedMinutes}
                      isOvertime={emp.isOvertime}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STUNDENZETTEL-ANSICHT */}
          {viewMode === 'entries' && (
            <AdminTimeTable
              entries={filteredEntries}
              loading={loading}
              onApprove={(id) => {
                const entry = timeEntries.find(e => e.id === id)
                if (entry) {
                  setSelectedEntry(entry)
                  setShowApproveModal(true)
                }
              }}
              onCorrect={(entry) => {
                setSelectedEntry(entry)
                setCorrectComment(entry.admin_comment || '')
                setShowCorrectModal(true)
              }}
              onReject={(entry) => {
                setSelectedEntry(entry)
                setRejectReason('')
                setShowRejectModal(true)
              }}
            />
          )}
        </div>
      </main>

      {/* Genehmigen Modal */}
      <ConfirmModal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        onConfirm={handleApprove}
        title="Zeiteintrag genehmigen?"
        message={`Zeiteintrag von ${selectedEntry?.employee?.full_name} genehmigen?`}
        confirmLabel="✅ Genehmigen"
        variant="info"
        loading={correcting}
      >
        <div>
          <label className="label">Kommentar (optional)</label>
          <textarea
            value={correctComment}
            onChange={e => setCorrectComment(e.target.value)}
            placeholder="Optionaler Kommentar..."
            className="input resize-none h-20"
          />
        </div>
      </ConfirmModal>

      {/* Korrigieren Modal */}
      <ConfirmModal
        isOpen={showCorrectModal}
        onClose={() => setShowCorrectModal(false)}
        onConfirm={handleCorrect}
        title="Kommentar hinzufügen?"
        message={`Kommentar für Zeiteintrag von ${selectedEntry?.employee?.full_name} speichern?`}
        confirmLabel="💬 Speichern"
        variant="warning"
        loading={correcting}
      >
        <div>
          <label className="label">Admin-Kommentar (Pflicht)</label>
          <textarea
            value={correctComment}
            onChange={e => { setCorrectComment(e.target.value); setActionError(null) }}
            placeholder="Kommentar eingeben..."
            className="input resize-none h-24"
            autoFocus
            required
          />
          {correctComment.trim() === '' && (
            <p className="text-xs text-paused mt-1">Ein Kommentar ist bei Korrekturen Pflicht.</p>
          )}
          {actionError && (
            <p className="text-xs text-stopped mt-2">❌ {actionError}</p>
          )}
        </div>
      </ConfirmModal>

      {/* Ablehnen Modal (Phase 2) */}
      <ConfirmModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleReject}
        title="Zeiteintrag ablehnen?"
        message={`Zeiteintrag von ${selectedEntry?.employee?.full_name} ablehnen?`}
        confirmLabel="❌ Ablehnen"
        variant="danger"
        loading={correcting}
      >
        <div>
          <label className="label">Ablehnungsgrund (Pflicht)</label>
          <textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Grund für die Ablehnung eingeben..."
            className="input resize-none h-24"
            autoFocus
            required
          />
          {rejectReason.trim() === '' && (
            <p className="text-xs text-stopped mt-1">Ein Ablehnungsgrund ist Pflicht.</p>
          )}
        </div>
      </ConfirmModal>
    </div>
  )
}

export default AdminDashboard
