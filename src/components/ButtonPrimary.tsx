// Primärer Action-Button für Zeiterfassung
import React from 'react'
import { clsx } from 'clsx'
import { Loader2 } from 'lucide-react'

interface ButtonPrimaryProps {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  variant?: 'start' | 'pause' | 'resume' | 'stop' | 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
  id?: string
}

const variantStyles = {
  start: 'bg-working hover:bg-working-dark text-white shadow-[0_4px_24px_rgba(34,197,94,0.4)] active:shadow-none',
  pause: 'bg-paused hover:bg-paused-dark text-slate-900 shadow-[0_4px_24px_rgba(234,179,8,0.4)] active:shadow-none',
  resume: 'bg-working hover:bg-working-dark text-white shadow-[0_4px_24px_rgba(34,197,94,0.3)] active:shadow-none',
  stop: 'bg-stopped hover:bg-stopped-dark text-white shadow-[0_4px_24px_rgba(239,68,68,0.4)] active:shadow-none',
  primary: 'bg-construction-500 hover:bg-construction-600 text-white shadow-[0_4px_20px_rgba(249,115,22,0.3)] active:shadow-none',
  secondary: 'bg-slate-700 hover:bg-slate-600 text-white shadow-lg',
  danger: 'bg-stopped hover:bg-stopped-dark text-white shadow-lg',
}

const sizeStyles = {
  sm: 'py-2 px-4 text-sm rounded-xl min-h-[40px]',
  md: 'py-3 px-6 text-base rounded-xl min-h-[48px]',
  lg: 'py-4 px-6 text-lg rounded-2xl min-h-[64px]',
  xl: 'py-6 px-6 text-xl rounded-2xl min-h-[84px]',
}

export function ButtonPrimary({
  onClick,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'xl',
  icon,
  children,
  className,
  id,
}: ButtonPrimaryProps) {
  const isDisabled = disabled || loading

  return (
    <button
      id={id}
      onClick={onClick}
      disabled={isDisabled}
      className={clsx(
        // Basis-Styles
        'w-full font-bold flex items-center justify-center gap-3',
        'transition-all duration-150 active:scale-[0.97]',
        'select-none touch-manipulation',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        // Variant und Size
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={size === 'xl' ? 28 : size === 'lg' ? 24 : 20} />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  )
}

export default ButtonPrimary
