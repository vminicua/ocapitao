import type { ModuleId } from '../../types/models'

interface SidebarProps {
  activeModule: ModuleId
  pendingCount: number
  onSelect: (moduleId: ModuleId) => void
}

const items: Array<{ id: ModuleId; label: string; badge?: string }> = [
  { id: 'dashboard', label: 'Dashboard', badge: '01' },
  { id: 'barbershop', label: 'Barbershop', badge: '02' },
  { id: 'bar', label: 'Bar', badge: '03' },
  { id: 'carwash', label: 'Carwash', badge: '04' },
  { id: 'caixa', label: 'Caixa', badge: '05' },
  { id: 'stock', label: 'Stock', badge: '06' },
  { id: 'reports', label: 'Relatórios', badge: '07' },
  { id: 'settings', label: 'Configurações', badge: '08' },
]

export function Sidebar({ activeModule, pendingCount, onSelect }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand-panel">
        <p className="brand-kicker">Barbershop + POS</p>
        <h1>O Capitão</h1>
        <p className="brand-caption">Gestão offline com sincronização pronta para a cloud.</p>
      </div>

      <nav className="nav-stack" aria-label="Menu principal">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-link ${item.id === activeModule ? 'is-active' : ''}`}
            onClick={() => onSelect(item.id)}
          >
            <span className="nav-badge">{item.badge}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <p className="eyebrow">Fila de sincronização</p>
        <strong>{pendingCount} pendências</strong>
      </div>
    </aside>
  )
}
