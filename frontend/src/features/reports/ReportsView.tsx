import { formatCurrency } from '../../lib/formatters'
import type { Appointment, DashboardSummary } from '../../types/models'

interface ReportsViewProps {
  appointments: Appointment[]
  dashboard: DashboardSummary
}

export function ReportsView({ appointments, dashboard }: ReportsViewProps) {
  return (
    <section className="module-layout">
      <div className="module-header">
        <div>
          <p className="eyebrow">Relatórios</p>
          <h3 className="section-title">Visão diária</h3>
        </div>
      </div>

      <div className="stats-grid">
        <article className="stat-card">
          <span>Total vendido</span>
          <strong>{formatCurrency(dashboard.total_vendas)}</strong>
        </article>
        <article className="stat-card">
          <span>Atendimentos rápidos</span>
          <strong>{appointments.filter((item) => item.walk_in).length}</strong>
        </article>
        <article className="stat-card">
          <span>Pagamentos pendentes</span>
          <strong>{appointments.filter((item) => item.payment_status !== 'paid').length}</strong>
        </article>
      </div>
    </section>
  )
}
