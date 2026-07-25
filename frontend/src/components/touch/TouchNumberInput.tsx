import { useTouchKeyboard } from './useTouchKeyboard'

interface TouchNumberInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  helperText?: string
  disabled?: boolean
}

export function TouchNumberInput({
  label,
  value,
  onChange,
  placeholder,
  helperText,
  disabled = false,
}: TouchNumberInputProps) {
  const { openKeyboard } = useTouchKeyboard()

  return (
    <label className="touch-field">
      <span className="touch-label">{label}</span>
      <div className="touch-input-shell">
        <input
          className="touch-input"
          type="text"
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="keyboard-trigger"
          disabled={disabled}
          onClick={() => openKeyboard({ label, value, onChange, mode: 'numeric' })}
          aria-label={`Abrir teclado numérico para ${label}`}
        >
          ⌨
        </button>
      </div>
      {helperText ? <small className="touch-helper">{helperText}</small> : null}
    </label>
  )
}
