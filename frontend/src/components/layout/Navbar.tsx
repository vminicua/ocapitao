import { AppIcon } from './AppIcon'
import { BrandMark } from './BrandMark'
import { CloudStatus } from './CloudStatus'
import type { SyncState } from '../../types/models'

interface NavbarProps {
  canGoBack: boolean
  canOpenSettings?: boolean
  onCloudConnect?: (password: string) => Promise<{ ok: boolean; message: string }>
  onCloudDisconnect?: () => Promise<void>
  onGoBack: () => void
  onLogout: () => void
  onOpenMenu: () => void
  onOpenSettings: () => void
  onSwitchUser: () => void
  syncState: SyncState
  userName: string
}

export function Navbar({
  canGoBack,
  canOpenSettings = true,
  onCloudConnect,
  onCloudDisconnect,
  onGoBack,
  onLogout,
  onOpenMenu,
  onOpenSettings,
  onSwitchUser,
  syncState,
  userName,
}: NavbarProps) {
  return (
    <header className="app-navbar">
      <div className="app-navbar__left">
        <BrandMark compact iconOnly />
      </div>

      <div className="app-navbar__right">
        <div className="navbar-session">
          <CloudStatus compact syncState={syncState} onConnect={onCloudConnect} onDisconnect={onCloudDisconnect} />
          <div className="navbar-user" title={userName}>
            <div className="navbar-user__icon">
              <AppIcon name="user" className="app-icon" />
            </div>
            <span>{userName}</span>
          </div>
        </div>

        <div className="navbar-actions">
          <button
            type="button"
            className="nav-action"
            onClick={onGoBack}
            title="Voltar"
            aria-label="Voltar"
            disabled={!canGoBack}
          >
            <AppIcon name="back" className="app-icon" />
          </button>
          <button type="button" className="nav-action" onClick={onOpenMenu} title="Menu" aria-label="Menu principal">
            <AppIcon name="menu" className="app-icon" />
          </button>
          <button
            type="button"
            className="nav-action"
            onClick={onOpenSettings}
            title="Configurações"
            aria-label="Configurações"
            disabled={!canOpenSettings}
          >
            <AppIcon name="settings" className="app-icon" />
          </button>
          <button
            type="button"
            className="nav-action"
            onClick={onSwitchUser}
            title="Trocar utilizador"
            aria-label="Trocar utilizador"
          >
            <AppIcon name="switch" className="app-icon" />
          </button>
          <button
            type="button"
            className="nav-action nav-action--danger"
            onClick={onLogout}
            title="Sair"
            aria-label="Sair"
          >
            <AppIcon name="logout" className="app-icon" />
          </button>
        </div>
      </div>
    </header>
  )
}
