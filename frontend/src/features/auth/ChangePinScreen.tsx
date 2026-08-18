import { useState, type FormEvent } from 'react'

import { AppIcon } from '../../components/layout/AppIcon'
import { BrandMark } from '../../components/layout/BrandMark'
import { useTouchKeyboard } from '../../components/touch/useTouchKeyboard'

interface ChangePinScreenProps {
  busy: boolean
  onCancel: () => void
  onChangePin: (currentPin: string, newPin: string) => Promise<void>
}

function sanitizePin(value: string) {
  return value.replace(/\D/g, '').slice(0, 8)
}

export function ChangePinScreen({ busy, onCancel, onChangePin }: ChangePinScreenProps) {
  const { openKeyboard } = useTouchKeyboard()
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const matches = newPin.length >= 4 && newPin === confirmation

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!busy && currentPin.length >= 4 && matches) void onChangePin(currentPin, newPin)
  }

  const pinField = (label: string, value: string, onChange: (value: string) => void) => (
    <label className="login-pill-field">
      <span className="login-pill-icon"><AppIcon name="pin" className="app-icon" /></span>
      <input className="login-pill-input" type="password" inputMode="numeric" value={value}
        placeholder={label} autoComplete="new-password"
        onChange={(event) => onChange(sanitizePin(event.target.value))} />
      <button type="button" className="keyboard-trigger" aria-label={`Abrir teclado para ${label}`}
        onClick={() => openKeyboard({ label, value, onChange: (next) => onChange(sanitizePin(next)), mode: 'numeric' })}>⌨</button>
    </label>
  )

  return (
    <main className="login-shell">
      <section className="login-panel login-panel--auth">
        <div className="login-avatar"><AppIcon name="pin" className="app-icon" /></div>
        <div className="login-header"><BrandMark compact /><h1 className="login-title">Definir novo PIN</h1></div>
        <p>Por segurança, altere o PIN temporário antes de continuar.</p>
        <form className="login-stack" onSubmit={handleSubmit}>
          {pinField('PIN atual', currentPin, setCurrentPin)}
          {pinField('Novo PIN (4 a 8 dígitos)', newPin, setNewPin)}
          {pinField('Confirmar novo PIN', confirmation, setConfirmation)}
          {confirmation && !matches ? <div className="alert-banner">Os novos PINs não coincidem.</div> : null}
          <div className="login-actions login-actions--stack">
            <button type="submit" className="primary-button login-submit" disabled={busy || currentPin.length < 4 || !matches}>{busy ? 'A guardar...' : 'Alterar PIN'}</button>
            <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>Sair</button>
          </div>
        </form>
      </section>
    </main>
  )
}
