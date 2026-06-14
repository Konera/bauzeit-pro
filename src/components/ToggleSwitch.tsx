// ToggleSwitch: Android-sichere Toggle-Komponente
// Nutzt CSS absolute positioning statt translate-x (glitcht auf Android WebView)
import React, { useCallback } from 'react'

interface ToggleSwitchProps {
  active: boolean
  onToggle: () => void
  disabled?: boolean
  label?: string
}

export function ToggleSwitch({ active, onToggle, disabled = false, label }: ToggleSwitchProps) {
  // Robuster Handler für Android WebView
  const handleInteraction = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) onToggle()
  }, [disabled, onToggle])

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      onClick={handleInteraction}
      disabled={disabled}
      className="toggle-switch"
      data-active={active ? 'true' : 'false'}
      style={{
        opacity: disabled ? 0.5 : 1,
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      <span className="toggle-thumb" />
    </button>
  )
}

export default ToggleSwitch
