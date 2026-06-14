// ToggleSwitch: Android-sichere Toggle-Komponente
// Nutzt CSS absolute positioning statt translate-x (glitcht auf Android WebView)
import React from 'react'

interface ToggleSwitchProps {
  active: boolean
  onToggle: () => void
  disabled?: boolean
  label?: string
}

export function ToggleSwitch({ active, onToggle, disabled = false, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      onClick={onToggle}
      disabled={disabled}
      className="toggle-switch"
      data-active={active ? 'true' : 'false'}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <span className="toggle-thumb" />
    </button>
  )
}

export default ToggleSwitch
