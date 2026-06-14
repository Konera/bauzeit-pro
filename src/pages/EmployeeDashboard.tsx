// Mitarbeiter-Dashboard: Hauptseite für Zeiterfassung
import React, { useState, useEffect, useMemo } from 'react'
import {
  Play, Pause, Square, RefreshCw, AlertTriangle, Clock,
  MapPin, ChevronRight, Settings, LogOut, Bell, Navigation, Wifi
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTimeTracking } from '../hooks/useTimeTracking'
import { useTranslation } from '../i18n/LanguageContext'
import { ButtonPrimary } from '../components/ButtonPrimary'
import { WorkingStatusBadge } from '../components/StatusBadge'
import { TimeCounter, MiniTimeDisplay } from '../components/TimeCounter'
import { SiteSelector } from '../components/SiteSelector'
import { ConfirmModal } from '../components/ConfirmModal'
import { NotificationPermissionCard } from '../components/NotificationPermissionCard'
import { OfflineStatusBanner } from '../components/OfflineStatusBanner'
import { formatTime, formatMinutes, isOverTimeLimit } from '../utils/timeUtils'
import { pauseTimerService } from '../services/pauseTimerService'
import { autoClockService } from '../services/autoClockService'
import { GpsInfoCard } from '../components/GpsInfoCard'
import { isNativeApp, isAndroid, isIOS, isPWA } from '../utils/platform'
import { Link } from 'react-router-dom'

// Einstellungen aus localStorage laden
function getSettings() {
  try {
    return JSON.parse(localStorage.getItem('bauzeit_settings') || '{}')
  } catch { return {} }
}

export function EmployeeDashboard() {
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const settings = getSettings()

  // BUG-012 Fix: Settings werden via useMemo stabilisiert → verhindert infinite re-renders
  const stableSettings = useMemo(() => ({
    maxWorkHours: settings.maxWorkHours || 8,
    reminderAfterMinutes: settings.reminderAfterMinutes || 15,
    maxPauseMinutes: settings.maxPauseMinutes || 45,
    pauseWarningBeforeMinutes: settings.pauseWarningBeforeMinutes || 5,
    autoPauseEnd: settings.autoPauseEnd || false,
  }), [settings.maxWorkHours, settings.reminderAfterMinutes, settings.maxPauseMinutes, settings.pauseWarningBeforeMinutes, settings.autoPauseEnd])

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
    gpsStatus,
    gpsWarning,
    handleStartWork,
    handleStartPause,
    handleEndPause,
    handleStopWork,
    selectSite,
    clearError,
  } = useTimeTracking(user?.id, stableSettings)

  const [showStopConfirm, setShowStopConfirm] = useState(false)
  const [showPermissionCard, setShowPermissionCard] = useState(false)
  const [pauseRemaining, setPauseRemaining] = useState<number | null>(null)

  // Phase 3: Pausen-Countdown Timer
  useEffect(() => {
    if (status !== 'paused' || !currentBreak) {
      setPauseRemaining(null)
      return
    }
    const updatePauseCountdown = () => {
      const remaining = pauseTimerService.getPauseRemainingSeconds(
        currentBreak.start_time,
        stableSettings.maxPauseMinutes
      )
      setPauseRemaining(remaining)
    }
    updatePauseCountdown()
    const interval = setInterval(updatePauseCountdown, 1000)
    return () => clearInterval(interval)
  }, [status, currentBreak, stableSettings.maxPauseMinutes])
  const [isOvertime, setIsOvertime] = useState(false)
  const autoStopTriggeredRef = React.useRef(false)

  // Überstunden prüfen + Auto-Stop
  useEffect(() => {
    if (activeEntry) {
      const limit = settings.maxWorkHours || 10
      const overtime = isOverTimeLimit(activeEntry.start_time, limit)
      setIsOvertime(overtime)

      // Auto-Stop: Wenn Überstunden UND Auto-Stop aktiviert → automatisch beenden
      // Sicherheitsgrenze: Maximal 12 Stunden, danach IMMER stoppen
      const hardLimit = 12
      const isHardOvertime = isOverTimeLimit(activeEntry.start_time, hardLimit)
      const autoStopEnabled = settings.autoStopEnabled !== false // Standard: aktiviert

      if ((overtime && autoStopEnabled) || isHardOvertime) {
        if (!autoStopTriggeredRef.current) {
          autoStopTriggeredRef.current = true
          console.warn('[AutoStop] Arbeitszeit überschritten, automatischer Stop', {
            limit, hardLimit, isHardOvertime, autoStopEnabled
          })
          handleStopWork()
        }
      }
    } else {
      setIsOvertime(false)
      autoStopTriggeredRef.current = false
    }
  }, [activeEntry, workedSeconds, settings.maxWorkHours, settings.autoStopEnabled, handleStopWork])

  // Benachrichtigungsberechtigung prüfen (nur Web, native hat eigenen Dialog)
  useEffect(() => {
    if (!isNativeApp() && 'Notification' in window && Notification.permission === 'default') {
      // Kurz warten dann anzeigen
      const timer = setTimeout(() => setShowPermissionCard(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [])

  // Phase 3B: Auto-Clock Service initialisieren
  useEffect(() => {
    if (!user?.id || !sites || sites.length === 0) return
    if (!settings.backgroundGpsEnabled) return

    autoClockService.setAutoClockHandlers(
      async (siteId: string) => {
        // Auto-einstempeln über den Hook
        selectSite(siteId)
        await handleStartWork()
      },
      async () => {
        await handleStopWork()
      }
    )
    autoClockService.initialize(sites)

    return () => { autoClockService.stop() }
  }, [user?.id, sites, settings.backgroundGpsEnabled])

  const firstName = user?.profile.full_name.split(' ')[0] || 'Mitarbeiter'
  const pauseMinutes = activeEntry ? activeEntry.pause_minutes : 0
  const workedMinutes = Math.floor(workedSeconds / 60)

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return t('greeting_morning')
    if (hour < 17) return t('greeting_afternoon')
    return t('greeting_evening')
  }

  const getTranslatedPlatformName = () => {
    if (isAndroid()) return t('platform_android')
    if (isIOS()) return t('platform_ios')
    if (isPWA()) return t('platform_pwa')
    return t('platform_web')
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <OfflineStatusBanner />

      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-4 safe-top">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <img src="/icon-512.png" alt="BauZeit Pro" className="w-10 h-10 rounded-xl shadow-lg" />
            <div>
              <p className="text-sm text-slate-400">{greeting()},</p>
              <h1 className="text-lg font-bold text-white">{firstName} 👷</h1>
            </div>
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

          {/* Phase 3: App-Modus + GPS + Notification + Reminder Status-Indikatoren */}
          <div className="flex flex-wrap gap-2">
            {/* App-Modus */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-construction-500/10 text-construction-400">
              <Wifi size={12} />
              {getTranslatedPlatformName()}
            </div>
            {/* GPS */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium ${
              gpsStatus === 'available' ? 'bg-working/10 text-working' :
              gpsStatus === 'denied' ? 'bg-stopped/10 text-stopped' :
              'bg-slate-800 text-slate-500'
            }`}>
              <Navigation size={12} />
              {gpsStatus === 'available' ? t('gps_active') :
               gpsStatus === 'denied' ? t('gps_blocked') :
               gpsStatus === 'unavailable' ? t('gps_unavailable') :
               t('gps_checking')}
            </div>
            {/* Notifications */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium ${
              isNativeApp() || ('Notification' in window && Notification.permission === 'granted')
                ? 'bg-working/10 text-working'
                : 'bg-slate-800 text-slate-500'
            }`}>
              <Bell size={12} />
              {isNativeApp() || ('Notification' in window && Notification.permission === 'granted')
                ? t('notif_active')
                : t('notif_off')}
            </div>
            {/* Reminder aktiv/inaktiv */}
            {activeEntry && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-paused/10 text-paused">
                <Clock size={12} />
                {t('notif_reminder')}
              </div>
            )}
          </div>

          {/* Phase 2: GPS-Warnung */}
          {gpsWarning && (
            <div className="flex items-center gap-2 p-3 bg-paused/10 border border-paused/30 rounded-2xl text-paused text-sm animate-fade-in">
              <Navigation size={16} className="flex-shrink-0" />
              <span>{gpsWarning}</span>
            </div>
          )}

          {/* Phase 3B: GPS-Info-Karte */}
          <GpsInfoCard isActive={settings.backgroundGpsEnabled} />

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
                  <span>{t('emp_since')} {formatTime(activeEntry.start_time)}</span>
                </div>
              )}
            </div>

            {/* Zeit-Anzeige */}
            {status !== 'not_started' ? (
              <div className="text-center py-4">
                <TimeCounter
                  seconds={workedSeconds}
                  label={status === 'paused' ? t('emp_pause') : t('emp_worked')}
                  variant={status === 'paused' ? 'paused' : isOvertime ? 'working' : 'working'}
                  size="xl"
                />

                {/* Mini-Stats */}
                <div className="flex justify-center gap-8 mt-4 pt-4 border-t border-slate-700">
                  <MiniTimeDisplay
                    minutes={workedMinutes}
                    label={t('emp_hours')}
                    color="text-working"
                  />
                  <div className="w-px bg-slate-700" />
                  <MiniTimeDisplay
                    minutes={pauseMinutes}
                    label={t('emp_pause')}
                    color="text-paused"
                  />
                </div>

                {/* Überstunden-Warnung */}
                {isOvertime && (
                  <div className="mt-4 flex items-center gap-2 justify-center text-stopped text-sm bg-stopped/10 rounded-xl p-3 animate-pulse-slow">
                    <AlertTriangle size={16} />
                    <span>{t('emp_overtime')}</span>
                  </div>
                )}

                {/* Phase 3: Pausen-Countdown */}
                {status === 'paused' && pauseRemaining !== null && (
                  <div className={`mt-4 flex items-center gap-2 justify-center text-sm rounded-xl p-3 ${
                    pauseRemaining <= 0
                      ? 'bg-stopped/15 text-stopped animate-pulse-slow'
                      : pauseRemaining <= stableSettings.pauseWarningBeforeMinutes * 60
                        ? 'bg-construction-500/15 text-construction-400'
                        : 'bg-paused/10 text-paused'
                  }`}>
                    {pauseRemaining <= 0 ? (
                      <>
                        <AlertTriangle size={16} />
                        <span className="font-bold">{t('pause_expired')}</span>
                      </>
                    ) : (
                      <>
                        <Clock size={16} />
                        <span>
                          ⏸️ {t('pause_remaining').replace('{min}', String(Math.ceil(pauseRemaining / 60)))}
                        </span>
                      </>
                    )}
                  </div>
                )}

                {/* Baustelle */}
                {activeEntry && (
                  <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-slate-500">
                    <MapPin size={12} />
                    {/* BUG-009 Fix: Fallback wenn site-Daten nicht geladen */}
                    <span>{activeEntry.site?.name || t('emp_site_loading')}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-20 h-20 mx-auto rounded-full bg-slate-700 flex items-center justify-center mb-3">
                  <Clock size={36} className="text-slate-500" />
                </div>
                <p className="text-slate-400 font-medium">{t('emp_ready')}</p>
                <p className="text-slate-500 text-sm mt-1">{t('emp_choose_site')}</p>
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
                  {t('emp_start')}
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
                    {t('emp_pause_start')}
                  </ButtonPrimary>
                  <ButtonPrimary
                    id="btn-stop-work"
                    variant="stop"
                    size="lg"
                    loading={syncing}
                    onClick={() => setShowStopConfirm(true)}
                    icon={<Square size={24} fill="white" />}
                  >
                    {t('emp_stop')}
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
                    {t('emp_pause_end')}
                  </ButtonPrimary>
                  <ButtonPrimary
                    id="btn-stop-from-pause"
                    variant="stop"
                    size="lg"
                    loading={syncing}
                    onClick={() => setShowStopConfirm(true)}
                    icon={<Square size={24} fill="white" />}
                  >
                    {t('emp_stop')}
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
                <p className="text-sm font-medium text-white">{t('emp_timesheets')}</p>
                <p className="text-xs text-slate-500">{t('emp_timesheets_sub')}</p>
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
        title={t('emp_stop_confirm_title')}
        message={t('emp_stop_confirm_msg')}
        confirmLabel={t('emp_stop_confirm_yes')}
        cancelLabel={t('emp_stop_confirm_no')}
        variant="warning"
        loading={syncing}
      />
    </div>
  )
}

export default EmployeeDashboard
