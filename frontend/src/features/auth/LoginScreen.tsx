import { useEffect, useState, type FormEvent } from 'react'

import { AppIcon } from '../../components/layout/AppIcon'
import { BrandMark } from '../../components/layout/BrandMark'
import { useTouchKeyboard } from '../../components/touch/useTouchKeyboard'
import { getLoginUsers } from '../../lib/api'
import type { LoginUserOption, SyncState } from '../../types/models'

interface LoginScreenProps {
  busy: boolean
  onLogin: (userId: number, pin: string) => Promise<void>
  syncState: SyncState
}

function sanitizePin(value: string) {
  return value.replace(/\D/g, '').slice(0, 4)
}

export function LoginScreen({ busy, onLogin, syncState }: LoginScreenProps) {
  const { openKeyboard } = useTouchKeyboard()
  const [users, setUsers] = useState<LoginUserOption[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('')
  const [pin, setPin] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadUsers() {
      try {
        const nextUsers = await getLoginUsers()
        if (cancelled) {
          return
        }
        setUsers(nextUsers)
        setSelectedUserId((current) => current || nextUsers[0]?.id || '')
      } catch {
        if (!cancelled) {
          setUsers([])
          setSelectedUserId('')
        }
      } finally {
        if (!cancelled) {
          setLoadingUsers(false)
        }
      }
    }

    void loadUsers()

    return () => {
      cancelled = true
    }
  }, [])

  const canSubmit =
    !busy &&
    syncState.api_online !== false &&
    !loadingUsers &&
    typeof selectedUserId === 'number' &&
    selectedUserId > 0 &&
    pin.length === 4

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (typeof selectedUserId === 'number' && canSubmit) {
      void onLogin(selectedUserId, pin)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel login-panel--auth">
        <div className="login-avatar">
          <AppIcon name="user" className="app-icon" />
        </div>

        <div className="login-header">
          <BrandMark compact />
          <h1 className="login-title">Entrar</h1>
        </div>

        {!syncState.api_online ? (
          <div className="alert-banner">
            A API local está desligada. Inicie o backend em 127.0.0.1:8000 para carregar os utilizadores.
          </div>
        ) : null}

        <form className="login-stack" onSubmit={handleSubmit}>
          <label className="login-pill-field">
            <span className="login-pill-icon">
              <AppIcon name="user" className="app-icon" />
            </span>
            <select
              className="login-pill-input"
              value={selectedUserId}
              disabled={loadingUsers || users.length === 0}
              onChange={(event) => {
                const value = event.target.value
                setSelectedUserId(value ? Number(value) : '')
              }}
            >
              {loadingUsers ? <option value="">A carregar utilizadores...</option> : null}
              {!loadingUsers && users.length === 0 ? <option value="">Sem utilizadores disponíveis</option> : null}
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.display_name}
                </option>
              ))}
            </select>
          </label>

          <label className="login-pill-field">
            <span className="login-pill-icon">
              <AppIcon name="pin" className="app-icon" />
            </span>
            <input
              className="login-pill-input"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              placeholder="PIN"
              autoComplete="one-time-code"
              enterKeyHint="go"
              onChange={(event) => setPin(sanitizePin(event.target.value))}
            />
            <button
              type="button"
              className="keyboard-trigger"
              onClick={() =>
                openKeyboard({
                  label: 'PIN',
                  value: pin,
                  onChange: (value) => setPin(sanitizePin(value)),
                  mode: 'numeric',
                })
              }
              aria-label="Abrir teclado numérico para o PIN"
            >
              ⌨
            </button>
          </label>

          <div className="login-actions login-actions--stack">
            <button type="submit" className="primary-button login-submit" disabled={!canSubmit}>
              {busy ? 'A entrar...' : 'Entrar'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
