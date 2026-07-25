import { useTouchKeyboard } from './useTouchKeyboard'

interface TouchInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  helperText?: string
  type?: 'text' | 'email' | 'password' | 'search' | 'tel'
  disabled?: boolean
}

export function TouchInput({
  label,
  value,
  onChange,
  placeholder,
  helperText,
  type = 'text',
  disabled = false,
}: TouchInputProps) {
  const { openKeyboard } = useTouchKeyboard()

  return (
    <label className="touch-field">
      <span className="touch-label">{label}</span>
      <div className="touch-input-shell">
        <input
          className="touch-input"
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="keyboard-trigger"
          disabled={disabled}
          onClick={() => openKeyboard({ label, value, onChange, mode: 'text' })}
          aria-label={`Abrir teclado virtual para ${label}`}
        >
          ⌨
        </button>
      </div>
      {helperText ? <small className="touch-helper">{helperText}</small> : null}
    </label>
  )
}
