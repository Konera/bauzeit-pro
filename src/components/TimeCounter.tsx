// TimeCounter: Live-Anzeige der gearbeiteten Zeit
import React, { useMemo } from 'react'
import { clsx } from 'clsx'
import { formatSeconds, formatMinutes } from '../utils/timeUtils'

interface TimeCounterProps {
  seconds: number
  label?: string
  variant?: 'working' | 'paused' | 'neutral'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showLabel?: boolean
  className?: string
}

export function TimeCounter({
  seconds,
  label = 'Gearbeitet',
  variant = 'working',
  size = 'xl',
  showLabel = true,
  className,
}: TimeCounterProps) {
  const timeString = useMemo(() => formatSeconds(seconds), [seconds])

  const variantColors = {
    working: 'text-working',
    paused: 'text-paused',
    neutral: 'text-slate-200',
  }

  const sizeStyles = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-5xl',
    xl: 'text-6xl',
  }

  const labelSize = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-sm',
    xl: 'text-base',
  }

  return (
    <div className={clsx('text-center', className)}>
      {showLabel && (
        <p className={clsx('text-slate-400 font-medium mb-1 uppercase tracking-widest', labelSize[size])}>
          {label}
        </p>
      )}
      <div
        className={clsx(
          'font-black tabular-nums tracking-tight',
          sizeStyles[size],
          variantColors[variant]
        )}
        aria-live="polite"
        aria-label={`${label}: ${timeString}`}
      >
        {timeString}
      </div>
    </div>
  )
}

// Mini-Variante für Karten
interface MiniTimeDisplayProps {
  minutes: number
  label: string
  color?: string
}

export function MiniTimeDisplay({ minutes, label, color = 'text-slate-300' }: MiniTimeDisplayProps) {
  return (
    <div className="text-center">
      <p className={clsx('text-lg font-bold', color)}>{formatMinutes(minutes)}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

export default TimeCounter
