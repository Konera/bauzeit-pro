// ConfirmModal: Bestätigungs-Dialog für kritische Aktionen
import React, { useEffect, useRef } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  loading?: boolean
  children?: React.ReactNode
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  variant = 'danger',
  loading = false,
  children,
}: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  // Escape zum Schließen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Body scroll sperren
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const variantColors = {
    danger: {
      icon: 'text-stopped',
      iconBg: 'bg-stopped/20',
      button: 'bg-stopped hover:bg-stopped-dark text-white',
    },
    warning: {
      icon: 'text-paused',
      iconBg: 'bg-paused/20',
      button: 'bg-paused hover:bg-paused-dark text-slate-900',
    },
    info: {
      icon: 'text-admin',
      iconBg: 'bg-admin/20',
      button: 'bg-admin hover:bg-admin-dark text-white',
    },
  }

  const colors = variantColors[variant]

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 animate-slide-up"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-0">
          <div className={clsx('p-3 rounded-2xl', colors.iconBg)}>
            <AlertTriangle size={24} className={colors.icon} />
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-colors"
            aria-label="Schließen"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <h2 id="modal-title" className="text-xl font-bold text-white mb-2">
            {title}
          </h2>
          <p className="text-slate-400 leading-relaxed">{message}</p>

          {children && (
            <div className="mt-4">{children}</div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 flex flex-col gap-3">
          <button
            onClick={onConfirm}
            disabled={loading}
            className={clsx(
              'w-full py-4 px-6 rounded-2xl font-bold text-lg',
              'transition-all duration-150 active:scale-[0.97]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              colors.button
            )}
          >
            {loading ? 'Bitte warten...' : confirmLabel}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full py-4 px-6 rounded-2xl font-bold text-lg bg-slate-700 hover:bg-slate-600 text-white transition-all duration-150 active:scale-[0.97] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
