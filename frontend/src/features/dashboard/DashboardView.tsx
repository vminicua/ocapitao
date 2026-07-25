import { formatCurrency, formatDateTime } from '../../lib/formatters'
import type { DashboardSummary } from '../../types/models'

interface DashboardViewProps {
  dashboard: DashboardSummary
}

export function DashboardView({ dashboard }: DashboardViewProps) {
  const totals = dashboard.totais_por_area

  return (
    <section className="module-layout">
      <div className="hero-strip">
        <div>
          <p className="eyebrow">Resumo do dia</p>
          <h3 className="section-title">Painel central</h3>
          <p className="section-copy">
            Caixa, produção e sincronização reunidos numa única vista para o balcão.
          </p>
        </div>
        <div className="hero-metric">
          <span>Total do dia</span>
          <strong>{formatCurrency(dashboard.total_vendas)}</strong>
        </div>
      </div>

      <div className="stats-grid">
        <article className="stat-card">
          <span>Barbershop</span>
          <strong>{formatCurrency(totals.barbershop)}</strong>
        </article>
        <article className="stat-card">
          <span>Bar</span>
          <strong>{formatCurrency(totals.bar)}</strong>
        </article>
        <article className="stat-card">
          <span>Carwash</span>
          <strong>{formatCurrency(totals.carwash)}</strong>
        </article>
        <article className="stat-card">
          <span>Serviços pendentes</span>
          <strong>{dashboard.servicos_pendentes}</strong>
        </article>
      </div>

      <div className="content-grid two-columns">
        <article className="panel">
          <div className="panel-head">
            <h4>Caixa e sincronização</h4>
            <span className={`chip ${dashboard.caixa_aberto ? 'chip-good' : 'chip-warn'}`}>
              {dashboard.caixa_aberto ? 'Caixa aberto' : 'Caixa fechado'}
            </span>
          </div>
          <ul className="detail-list">
            <li>
              <span>Modo atual</span>
              <strong>{dashboard.estado_sincronizacao.online ? 'Online' : 'Offline'}</strong>
            </li>
            <li>
              <span>Pendências de sync</span>
              <strong>{dashboard.estado_sincronizacao.pending_count}</strong>
            </li>
            <li>
              <span>Última sincronização</span>
              <strong>{formatDateTime(dashboard.ultima_sincronizacao)}</strong>
            </li>
          </ul>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h4>Foco da operação</h4>
            <span className="chip">Touch ready</span>
          </div>
          <p className="section-copy">
            A interface foi pensada para balcão: botões grandes, navegação direta e inputs com teclado
            virtual.
          </p>
        </article>
      </div>
    </section>
  )
}
