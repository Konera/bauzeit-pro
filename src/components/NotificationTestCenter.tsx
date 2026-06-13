// Notification Test-Center – Test-Buttons für alle Notification-Typen
// Zeigt: Berechtigungs-Status + Test-Buttons + Stornieren

import React, { useState, useEffect } from 'react'
import { Bell, BellOff, CheckCircle, XCircle, AlertTriangle, MapPin, Car, Coffee, Clock } from 'lucide-react'
import { mobileNotificationService } from '../services/mobileNotificationService'
import { pauseTimerService } from '../services/pauseTimerService'
import { useTranslation } from '../i18n/LanguageContext'
import { isNativeApp } from '../utils/platform'

export function NotificationTestCenter() {
  const { t } = useTranslation()
  const [permStatus, setPermStatus] = useState<'granted' | 'denied' | 'prompt' | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)

  // Berechtigungsstatus prüfen
  useEffect(() => {
    checkPermission()
  }, [])

  async function checkPermission() {
    try {
      const status = await mobileNotificationService.requestPermission()
      setPermStatus(status)
    } catch {
      setPermStatus('denied')
    }
  }

  function showFeedback(msg: string) {
    setTestResult(msg)
    setTimeout(() => setTestResult(null), 3000)
  }

  async function testPauseAlarm() {
    try {
      await mobileNotificationService.showImmediateReminder(
        '⏸️ Pausenzeit abgelaufen!',
        'Deine Pause ist vorbei. Bitte zurück an die Arbeit!'
      )
      showFeedback('✅ Pausen-Alarm gesendet')
    } catch { showFeedback('❌ Fehlgeschlagen') }
  }

  async function testWorkStart() {
    try {
      await mobileNotificationService.showImmediateReminder(
        '⏰ Arbeitsbeginn-Erinnerung',
        'Vergiss nicht dich einzustempeln!'
      )
      showFeedback('✅ Arbeitsbeginn gesendet')
    } catch { showFeedback('❌ Fehlgeschlagen') }
  }

  async function testGeofence() {
    try {
      await mobileNotificationService.showImmediateReminder(
        '📍 Du bist an der Baustelle angekommen',
        'Möchtest du dich einstempeln?'
      )
      showFeedback('✅ Geofence gesendet')
    } catch { showFeedback('❌ Fehlgeschlagen') }
  }

  async function testMotion() {
    try {
      await mobileNotificationService.showImmediateReminder(
        '🚗 Du scheinst zur Arbeit zu fahren',
        'Vergiss nicht dich einzustempeln!'
      )
      showFeedback('✅ Losfahrt gesendet')
    } catch { showFeedback('❌ Fehlgeschlagen') }
  }

  async function cancelAll() {
    try {
      await mobileNotificationService.cancelWorkReminder()
      await pauseTimerService.cancelPauseAlarms()
      showFeedback('✅ Alle storniert')
    } catch { showFeedback('❌ Fehlgeschlagen') }
  }

  return (
    <div className="space-y-3">
      {/* Status */}
      <div className="flex items-center gap-2 text-sm">
        {permStatus === 'granted' ? (
          <div className="flex items-center gap-1.5 text-working">
            <CheckCircle size={14} />
            <span>{t('notif_status_granted')}</span>
          </div>
        ) : permStatus === 'denied' ? (
          <div className="flex items-center gap-1.5 text-stopped">
            <XCircle size={14} />
            <span>{t('notif_status_denied')}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-400">
            <Bell size={14} />
            <span>...</span>
          </div>
        )}
      </div>

      {/* Feedback */}
      {testResult && (
        <div className="text-xs text-center text-construction-400 bg-construction-500/10 rounded-lg py-2 animate-fade-in">
          {testResult}
        </div>
      )}

      {/* Test-Buttons Grid */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={testPauseAlarm}
          className="flex items-center gap-1.5 justify-center px-3 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium transition-all active:scale-95"
        >
          <Coffee size={13} />
          {t('notif_test_pause')}
        </button>

        <button
          onClick={testWorkStart}
          className="flex items-center gap-1.5 justify-center px-3 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium transition-all active:scale-95"
        >
          <Clock size={13} />
          {t('notif_test_work_start')}
        </button>

        <button
          onClick={testGeofence}
          className="flex items-center gap-1.5 justify-center px-3 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium transition-all active:scale-95"
        >
          <MapPin size={13} />
          {t('notif_test_geofence')}
        </button>

        <button
          onClick={testMotion}
          className="flex items-center gap-1.5 justify-center px-3 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium transition-all active:scale-95"
        >
          <Car size={13} />
          {t('notif_test_motion')}
        </button>
      </div>

      {/* Alle stornieren */}
      <button
        onClick={cancelAll}
        className="w-full flex items-center gap-1.5 justify-center px-3 py-2 rounded-xl bg-stopped/10 hover:bg-stopped/20 text-stopped text-xs font-medium transition-all active:scale-95"
      >
        <BellOff size={13} />
        {t('notif_test_all_cancel')}
      </button>
    </div>
  )
}

export default NotificationTestCenter
