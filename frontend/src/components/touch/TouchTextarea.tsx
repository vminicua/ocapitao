import { useTouchKeyboard } from './useTouchKeyboard'

interface TouchTextareaProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  helperText?: string
  rows?: number
}

export function TouchTextarea({
  label,
  value,
  onChange,
  placeholder,
  helperText,
  rows = 4,
}: TouchTextareaProps) {
  const { openKeyboard } = useTouchKeyboard()

  return (
    <label className="touch-field">
      <span className="touch-label">{label}</span>
      <div className="touch-input-shell touch-input-shell--stack">
        <textarea
          className="touch-input touch-textarea"
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="keyboard-trigger"
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
