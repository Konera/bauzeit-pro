// StatusBadge: Zeigt Arbeitsstatus visuell an
import React from 'react'
import { clsx } from 'clsx'
import { Circle, Clock, Pause, Square, AlertCircle } from 'lucide-react'
import type { WorkingStatus, TimeEntryStatus } from '../types/database'

// =========================================
// Arbeitsstatus Badge
// =========================================

interface WorkingStatusBadgeProps {
  status: WorkingStatus
  size?: 'sm' | 'md' | 'lg'
  pulse?: boolean
}

const workingStatusConfig = {
  not_started: {
    label: 'Nicht aktiv',
    className: 'badge-inactive',
    icon: Square,
  },
  working: {
    label: 'Arbeitet',
    className: 'badge-working',
    icon: Circle,
  },
  paused: {
    label: 'Pause',
    className: 'badge-paused',
    icon: Pause,
  },
  finished: {
    label: 'Beendet',
    className: 'badge-stopped',
    icon: Clock,
  },
}

export function WorkingStatusBadge({ status, size = 'md', pulse = false }: WorkingStatusBadgeProps) {
  const config = workingStatusConfig[status]
  const Icon = config.icon

  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : size === 'lg' ? 'text-sm px-3 py-1.5' : 'text-xs px-2.5 py-1'

  return (
    <span className={clsx('badge', config.className, sizeClass)}>
      <span className="relative flex items-center">
        {pulse && status === 'working' && (
          <span className="absolute -left-0.5 -top-0.5 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-working opacity-75"></span>
          </span>
        )}
        <Icon size={size === 'lg' ? 14 : 12} className={pulse && status === 'working' ? 'relative' : ''} />
      </span>
      {config.label}
    </span>
  )
}

// =========================================
// Zeiteintrags-Status Badge
// =========================================

interface TimeEntryStatusBadgeProps {
  status: TimeEntryStatus
  size?: 'sm' | 'md'
}

const timeEntryStatusConfig = {
  open: { label: 'Offen', className: 'badge-open' },
  submitted: { label: 'Eingereicht', className: 'badge-submitted' },
  approved: { label: 'Genehmigt', className: 'badge-approved' },
  corrected: { label: 'Korrigiert', className: 'badge-corrected' },
  rejected: { label: 'Abgelehnt', className: 'badge-rejected' },
}

export function TimeEntryStatusBadge({ status, size = 'md' }: TimeEntryStatusBadgeProps) {
  const config = timeEntryStatusConfig[status]
  return (
    <span className={clsx(
      'badge',
      config.className,
      size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'
    )}>
      {config.label}
    </span>
  )
}

// =========================================
// Warnung-Badge
// =========================================

interface WarningBadgeProps {
  message: string
}

export function WarningBadge({ message }: WarningBadgeProps) {
  return (
    <span className="badge bg-stopped/20 text-stopped border border-stopped/30 gap-1.5">
      <AlertCircle size={12} />
      {message}
    </span>
  )
}

// Standard-Export: WorkingStatusBadge
export default WorkingStatusBadge
