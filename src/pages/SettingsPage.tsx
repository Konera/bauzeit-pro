// Einstellungen-Seite: Arbeitszeit, Erinnerungen, Push, Vibration, App-Diagnose
import React, { useState, useEffect } from 'react'
import {
  ArrowLeft, Bell, Clock, Smartphone, Save, Globe, Coffee,
  Moon, Volume2, Check, AlertCircle, Navigation, Cpu, ShieldCheck, MapPin
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../i18n/LanguageContext'

import { NotificationPermissionCard } from '../components/NotificationPermissionCard'
import { getPlatformInfo } from '../utils/platform'
import { locationService } from '../services/locationService'
import { hapticsService } from '../services/hapticsService'
import { mobileNotificationService } from '../services/mobileNotificationService'
import type { AppSettings } from '../types/database'
import { workStartReminderService } from '../services/workStartReminderService'
import { backgroundGeofenceService } from '../services/backgroundGeofenceService'
import { NotificationTestCenter } from '../components/NotificationTestCenter'
import { ToggleSwitch } from '../components/ToggleSwitch'

const defaultSettings: AppSettings = {
  maxWorkHours: 8,
  reminderAfterMinutes: 15,
  pushNotifications: true,
  vibration: true,
  language: 'de',
  theme: 'dark',
  // Phase 3: Smart Automation
  maxPauseMinutes: 45,
  pauseWarningBeforeMinutes: 5,
  autoPauseEnd: false,
  workStartReminderEnabled: true,
  workStartTime: '07:00',
  workDays: [1, 2, 3, 4, 5, 6], // Mo-Sa
  // Phase 3B: Geofence & Bewegungserkennung
  backgroundGpsEnabled: true,
  geofenceAutoClockIn: true,
  geofenceAutoClockOut: true,
  geofenceNotifyOnly: true,   // Standard: Nur Notification (sicher)
  motionDetectionEnabled: true,
  autoStopEnabled: true,       // Standard: Auto-Stop aktiviert
}

function getSettings(): AppSettings {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem('bauzeit_settings') || '{}') }
  } catch { return defaultSettings }
}

function saveSettings(settings: AppSettings) {
  // H3 FIX: Parallel in localStorage (synchron) + IndexedDB (persistent)
  localStorage.setItem('bauzeit_settings', JSON.stringify(settings))
  try {
    // Async IndexedDB-Persistenz im Hintergrund
    import('../services/settingsService').then(m => m.saveSettings(settings as never)).catch(() => {})
  } catch {
    // Non-blocking
  }
}

export function SettingsPage() {
  const { user, isAdmin, isAdminOrManager } = useAuth()
  const { t, language, setLanguage, languageNames, availableLanguages } = useTranslation()


  const [settings, setSettings] = useState<AppSettings>(getSettings)
  const [saved, setSaved] = useState(false)
  const [gpsTestResult, setGpsTestResult] = useState<string | null>(null)
  const [gpsTestLoading, setGpsTestLoading] = useState(false)
  const platformInfo = getPlatformInfo()

  const handleSave = () => {
    saveSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value }
      // AUTO-SAVE: Sofort speichern bei jeder Änderung (nicht auf Save-Button warten)
      saveSettings(updated)
      return updated
    })
  }

  const backTo = isAdminOrManager ? '/admin' : '/dashboard'

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-4 safe-top">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Link
            to={backTo}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <img src="/icon-512.png" alt="BauZeit Pro" className="w-9 h-9 rounded-xl shadow-lg" />
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">{t('settings_title')}</h1>
            <p className="text-xs text-slate-500">{user?.profile.full_name}</p>
          </div>
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 py-2.5 px-4 rounded-xl font-medium text-sm transition-all active:scale-95 ${
              saved
                ? 'bg-working text-white'
                : 'bg-construction-500 hover:bg-construction-600 text-white'
            }`}
          >
            {saved ? <Check size={16} /> : <Save size={16} />}
            {saved ? t('settings_saved') : t('settings_save')}
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* Arbeitszeit */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock size={14} />
            {t('settings_work_hours')}
          </h2>
          <div className="card space-y-4">
            <div>
              <label className="label">{t('settings_work_hours')}</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="4"
                  max="14"
                  step="0.5"
                  value={settings.maxWorkHours}
                  onChange={e => updateSetting('maxWorkHours', parseFloat(e.target.value))}
                  className="flex-1 accent-construction-500"
                />
                <span className="text-white font-bold w-12 text-center bg-slate-700 py-1.5 px-2 rounded-lg text-sm">
                  {settings.maxWorkHours}h
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {t('settings_auto_stop_after')} {settings.maxWorkHours} {t('emp_hours')}
              </p>
            </div>

            {/* Auto-Stop Toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-white font-medium text-sm">{t('settings_auto_stop')}</p>
                <p className="text-xs text-slate-500">{t('settings_auto_stop_sub')} {settings.maxWorkHours}h</p>
              </div>
              <ToggleSwitch
                active={settings.autoStopEnabled !== false}
                onToggle={() => updateSetting('autoStopEnabled', !(settings.autoStopEnabled !== false))}
              />
            </div>

            <div>
              <label className="label">{t('settings_reminder')}</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={settings.reminderAfterMinutes}
                  onChange={e => updateSetting('reminderAfterMinutes', parseInt(e.target.value))}
                  className="flex-1 accent-construction-500"
                />
                <span className="text-white font-bold w-12 text-center bg-slate-700 py-1.5 px-2 rounded-lg text-sm">
                  {settings.reminderAfterMinutes}m
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {t('settings_reminder_repeat')} {settings.reminderAfterMinutes} {t('settings_minutes')}
              </p>
            </div>
          </div>
        </section>

        {/* Phase 3: Pausen-Management */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Coffee size={14} />
            {t('pause_max')}
          </h2>
          <div className="card space-y-4">
            <div>
              <label className="label">{t('pause_max')}</label>
              <p className="text-xs text-slate-500 mb-2">{t('pause_max_sub')}</p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="15"
                  max="90"
                  step="5"
                  value={settings.maxPauseMinutes}
                  onChange={e => updateSetting('maxPauseMinutes', parseInt(e.target.value))}
                  className="flex-1 accent-construction-500"
                />
                <span className="text-white font-bold w-14 text-center bg-slate-700 py-1.5 px-2 rounded-lg text-sm">
                  {settings.maxPauseMinutes}m
                </span>
              </div>
            </div>

            <div>
              <label className="label">{t('pause_warning_before')}</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="2"
                  max="15"
                  step="1"
                  value={settings.pauseWarningBeforeMinutes}
                  onChange={e => updateSetting('pauseWarningBeforeMinutes', parseInt(e.target.value))}
                  className="flex-1 accent-construction-500"
                />
                <span className="text-white font-bold w-14 text-center bg-slate-700 py-1.5 px-2 rounded-lg text-sm">
                  {settings.pauseWarningBeforeMinutes}m
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-white font-medium text-sm">{t('pause_auto_end')}</p>
                <p className="text-xs text-slate-500">{t('pause_auto_end_sub')}</p>
              </div>
              <ToggleSwitch
                active={settings.autoPauseEnd}
                onToggle={() => updateSetting('autoPauseEnd', !settings.autoPauseEnd)}
              />
            </div>
          </div>
        </section>

        {/* Phase 3: Arbeitsbeginn-Erinnerung */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertCircle size={14} />
            {t('work_start_reminder')}
          </h2>
          <div className="card space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-white font-medium text-sm">{t('work_start_reminder')}</p>
                <p className="text-xs text-slate-500">{t('work_start_reminder_sub')}</p>
              </div>
              <ToggleSwitch
                active={settings.workStartReminderEnabled}
                onToggle={() => {
                  const newVal = !settings.workStartReminderEnabled
                  updateSetting('workStartReminderEnabled', newVal)
                  // Erinnerungen sofort aktualisieren
                  workStartReminderService.scheduleWorkStartReminders({
                    workStartTime: settings.workStartTime,
                    workDays: settings.workDays,
                    enabled: newVal,
                  }).catch(() => {})
                }}
              />
            </div>

            {settings.workStartReminderEnabled && (
              <>
                <div>
                  <label className="label">{t('work_start_time')}</label>
                  <input
                    type="time"
                    value={settings.workStartTime}
                    onChange={e => {
                      updateSetting('workStartTime', e.target.value)
                      workStartReminderService.scheduleWorkStartReminders({
                        workStartTime: e.target.value,
                        workDays: settings.workDays,
                        enabled: true,
                      }).catch(() => {})
                    }}
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="label">{t('work_start_days')}</label>
                  <div className="grid grid-cols-7 gap-1.5 mt-2">
                    {([
                      { day: 1, key: 'day_mo' as const },
                      { day: 2, key: 'day_tu' as const },
                      { day: 3, key: 'day_we' as const },
                      { day: 4, key: 'day_th' as const },
                      { day: 5, key: 'day_fr' as const },
                      { day: 6, key: 'day_sa' as const },
                      { day: 7, key: 'day_su' as const },
                    ]).map(({ day, key }) => {
                      const isActive = settings.workDays.includes(day)
                      return (
                        <button
                          key={day}
                          onClick={() => {
                            const newDays = isActive
                              ? settings.workDays.filter(d => d !== day)
                              : [...settings.workDays, day].sort()
                            updateSetting('workDays', newDays)
                            workStartReminderService.scheduleWorkStartReminders({
                              workStartTime: settings.workStartTime,
                              workDays: newDays,
                              enabled: true,
                            }).catch(() => {})
                          }}
                          className={`py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                            isActive
                              ? 'bg-construction-500 text-white shadow-lg'
                              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                          }`}
                        >
                          {t(key)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
        {/* Phase 3B: GPS & Automatisierung */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Navigation size={14} />
            {t('gps_section')}
          </h2>
          <div className="card space-y-4">
            {/* Hauptschalter: Hintergrund-GPS */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-white font-medium text-sm">{t('gps_background')}</p>
                <p className="text-xs text-slate-500">{t('gps_background_sub')}</p>
              </div>
              <ToggleSwitch
                active={settings.backgroundGpsEnabled}
                onToggle={() => updateSetting('backgroundGpsEnabled', !settings.backgroundGpsEnabled)}
              />
            </div>

            {settings.backgroundGpsEnabled && (
              <>
                {/* Auto-Einstempeln */}
                <div className="flex items-center justify-between py-2 pl-3 border-l-2 border-construction-500/30">
                  <div>
                    <p className="text-white font-medium text-sm">{t('gps_auto_clock_in')}</p>
                    <p className="text-xs text-slate-500">{t('gps_auto_clock_in_sub')}</p>
                  </div>
                  <ToggleSwitch
                    active={settings.geofenceAutoClockIn}
                    onToggle={() => updateSetting('geofenceAutoClockIn', !settings.geofenceAutoClockIn)}
                  />
                </div>

                {/* Auto-Ausstempeln */}
                <div className="flex items-center justify-between py-2 pl-3 border-l-2 border-construction-500/30">
                  <div>
                    <p className="text-white font-medium text-sm">{t('gps_auto_clock_out')}</p>
                    <p className="text-xs text-slate-500">{t('gps_auto_clock_out_sub')}</p>
                  </div>
                  <ToggleSwitch
                    active={settings.geofenceAutoClockOut}
                    onToggle={() => updateSetting('geofenceAutoClockOut', !settings.geofenceAutoClockOut)}
                  />
                </div>

                {/* Nur Notification */}
                <div className="flex items-center justify-between py-2 pl-3 border-l-2 border-paused/30">
                  <div>
                    <p className="text-white font-medium text-sm">{t('gps_notify_only')}</p>
                    <p className="text-xs text-slate-500">{t('gps_notify_only_sub')}</p>
                  </div>
                  <ToggleSwitch
                    active={settings.geofenceNotifyOnly}
                    onToggle={() => updateSetting('geofenceNotifyOnly', !settings.geofenceNotifyOnly)}
                  />
                </div>

                {/* Losfahrt-Erkennung */}
                <div className="flex items-center justify-between py-2 pl-3 border-l-2 border-construction-500/30">
                  <div>
                    <p className="text-white font-medium text-sm">{t('gps_motion')}</p>
                    <p className="text-xs text-slate-500">{t('gps_motion_sub')}</p>
                  </div>
                  <ToggleSwitch
                    active={settings.motionDetectionEnabled}
                    onToggle={() => updateSetting('motionDetectionEnabled', !settings.motionDetectionEnabled)}
                  />
                </div>

                {/* Modus-Anzeige */}
                <div className="bg-slate-800 rounded-xl p-3 text-xs text-slate-400">
                  <span className="font-semibold text-white">
                    {settings.geofenceNotifyOnly ? '🟡 ' : '🟢 '}
                    {settings.geofenceNotifyOnly ? t('gps_notify_only') : t('settings_full_auto')}
                  </span>
                  <span className="ml-1">
                    – {settings.geofenceNotifyOnly
                      ? t('gps_notify_only_sub')
                      : t('gps_auto_clock_in_sub')}
                  </span>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Benachrichtigungen */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Bell size={14} />
            {t('settings_notifications')}
          </h2>

          <NotificationPermissionCard userId={user?.id} />

          <div className="card mt-3 space-y-4">
            {/* Push Notifications Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium text-sm">{t('settings_push_label')}</p>
                <p className="text-xs text-slate-500">{t('settings_push_sub')}</p>
              </div>
              <ToggleSwitch
                active={settings.pushNotifications}
                onToggle={() => updateSetting('pushNotifications', !settings.pushNotifications)}
              />
            </div>

            {/* Vibration Toggle */}
            {platformInfo.supports.vibration && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium text-sm">{t('settings_vibration_label')}</p>
                  <p className="text-xs text-slate-500">{t('settings_vibration_sub')}</p>
                </div>
                <ToggleSwitch
                  active={settings.vibration}
                  onToggle={() => updateSetting('vibration', !settings.vibration)}
                />
              </div>
            )}

            {/* Phase 3B: Test-Center */}
            <div className="pt-3 border-t border-slate-700">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                {t('notif_test_center')}
              </h3>
              <NotificationTestCenter />
              <div className="mt-2">
                <button
                  onClick={() => hapticsService.vibrateWarning()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs transition-colors active:scale-95"
                >
                  <Smartphone size={13} />
                  {t('settings_vibration_test')}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Sprache */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Globe size={14} />
            {t('settings_language')}
          </h2>
          <div className="card">
            <p className="text-xs text-slate-500 mb-3">{t('settings_language_sub')}</p>
            <div className="grid grid-cols-3 gap-2">
              {availableLanguages.map(lang => (
                <button
                  key={lang}
                  onClick={() => {
                    setLanguage(lang)
                    updateSetting('language', lang)
                  }}
                  className={`p-3 rounded-xl border transition-all text-sm flex flex-col items-center gap-1 ${
                    language === lang
                      ? 'border-construction-500 bg-construction-500/20 text-white'
                      : 'border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  <span className="text-2xl">{lang === 'de' ? '🇩🇪' : lang === 'en' ? '🇬🇧' : '🇷🇺'}</span>
                  <span className="text-xs">{languageNames[lang]}</span>
                  {language === lang && (
                    <Check size={12} className="text-construction-400" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Über die App + Diagnose (Phase 3) */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Cpu size={14} />
            {t('settings_app_info')}
          </h2>
          <div className="card space-y-4">
            {/* App-Modus */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium text-sm">{t('settings_platform')}</p>
                <p className="text-xs text-slate-500">{t('settings_platform')}</p>
              </div>
              <span className="px-3 py-1.5 bg-construction-500/10 text-construction-400 rounded-xl text-xs font-bold">
                {platformInfo.name}
              </span>
            </div>

            {/* Feature-Support */}
            <div className="space-y-2 pt-2 border-t border-slate-700">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Feature-Support</p>
              {([
                { label: 'GPS / Geolocation', supported: platformInfo.supports.geolocation, icon: <Navigation size={14} /> },
                { label: t('settings_push_label'), supported: platformInfo.supports.push, icon: <Bell size={14} /> },
                { label: t('settings_vibration_label'), supported: platformInfo.supports.vibration, icon: <Smartphone size={14} /> },
                { label: t('settings_camera_label'), supported: platformInfo.supports.camera, icon: <Cpu size={14} /> },
              ]).map(feat => (
                <div key={feat.label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-slate-300">
                    {feat.icon}
                    {feat.label}
                  </div>
                  <span className={`text-xs font-medium ${
                    feat.supported ? 'text-working' : 'text-stopped'
                  }`}>
                    {feat.supported ? '✅ ' + t('settings_available') : '❌ ' + t('settings_unavailable')}
                  </span>
                </div>
              ))}
            </div>

            {/* Test-Buttons (Phase 3) */}
            <div className="pt-2 border-t border-slate-700 space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Tests</p>
              <div className="grid grid-cols-2 gap-2">
                {/* GPS Test */}
                <button
                  onClick={async () => {
                    setGpsTestLoading(true)
                    setGpsTestResult(null)
                    const pos = await locationService.getCurrentPosition()
                    if (pos) {
                      setGpsTestResult(`✅ ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)} (±${pos.accuracy.toFixed(0)}m)`)
                    } else {
                      setGpsTestResult('❌ ' + t('settings_gps_fail'))
                    }
                    setGpsTestLoading(false)
                  }}
                  disabled={gpsTestLoading}
                  className="flex items-center justify-center gap-2 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs transition-colors disabled:opacity-50"
                >
                  <MapPin size={14} />
                  {gpsTestLoading ? t('settings_gps_searching') : t('settings_gps_test')}
                </button>

                {/* Notification Test */}
                <button
                  onClick={() => mobileNotificationService.testNotification()}
                  className="flex items-center justify-center gap-2 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs transition-colors"
                >
                  <Bell size={14} />
                  {t('settings_test_notif')}
                </button>

                {/* Vibration Test */}
                <button
                  onClick={() => hapticsService.vibrateSuccess()}
                  className="flex items-center justify-center gap-2 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs transition-colors"
                >
                  <Smartphone size={14} />
                  {t('settings_vibration_test')}
                </button>

                {/* Berechtigungen anfragen */}
                <button
                  onClick={async () => {
                    await locationService.requestLocationPermission()
                    await mobileNotificationService.requestPermission()
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs transition-colors"
                >
                  <ShieldCheck size={14} />
                  {t('settings_notif_permission')}
                </button>
              </div>

              {/* GPS Test-Ergebnis */}
              {gpsTestResult && (
                <p className="text-xs text-slate-400 bg-slate-800 p-2 rounded-lg font-mono">
                  {gpsTestResult}
                </p>
              )}
            </div>

            {/* Version */}
            <div className="pt-2 border-t border-slate-700">
              <p className="text-slate-500 text-sm text-center">
                {t('settings_version')}<br />
                <span className="text-xs">BauZeit Pro</span>
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default SettingsPage
