import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { Customer } from '../../types/models'

interface ClientAutocompleteProps {
  value: string
  onChange: (name: string, customer?: Customer) => void
  customers: Customer[]
  placeholder?: string
  className?: string
}

export function ClientAutocomplete({
  value,
  onChange,
  customers,
  placeholder = 'Nome do cliente (opcional)',
  className,
}: ClientAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null)

  function updatePos() {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
  }

  const suggestions =
    value.trim().length > 0
      ? customers
          .filter(
            (c) =>
              c.full_name.toLowerCase().includes(value.toLowerCase()) ||
              c.phone.includes(value),
          )
          .slice(0, 8)
      : []

  return (
    <div className="client-autocomplete">
      <input
        ref={inputRef}
        type="text"
        className={`touch-input${className ? ` ${className}` : ''}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); updatePos(); setOpen(true) }}
        onFocus={() => { updatePos(); setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && dropPos &&
        createPortal(
          <div
            className="client-suggestions"
            style={{
              position: 'fixed',
              top: dropPos.top,
              left: dropPos.left,
              width: dropPos.width,
              zIndex: 9999,
            }}
          >
            {suggestions.map((c) => (
              <button
                key={c.id}
                type="button"
                className="client-suggestion"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(c.full_name, c); setOpen(false) }}
              >
                <div className="client-suggestion__avatar">
                  {c.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="client-suggestion__info">
                  <strong>{c.full_name}</strong>
                  {c.phone && <small>{c.phone}</small>}
                </div>
                {(c.loyalty_points ?? 0) > 0 && (
                  <span className="client-suggestion__points">{c.loyalty_points} pts</span>
                )}
              </button>
            ))}
          </div>,
          document.body,
        )
      }
    </div>
  )
}
