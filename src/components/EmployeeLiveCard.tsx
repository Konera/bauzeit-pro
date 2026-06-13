// EmployeeLiveCard: Live-Status-Karte für Admin-Dashboard
import React from 'react'
import { clsx } from 'clsx'
import { Clock, MapPin, AlertCircle, User } from 'lucide-react'
import { WorkingStatusBadge } from './StatusBadge'
import type { TimeEntry, Profile, WorkingStatus } from '../types/database'
import { formatTime, formatMinutes } from '../utils/timeUtils'

interface EmployeeLiveCardProps {
  employee: Profile
  activeEntry: TimeEntry | null
  status: WorkingStatus
  workedMinutes: number
  isOvertime?: boolean
  onClick?: () => void
}

export function EmployeeLiveCard({
  employee,
  activeEntry,
  status,
  workedMinutes,
  isOvertime = false,
  onClick,
}: EmployeeLiveCardProps) {
  const borderColor = {
    working: isOvertime ? 'border-stopped' : 'border-working/50',
    paused: 'border-paused/50',
    not_started: 'border-slate-700',
    finished: 'border-slate-700',
  }[status]

  const bgColor = {
    working: isOvertime ? 'bg-stopped/5' : 'bg-working/5',
    paused: 'bg-paused/5',
    not_started: 'bg-slate-800',
    finished: 'bg-slate-800',
  }[status]

  return (
    <div
      onClick={onClick}
      className={clsx(
        'rounded-2xl p-4 border transition-all duration-200',
        bgColor,
        borderColor,
        onClick && 'cursor-pointer hover:scale-[1.01] active:scale-[0.99]'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={clsx(
            'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold',
            status === 'working' ? isOvertime ? 'bg-stopped/20 text-stopped' : 'bg-working/20 text-working' :
            status === 'paused' ? 'bg-paused/20 text-paused' :
            'bg-slate-700 text-slate-400'
          )}>
            {employee.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-white text-sm">{employee.full_name}</p>
            <p className="text-xs text-slate-500">
              {employee.role === 'manager' ? '👷 Bauleiter' : '🔧 Mitarbeiter'}
            </p>
          </div>
        </div>
        <WorkingStatusBadge status={status} size="sm" pulse={status === 'working'} />
      </div>

      {/* Details */}
      {activeEntry ? (
        <div className="space-y-2">
          {/* Baustelle */}
          {activeEntry.site && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <MapPin size={12} />
              <span>{activeEntry.site.name}</span>
              {activeEntry.gps_warning && (
                <span className="badge badge-gps-warning text-xs px-1.5 py-0.5 ml-1" title="Außerhalb des Baustellen-Radius">
                  ⚠️ GPS
                </span>
              )}
            </div>
          )}

          {/* Start-Zeit */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock size={12} />
            <span>Seit {formatTime(activeEntry.start_time)}</span>
          </div>

          {/* Gearbeitete Zeit */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Gearbeitet</span>
            <span className={clsx(
              'text-sm font-bold',
              isOvertime ? 'text-stopped' : 'text-working'
            )}>
              {formatMinutes(workedMinutes)} h
            </span>
          </div>

          {/* Überstunden-Warnung */}
          {isOvertime && (
            <div className="flex items-center gap-2 text-xs text-stopped bg-stopped/10 rounded-lg px-2 py-1.5">
              <AlertCircle size={12} />
              <span>Stop vergessen!</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <User size={12} />
          <span>Nicht eingestempelt</span>
        </div>
      )}
    </div>
  )
}

export default EmployeeLiveCard
