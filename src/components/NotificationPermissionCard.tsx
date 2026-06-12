// NotificationPermissionCard: Aufforderung zur Notification-Erlaubnis
import React from 'react'
import { Bell, BellOff, Check, Smartphone } from 'lucide-react'
import { useNotifications } from '../hooks/useNotifications'

interface NotificationPermissionCardProps {
  userId?: string
  compact?: boolean
}

export function NotificationPermissionCard({
  userId,
  compact = false,
}: NotificationPermissionCardProps) {
  const {
    permission,
    isGranted,
    isDenied,
    loading,
    requestPermission,
    testVibration,
    supportsNotifications,
    supportsVibration,
  } = useNotifications(userId)

  // Bereits genehmigt → kompaktes Erfolgs-Banner
  if (isGranted && compact) {
    return (
      <div className="flex items-center gap-2 text-working text-sm p-3 bg-working/10 rounded-xl border border-working/20">
        <Check size={16} />
        <span>Push-Benachrichtigungen aktiv</span>
      </div>
    )
  }

  // Browser unterstützt keine Notifications
  if (!supportsNotifications) {
    return (
      <div className="card border-slate-600">
        <div className="flex items-center gap-3 text-slate-400">
          <BellOff size={20} />
          <div>
            <p className="text-sm font-medium">Benachrichtigungen nicht verfügbar</p>
            <p className="text-xs text-slate-500">Dein Browser unterstützt keine Push-Notifications</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card border-slate-600">
      <div className="flex items-start gap-3 mb-4">
        <div className={`p-2.5 rounded-xl ${isGranted ? 'bg-working/20' : isDenied ? 'bg-stopped/20' : 'bg-construction-500/20'}`}>
          {isGranted ? (
            <Bell size={20} className="text-working" />
          ) : isDenied ? (
            <BellOff size={20} className="text-stopped" />
          ) : (
            <Bell size={20} className="text-construction-400" />
          )}
        </div>
        <div>
          <h3 className="font-semibold text-white">
            {isGranted ? 'Benachrichtigungen aktiv' : 'Benachrichtigungen aktivieren'}
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            {isGranted
              ? 'Du wirst erinnert, wenn du vergisst auszustempeln.'
              : isDenied
              ? 'Berechtigung wurde abgelehnt. Bitte in den Browser-Einstellungen aktivieren.'
              : 'Erhalte Erinnerungen wenn du vergisst auszustempeln.'}
          </p>
        </div>
      </div>

      {/* Aktionen */}
      <div className="flex flex-col gap-2">
        {!isGranted && !isDenied && (
          <button
            onClick={requestPermission}
            disabled={loading}
            className="btn-primary py-3 text-sm"
          >
            {loading ? 'Bitte warten...' : '🔔 Benachrichtigungen erlauben'}
          </button>
        )}

        {isGranted && supportsVibration && (
          <button
            onClick={testVibration}
            className="btn-secondary py-2.5 text-sm flex items-center justify-center gap-2"
          >
            <Smartphone size={16} />
            Vibration testen
          </button>
        )}

        {isDenied && (
          <div className="text-xs text-slate-500 p-3 bg-slate-900 rounded-xl">
            <strong className="text-slate-400">Anleitung:</strong> Einstellungen → Browser → Benachrichtigungen → Diese Website → Erlauben
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationPermissionCard
