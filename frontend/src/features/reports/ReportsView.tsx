import { formatCurrency } from '../../lib/formatters'
import type { Appointment, CommissionRecord, DashboardSummary } from '../../types/models'

interface ReportsViewProps {
  appointments: Appointment[]
  dashboard: DashboardSummary
  commissions: CommissionRecord[]
}

export function ReportsView({ appointments, commissions, dashboard }: ReportsViewProps) {
  const accrued = commissions.filter(item => item.status === 'accrued')
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
        <article className="stat-card"><span>Comissões acumuladas</span><strong>{formatCurrency(accrued.reduce((sum, item) => sum + Number(item.amount), 0))}</strong></article>
      </div>
      <article className="panel"><div className="panel-head"><h4>Comissões por colaborador</h4><span className="chip">{accrued.length}</span></div><div className="record-list">
        {accrued.map(item => <div className="record-row record-row--static" key={item.id}><div className="record-main"><strong>{item.employee_name || 'Colaborador'}</strong><small>{item.sale_label} · {item.rate}% sobre {formatCurrency(item.basis_amount)}</small></div><strong>{formatCurrency(item.amount)}</strong></div>)}
        {accrued.length === 0 && <p className="empty-state">Sem comissões acumuladas.</p>}
      </div></article>
    </section>
  )
}
