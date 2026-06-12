// Einstellungen-Seite: Arbeitszeit, Erinnerungen, Push, Vibration
import React, { useState, useEffect } from 'react'
import {
  ArrowLeft, Bell, Clock, Smartphone, Save, Globe,
  Moon, Volume2, Check, AlertCircle
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { NotificationPermissionCard } from '../components/NotificationPermissionCard'
import type { AppSettings } from '../types/database'

const defaultSettings: AppSettings = {
  maxWorkHours: 8,
  reminderAfterMinutes: 15,
  pushNotifications: true,
  vibration: true,
  language: 'de',
  theme: 'dark',
}

function getSettings(): AppSettings {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem('bauzeit_settings') || '{}') }
  } catch { return defaultSettings }
}

function saveSettings(settings: AppSettings) {
  localStorage.setItem('bauzeit_settings', JSON.stringify(settings))
}

export function SettingsPage() {
  const { user, isAdmin, isAdminOrManager } = useAuth()
  const { testVibration, testNotification, supportsVibration } = useNotifications(user?.id)

  const [settings, setSettings] = useState<AppSettings>(getSettings)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    saveSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
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
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">Einstellungen</h1>
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
            {saved ? 'Gespeichert!' : 'Speichern'}
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* Arbeitszeit */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock size={14} />
            Arbeitszeit
          </h2>
          <div className="card space-y-4">
            <div>
              <label className="label">Maximale Arbeitszeit (Stunden)</label>
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
                Warnung erscheint nach {settings.maxWorkHours} Stunden Arbeitszeit
              </p>
            </div>

            <div>
              <label className="label">Erinnerungsintervall (Minuten)</label>
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
                Erinnerung wird alle {settings.reminderAfterMinutes} Minuten wiederholt
              </p>
            </div>
          </div>
        </section>

        {/* Benachrichtigungen */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Bell size={14} />
            Benachrichtigungen
          </h2>

          <NotificationPermissionCard userId={user?.id} />

          <div className="card mt-3 space-y-4">
            {/* Push Notifications Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium text-sm">Push-Benachrichtigungen</p>
                <p className="text-xs text-slate-500">Erinnerungen wenn du vergisst auszustempeln</p>
              </div>
              <button
                onClick={() => updateSetting('pushNotifications', !settings.pushNotifications)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.pushNotifications ? 'bg-construction-500' : 'bg-slate-600'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  settings.pushNotifications ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Vibration Toggle */}
            {supportsVibration && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium text-sm">Vibration</p>
                  <p className="text-xs text-slate-500">Haptic Feedback bei Aktionen</p>
                </div>
                <button
                  onClick={() => updateSetting('vibration', !settings.vibration)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    settings.vibration ? 'bg-construction-500' : 'bg-slate-600'
                  }`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings.vibration ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            )}

            {/* Test-Buttons */}
            <div className="pt-2 border-t border-slate-700 flex gap-2">
              <button
                onClick={testNotification}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm transition-colors"
              >
                <Bell size={14} />
                Notification testen
              </button>
              {supportsVibration && (
                <button
                  onClick={testVibration}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm transition-colors"
                >
                  <Smartphone size={14} />
                  Vibration testen
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Sprache */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Globe size={14} />
            Sprache
          </h2>
          <div className="card">
            <div className="grid grid-cols-3 gap-2">
              {([
                { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
                { code: 'ru', label: 'Русский', flag: '🇷🇺' },
                { code: 'en', label: 'English', flag: '🇬🇧' },
              ] as const).map(lang => (
                <button
                  key={lang.code}
                  onClick={() => updateSetting('language', lang.code)}
                  className={`p-3 rounded-xl border transition-all text-sm flex flex-col items-center gap-1 ${
                    settings.language === lang.code
                      ? 'border-construction-500 bg-construction-500/20 text-white'
                      : 'border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  <span className="text-2xl">{lang.flag}</span>
                  <span className="text-xs">{lang.label}</span>
                  {settings.language === lang.code && (
                    <Check size={12} className="text-construction-400" />
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
              <AlertCircle size={12} />
              Russisch und Englisch werden in einer zukünftigen Version vollständig unterstützt
            </p>
          </div>
        </section>

        {/* Über die App */}
        <section>
          <div className="card border-slate-700/50 bg-slate-800/30">
            <p className="text-slate-500 text-sm text-center">
              BauZeit Pro v1.0.0<br />
              <span className="text-xs">Digitale Stundenzettel für Baustellen</span>
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

export default SettingsPage
