// GPS-Info-Karte für das Employee Dashboard
// Zeigt: Entfernung zur Baustelle, GPS-Genauigkeit, Geofence-Status, Geschwindigkeit

import React, { useState, useEffect } from 'react'
import { MapPin, Navigation, Signal, Clock, Zap } from 'lucide-react'
import { backgroundGeofenceService } from '../services/backgroundGeofenceService'
import { useTranslation } from '../i18n/LanguageContext'

interface GpsInfoCardProps {
  isActive: boolean
}

export function GpsInfoCard({ isActive }: GpsInfoCardProps) {
  const { t } = useTranslation()
  const [gpsState, setGpsState] = useState(backgroundGeofenceService.getState())

  // State alle 5 Sekunden aktualisieren
  useEffect(() => {
    if (!isActive) return
    const interval = setInterval(() => {
      setGpsState(backgroundGeofenceService.getState())
    }, 5000)
    // Sofort aktualisieren
    setGpsState(backgroundGeofenceService.getState())
    return () => clearInterval(interval)
  }, [isActive])

  if (!isActive) return null

  const { distanceToNearest, nearestSite, accuracy, lastUpdateTime, speedKmh, insideSites } = gpsState
  const isInsideAny = insideSites.size > 0

  // Genauigkeits-Level bestimmen
  const accuracyLevel = accuracy === null ? 'unknown' :
    accuracy <= 10 ? 'high' :
    accuracy <= 30 ? 'medium' : 'low'

  const accuracyColor = {
    high: 'text-working',
    medium: 'text-construction-400',
    low: 'text-stopped',
    unknown: 'text-slate-500',
  }[accuracyLevel]

  const accuracyLabel = {
    high: t('gps_accuracy_high'),
    medium: t('gps_accuracy_medium'),
    low: t('gps_accuracy_low'),
    unknown: t('gps_unknown'),
  }[accuracyLevel]

  // Letztes Update formatieren
  const lastUpdateStr = lastUpdateTime
    ? `${Math.floor((Date.now() - lastUpdateTime) / 1000)}s`
    : '–'

  // Entfernung formatieren
  const distanceStr = distanceToNearest !== null
    ? distanceToNearest > 1000
      ? `${(distanceToNearest / 1000).toFixed(1)} km`
      : `${distanceToNearest} m`
    : '–'

  return (
    <div className="card !p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <Navigation size={12} className="text-construction-400" />
          GPS
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
          isInsideAny
            ? 'bg-working/15 text-working'
            : 'bg-slate-700 text-slate-400'
        }`}>
          <MapPin size={10} />
          {isInsideAny ? t('gps_inside') : distanceToNearest !== null ? t('gps_outside') : t('gps_unknown')}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2">
        {/* Entfernung */}
        <div className="text-center">
          <div className="text-[10px] text-slate-500 mb-0.5">{t('gps_distance')}</div>
          <div className={`text-sm font-bold ${isInsideAny ? 'text-working' : 'text-white'}`}>
            {isInsideAny ? '✓' : distanceStr}
          </div>
        </div>

        {/* Genauigkeit */}
        <div className="text-center">
          <div className="text-[10px] text-slate-500 mb-0.5">{t('gps_accuracy')}</div>
          <div className={`text-sm font-bold ${accuracyColor}`}>
            {accuracy !== null ? `±${Math.round(accuracy)}m` : '–'}
          </div>
        </div>

        {/* Letztes Update */}
        <div className="text-center">
          <div className="text-[10px] text-slate-500 mb-0.5">{t('gps_last_update')}</div>
          <div className="text-sm font-bold text-slate-300">
            {lastUpdateStr}
          </div>
        </div>
      </div>

      {/* Nächste Baustelle */}
      {nearestSite && !isInsideAny && (
        <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center gap-1.5 text-[10px] text-slate-500">
          <MapPin size={10} />
          <span className="truncate">{nearestSite.name} · {distanceStr}</span>
        </div>
      )}
    </div>
  )
}

export default GpsInfoCard
