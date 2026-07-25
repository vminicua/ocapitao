import Swal from 'sweetalert2'

import { showCloudConnectDialog, showInfoAlert, showSuccessToast } from '../../lib/alerts'
import type { SyncState } from '../../types/models'
import { AppIcon } from './AppIcon'

interface CloudStatusProps {
  compact?: boolean
  syncState: SyncState
  onConnect?: (password: string) => Promise<{ ok: boolean; message: string }>
  onDisconnect?: () => Promise<void>
}

export function CloudStatus({ compact = false, syncState, onConnect, onDisconnect }: CloudStatusProps) {
  const databaseOnline = syncState.database_online ?? syncState.postgres_online ?? false
  const toneClass = compact
    ? syncState.online
      ? 'is-success'
      : 'is-danger'
    : syncState.online
      ? 'is-success'
      : syncState.api_online
        ? 'is-warning'
        : 'is-danger'
  const shortLabel = syncState.online
    ? 'Cloud ligada'
    : syncState.api_online
      ? 'Cloud parcial'
      : 'API local off'

  async function handleClick() {
    if (databaseOnline) {
      const result = await Swal.fire({
        icon: 'success',
        title: 'Estado da cloud',
        html: `
          <p><strong>${syncState.label ?? shortLabel}</strong></p>
          <p>API local: ${syncState.api_online ? 'ligada' : 'desligada'}</p>
          <p>MySQL: ligado</p>
          <p>Pendências: ${syncState.pending_count}</p>
        `,
        confirmButtonText: 'OK',
        confirmButtonColor: '#17458c',
        showCancelButton: !!onDisconnect,
        cancelButtonText: 'Desligar cloud',
        cancelButtonColor: '#a2533b',
        reverseButtons: true,
      })
      if (result.isDismissed && result.dismiss === Swal.DismissReason.cancel && onDisconnect) {
        await onDisconnect()
        void showSuccessToast('Cloud desligada.')
      }
    } else if (onConnect) {
      await showCloudConnectDialog(onConnect)
    } else {
      void showInfoAlert(
        'Estado da cloud',
        `
          <p><strong>${syncState.label ?? shortLabel}</strong></p>
          <p>API local: ${syncState.api_online ? 'ligada' : 'desligada'}</p>
          <p>MySQL: desligado</p>
          <p>Pendências: ${syncState.pending_count}</p>
          ${syncState.last_error ? `<p style="margin-top:12px;color:#a2533b;">${syncState.last_error}</p>` : ''}
        `,
      )
    }
  }

  return (
    <button
      type="button"
      className={`cloud-status ${compact ? 'cloud-status--compact' : ''} ${toneClass}`}
      title={syncState.last_error || syncState.label}
      onClick={() => void handleClick()}
    >
      <div className="cloud-status__icon">
        <AppIcon name="cloud" className="app-icon" />
      </div>
      {compact ? null : (
        <div className="cloud-status__copy">
          <strong>{shortLabel}</strong>
          <span>{syncState.online ? 'Sincronização pronta' : databaseOnline ? 'Ver detalhes' : 'Clique para ligar'}</span>
        </div>
      )}
    </button>
  )
}
