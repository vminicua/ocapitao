import { useCallback, useEffect, useState } from 'react'
import { downloadAnalyticsCsv, getAnalytics } from '../../lib/api'
import { showErrorAlert } from '../../lib/alerts'
import { formatCurrency } from '../../lib/formatters'
import type { Appointment, CommissionRecord, DashboardSummary } from '../../types/models'
import type { AnalyticsReport } from '../../types/models'

interface ReportsViewProps {
  appointments: Appointment[]
  dashboard: DashboardSummary
  commissions: CommissionRecord[]
  accessToken: string
}

export function ReportsView({ appointments, commissions, dashboard, accessToken }: ReportsViewProps) {
  const accrued = commissions.filter(item => item.status === 'accrued')
  const today = new Date().toISOString().slice(0, 10)
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useState(monthAgo)
  const [dateTo, setDateTo] = useState(today)
  const [report, setReport] = useState<AnalyticsReport | null>(null)
  const load = useCallback(() => getAnalytics(accessToken, dateFrom, dateTo).then(setReport).catch(error => showErrorAlert('Falha ao carregar relatório', String(error))), [accessToken, dateFrom, dateTo])
  useEffect(() => { void load() }, [load])
  return (
    <section className="module-layout">
      <div className="module-header">
        <div>
          <p className="eyebrow">Relatórios</p>
          <h3 className="section-title">Visão diária</h3>
        </div>
        <div className="toolbar-actions"><input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} /><input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} /><button className="secondary-button" onClick={load}>Atualizar</button><button className="primary-button" onClick={() => void downloadAnalyticsCsv(accessToken, dateFrom, dateTo)}>Exportar CSV</button><button className="secondary-button" onClick={() => window.print()}>Imprimir / PDF</button></div>
      </div>

      <div className="stats-grid">
        <article className="stat-card">
          <span>Total vendido</span>
          <strong>{formatCurrency(report?.revenue ?? dashboard.total_vendas)}</strong>
        </article>
        <article className="stat-card">
          <span>Atendimentos rápidos</span>
          <strong>{appointments.filter((item) => item.walk_in).length}</strong>
        </article>
        <article className="stat-card">
          <span>Pagamentos pendentes</span>
          <strong>{report?.debts ? formatCurrency(report.debts) : appointments.filter((item) => item.payment_status !== 'paid').length}</strong>
        </article>
        <article className="stat-card"><span>Comissões acumuladas</span><strong>{formatCurrency(accrued.reduce((sum, item) => sum + Number(item.amount), 0))}</strong></article>
      </div>
      {report && <div className="stats-grid"><article className="stat-card"><span>Ticket médio</span><strong>{formatCurrency(report.average_ticket)}</strong></article><article className="stat-card"><span>Descontos</span><strong>{formatCurrency(report.discounts)}</strong></article><article className="stat-card"><span>Valor do stock</span><strong>{formatCurrency(report.inventory_value)}</strong></article><article className="stat-card"><span>Artigos em alerta</span><strong>{report.low_stock_count}</strong></article></div>}
      {report && <article className="panel"><div className="panel-head"><h4>Produtos e serviços mais vendidos</h4><span className="chip">{report.top_items.length}</span></div><div className="record-list">{report.top_items.map(item => <div className="record-row record-row--static" key={`${item.item_type}-${item.description}`}><div className="record-main"><strong>{item.description}</strong><small>{item.item_type} · {item.quantity} unidades</small></div><strong>{formatCurrency(item.total)}</strong></div>)}</div></article>}
      <article className="panel"><div className="panel-head"><h4>Comissões por colaborador</h4><span className="chip">{accrued.length}</span></div><div className="record-list">
        {accrued.map(item => <div className="record-row record-row--static" key={item.id}><div className="record-main"><strong>{item.employee_name || 'Colaborador'}</strong><small>{item.sale_label} · {item.rate}% sobre {formatCurrency(item.basis_amount)}</small></div><strong>{formatCurrency(item.amount)}</strong></div>)}
        {accrued.length === 0 && <p className="empty-state">Sem comissões acumuladas.</p>}
      </div></article>
    </section>
  )
}
