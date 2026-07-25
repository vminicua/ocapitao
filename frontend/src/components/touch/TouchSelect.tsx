import type { ReactNode } from 'react'

interface Option {
  value: string
  label: string
}

interface TouchSelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: Option[]
  helperText?: ReactNode
  disabled?: boolean
}

export function TouchSelect({ label, value, onChange, options, helperText, disabled = false }: TouchSelectProps) {
  return (
    <label className="touch-field">
      <span className="touch-label">{label}</span>
      <select
        className="touch-input touch-select"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Selecione...</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helperText ? <small className="touch-helper">{helperText}</small> : null}
    </label>
  )
}
