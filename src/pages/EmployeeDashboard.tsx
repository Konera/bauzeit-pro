// Mitarbeiter-Dashboard: Hauptseite für Zeiterfassung
import React, { useState, useEffect, useMemo } from 'react'
import {
  Play, Pause, Square, RefreshCw, AlertTriangle, Clock,
  MapPin, ChevronRight, Settings, LogOut, Bell
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTimeTracking } from '../hooks/useTimeTracking'
import { ButtonPrimary } from '../components/ButtonPrimary'
import { WorkingStatusBadge } from '../components/StatusBadge'
import { TimeCounter, MiniTimeDisplay } from '../components/TimeCounter'
import { SiteSelector } from '../components/SiteSelector'
import { ConfirmModal } from '../components/ConfirmModal'
import { NotificationPermissionCard } from '../components/NotificationPermissionCard'
import { OfflineStatusBanner } from '../components/OfflineStatusBanner'
import { formatTime, formatMinutes, isOverTimeLimit } from '../utils/timeUtils'
import { Link } from 'react-router-dom'

// Einstellungen aus localStorage laden
function getSettings() {
  try {
    return JSON.parse(localStorage.getItem('bauzeit_settings') || '{}')
  } catch { return {} }
}

export function EmployeeDashboard() {
  const { user, logout } = useAuth()
  const settings = getSettings()

  // BUG-012 Fix: Settings werden via useMemo stabilisiert → verhindert infinite re-renders
  const stableSettings = useMemo(() => ({
    maxWorkHours: settings.maxWorkHours || 8,
    reminderAfterMinutes: settings.reminderAfterMinutes || 15,
  }), [settings.maxWorkHours, settings.reminderAfterMinutes])

  const {
    activeEntry,
    currentBreak,
    status,
    workedSeconds,
    sites,
    selectedSiteId,
    loading,
    error,
    syncing,
    handleStartWork,
    handleStartPause,
    handleEndPause,
    handleStopWork,
    selectSite,
    clearError,
  } = useTimeTracking(user?.id, stableSettings)

  const [showStopConfirm, setShowStopConfirm] = useState(false)
  const [showPermissionCard, setShowPermissionCard] = useState(false)
  const [isOvertime, setIsOvertime] = useState(false)

  // Überstunden prüfen
  useEffect(() => {
    if (activeEntry) {
      const limit = settings.maxWorkHours || 8
      const overtime = isOverTimeLimit(activeEntry.start_time, limit)
      setIsOvertime(overtime)
    } else {
      setIsOvertime(false)
    }
  }, [activeEntry, workedSeconds, settings.maxWorkHours])

  // Benachrichtigungsberechtigung prüfen
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      // Kurz warten dann anzeigen
      const timer = setTimeout(() => setShowPermissionCard(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [])

  const firstName = user?.profile.full_name.split(' ')[0] || 'Mitarbeiter'
  const pauseMinutes = activeEntry ? activeEntry.pause_minutes : 0
  const workedMinutes = Math.floor(workedSeconds / 60)

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 11) return 'Guten Morgen'
    if (hour < 14) return 'Guten Tag'
    if (hour < 17) return 'Guten Nachmittag'
    return 'Guten Abend'
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <OfflineStatusBanner />

      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-4 safe-top">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <p className="text-sm text-slate-400">{greeting()},</p>
            <h1 className="text-lg font-bold text-white">{firstName} 👷</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPermissionCard(!showPermissionCard)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors relative"
              aria-label="Benachrichtigungen"
            >
              <Bell size={20} />
              {showPermissionCard && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-construction-500 rounded-full" />
              )}
            </button>
            <Link
              to="/settings"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              aria-label="Einstellungen"
            >
              <Settings size={20} />
            </Link>
            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-stopped hover:bg-slate-800 rounded-xl transition-colors"
              aria-label="Abmelden"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Hauptinhalt */}
      <main className="flex-1 overflow-y-auto pb-6">
        <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">

          {/* Benachrichtigungs-Karte */}
          {showPermissionCard && (
            <div className="animate-fade-in">
              <NotificationPermissionCard userId={user?.id} />
            </div>
          )}

          {/* Fehler-Banner */}
          {error && (
            <div className="flex items-center justify-between gap-3 p-4 bg-stopped/10 border border-stopped/30 rounded-2xl text-stopped text-sm animate-fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
              <button onClick={clearError} className="text-stopped/60 hover:text-stopped font-bold text-lg">×</button>
            </div>
          )}

          {/* Status-Karte */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <WorkingStatusBadge status={status} size="lg" pulse={status === 'working'} />
              {activeEntry && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Clock size={12} />
                  <span>seit {formatTime(activeEntry.start_time)}</span>
                </div>
              )}
            </div>

            {/* Zeit-Anzeige */}
            {status !== 'not_started' ? (
              <div className="text-center py-4">
                <TimeCounter
                  seconds={workedSeconds}
                  label={status === 'paused' ? 'Pause' : 'Gearbeitet'}
                  variant={status === 'paused' ? 'paused' : isOvertime ? 'working' : 'working'}
                  size="xl"
                />

                {/* Mini-Stats */}
                <div className="flex justify-center gap-8 mt-4 pt-4 border-t border-slate-700">
                  <MiniTimeDisplay
                    minutes={workedMinutes}
                    label="Stunden"
                    color="text-working"
                  />
                  <div className="w-px bg-slate-700" />
                  <MiniTimeDisplay
                    minutes={pauseMinutes}
                    label="Pause"
                    color="text-paused"
                  />
                </div>

                {/* Überstunden-Warnung */}
                {isOvertime && (
                  <div className="mt-4 flex items-center gap-2 justify-center text-stopped text-sm bg-stopped/10 rounded-xl p-3 animate-pulse-slow">
                    <AlertTriangle size={16} />
                    <span>Arbeitszeit überschritten!</span>
                  </div>
                )}

                {/* Baustelle */}
                {activeEntry && (
                  <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-slate-500">
                    <MapPin size={12} />
                    {/* BUG-009 Fix: Fallback wenn site-Daten nicht geladen */}
                    <span>{activeEntry.site?.name || 'Baustelle wird geladen...'}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-20 h-20 mx-auto rounded-full bg-slate-700 flex items-center justify-center mb-3">
                  <Clock size={36} className="text-slate-500" />
                </div>
                <p className="text-slate-400 font-medium">Bereit für die Arbeit</p>
                <p className="text-slate-500 text-sm mt-1">Wähle eine Baustelle und drücke Start</p>
              </div>
            )}
          </div>

          {/* Baustellen-Auswahl */}
          {status === 'not_started' && (
            <div className="animate-fade-in">
              <SiteSelector
                sites={sites}
                selectedSiteId={selectedSiteId}
                onSelect={selectSite}
                disabled={loading}
              />
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="spinner w-8 h-8" />
            </div>
          )}

          {/* Action-Buttons */}
          {!loading && (
            <div className="space-y-3 animate-fade-in">
              {/* NICHT GESTARTET */}
              {status === 'not_started' && (
                <ButtonPrimary
                  id="btn-start-work"
                  variant="start"
                  size="xl"
                  loading={syncing}
                  disabled={!selectedSiteId || sites.length === 0}
                  onClick={handleStartWork}
                  icon={<Play size={28} fill="white" />}
                >
                  Arbeit starten
                </ButtonPrimary>
              )}

              {/* ARBEITET */}
              {status === 'working' && (
                <>
                  <ButtonPrimary
                    id="btn-start-pause"
                    variant="pause"
                    size="xl"
                    loading={syncing}
                    onClick={handleStartPause}
                    icon={<Pause size={28} />}
                  >
                    Pause starten
                  </ButtonPrimary>
                  <ButtonPrimary
                    id="btn-stop-work"
                    variant="stop"
                    size="lg"
                    loading={syncing}
                    onClick={() => setShowStopConfirm(true)}
                    icon={<Square size={24} fill="white" />}
                  >
                    Arbeit beenden
                  </ButtonPrimary>
                </>
              )}

              {/* PAUSE */}
              {status === 'paused' && (
                <>
                  <ButtonPrimary
                    id="btn-end-pause"
                    variant="resume"
                    size="xl"
                    loading={syncing}
                    onClick={handleEndPause}
                    icon={<Play size={28} fill="white" />}
                  >
                    Pause beenden
                  </ButtonPrimary>
                  <ButtonPrimary
                    id="btn-stop-from-pause"
                    variant="stop"
                    size="lg"
                    loading={syncing}
                    onClick={() => setShowStopConfirm(true)}
                    icon={<Square size={24} fill="white" />}
                  >
                    Arbeit beenden
                  </ButtonPrimary>
                </>
              )}
            </div>
          )}

          {/* Heutiger Überblick Link */}
          <Link
            to="/timesheets"
            className="card flex items-center justify-between hover:border-slate-600 transition-colors active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-admin/20 rounded-xl">
                <Clock size={18} className="text-admin" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Meine Stundenzettel</p>
                <p className="text-xs text-slate-500">Tages-, Wochen- und Monatsansicht</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-600" />
          </Link>

        </div>
      </main>

      {/* Stop-Bestätigung */}
      <ConfirmModal
        isOpen={showStopConfirm}
        onClose={() => setShowStopConfirm(false)}
        onConfirm={async () => {
          setShowStopConfirm(false)
          await handleStopWork()
        }}
        title="Arbeit beenden?"
        message={`Du hast ${formatMinutes(workedMinutes)} Stunden gearbeitet. Arbeit wirklich beenden und einreichen?`}
        confirmLabel="✅ Ja, Feierabend!"
        cancelLabel="Weiterarbeiten"
        variant="warning"
        loading={syncing}
      />
    </div>
  )
}

export default EmployeeDashboard
