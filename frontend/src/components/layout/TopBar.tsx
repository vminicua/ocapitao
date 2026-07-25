import { formatDateTime } from '../../lib/formatters'
import type { AuthSession, SyncState } from '../../types/models'

interface TopBarProps {
  message: string
  session: AuthSession
  syncState: SyncState
  onLogout: () => void
  onSyncNow: () => void
}

export function TopBar({ message, session, syncState, onLogout, onSyncNow }: TopBarProps) {
  const fullName = `${session.user?.first_name ?? ''} ${session.user?.last_name ?? ''}`.trim()

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Estado operacional</p>
        <h2>Operação do dia</h2>
        <p className="topbar-message">{message}</p>
      </div>

      <div className="topbar-actions">
        <div className={`sync-pill ${syncState.online ? 'is-online' : 'is-offline'}`}>
          <span className="sync-dot" />
          <span>{syncState.online ? 'Online' : 'Offline'}</span>
          <small>{syncState.pending_count} pend.</small>
        </div>

        <div className="operator-chip">
          <span>{fullName || session.user?.email}</span>
          <small>{session.user?.role?.name ?? 'Sem perfil'}</small>
        </div>

        <button type="button" className="ghost-button" onClick={onSyncNow}>
          Sincronizar agora
        </button>
        <button type="button" className="ghost-button" onClick={onLogout}>
          Sair
        </button>
      </div>

      <div className="topbar-meta">Última atualização local: {formatDateTime(new Date().toISOString())}</div>
    </header>
  )
}
