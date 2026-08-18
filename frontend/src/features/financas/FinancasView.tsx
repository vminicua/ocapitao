import { useDeferredValue, useState } from 'react'

import { formatCurrency } from '../../lib/formatters'
import { getSaleReceipt } from '../../lib/api'
import type { CashSessionRecord, SaleReceipt, Transaction } from '../../types/models'

const DEPT: Record<string, { label: string; color: string }> = {
  bar: { label: 'Bar', color: '#d97706' },
  barbershop: { label: 'Barbershop', color: '#1f5fbf' },
  carwash: { label: 'Carwash', color: '#1f9d6d' },
}

const METHODS = ['Todos', 'Dinheiro', 'Cartão', 'M-Pesa', 'Transferência', 'Crédito', 'Outro']
const DEPTS_FILTER = ['Todos', 'bar', 'barbershop', 'carwash']
const PAY_METHODS = ['Dinheiro', 'Cartão', 'M-Pesa', 'Transferência', 'Outro']

interface FinancasViewProps {
  transactions: Transaction[]
  onCancelTransaction?: (id: string) => Promise<void>
  onMarkAsPaid?: (id: string, method: string) => Promise<void>
  canCancel?: boolean
  cashSession: CashSessionRecord | null
  onOpenCash: (openingAmount: number) => Promise<void>
  onCloseCash: (closingAmount: number) => Promise<void>
  accessToken: string
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateInput(ts: number) {
  return new Date(ts).toISOString().slice(0, 10)
}

function todayStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function weekStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d.getTime()
}

function monthStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(1)
  return d.getTime()
}

function itemsSummary(transaction: Transaction) {
  return transaction.items
    .map((i) => (i.quantity > 1 ? `${i.label} ×${i.quantity}` : i.label))
    .join(', ')
}

export function FinancasView({ transactions, onCancelTransaction, onMarkAsPaid, canCancel = false, cashSession, onOpenCash, onCloseCash, accessToken }: FinancasViewProps) {
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('Todos')
  const [methodFilter, setMethodFilter] = useState('Todos')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all')
  const [markAsPaidMethod, setMarkAsPaidMethod] = useState('Dinheiro')
  const [periodPreset, setPeriodPreset] = useState<'today' | 'week' | 'month' | 'custom'>('today')
  const [dateFrom, setDateFrom] = useState(formatDateInput(todayStart()))
  const [dateTo, setDateTo] = useState(formatDateInput(Date.now()))
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null)
  const [cashAmount, setCashAmount] = useState('0')
  const [cashBusy, setCashBusy] = useState(false)
  const [cashError, setCashError] = useState('')
  const [transactionBusy, setTransactionBusy] = useState(false)
  const [transactionError, setTransactionError] = useState('')
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null)

  async function showReceipt(reprint = false) {
    if (!selectedTxn) return
    try { setReceipt(await getSaleReceipt(accessToken, selectedTxn.id, reprint)) } catch (error) { setTransactionError(String(error)) }
  }

  async function runTransactionAction(action: () => Promise<void>) {
    setTransactionBusy(true)
    setTransactionError('')
    try {
      await action()
      setSelectedTxn(null)
    } catch (error) {
      setTransactionError(error instanceof Error ? error.message : 'Não foi possível concluir a operação.')
    } finally {
      setTransactionBusy(false)
    }
  }

  const deferredSearch = useDeferredValue(search)

  function applyPreset(preset: typeof periodPreset) {
    setPeriodPreset(preset)
    const now = formatDateInput(Date.now())
    if (preset === 'today') { setDateFrom(formatDateInput(todayStart())); setDateTo(now) }
    if (preset === 'week') { setDateFrom(formatDateInput(weekStart())); setDateTo(now) }
    if (preset === 'month') { setDateFrom(formatDateInput(monthStart())); setDateTo(now) }
  }

  const fromTs = new Date(dateFrom).setHours(0, 0, 0, 0)
  const toTs = new Date(dateTo).setHours(23, 59, 59, 999)

  const filtered = transactions.filter((t) => {
    if (t.created_at < fromTs || t.created_at > toTs) return false
    if (deptFilter !== 'Todos' && t.source !== deptFilter) return false
    if (methodFilter !== 'Todos' && t.payment_method !== methodFilter) return false
    if (statusFilter === 'completed' && t.status !== 'completed') return false
    if (statusFilter === 'pending' && t.status !== 'pending') return false
    const q = deferredSearch.toLowerCase()
    if (q && !t.label.toLowerCase().includes(q) && !itemsSummary(t).toLowerCase().includes(q)) return false
    return true
  })

  const pendingCount = transactions.filter((t) => t.status === 'pending').length
  const pendingTotal = transactions.filter((t) => t.status === 'pending').reduce((s, t) => s + t.total, 0)

  // Stats for the filtered period
  const totalRevenue = filtered.reduce((s, t) => s + t.total, 0)
  const totalToday = transactions
    .filter((t) => t.created_at >= todayStart())
    .reduce((s, t) => s + t.total, 0)
  const totalMonth = transactions
    .filter((t) => t.created_at >= monthStart())
    .reduce((s, t) => s + t.total, 0)
  const avgTicket = filtered.length > 0 ? totalRevenue / filtered.length : 0

  // By dept
  const byDept = filtered.reduce<Record<string, number>>((acc, t) => {
    acc[t.source] = (acc[t.source] ?? 0) + t.total
    return acc
  }, {})

  // By method
  const byMethod = filtered.reduce<Record<string, number>>((acc, t) => {
    acc[t.payment_method] = (acc[t.payment_method] ?? 0) + t.total
    return acc
  }, {})

  function handlePrint() {
    window.print()
  }

  async function handleCashAction() {
    setCashBusy(true)
    setCashError('')
    try {
      const amount = Number(cashAmount || 0)
      if (!Number.isFinite(amount) || amount < 0) throw new Error('Introduza um valor válido.')
      if (cashSession) await onCloseCash(amount)
      else await onOpenCash(amount)
      setCashAmount('0')
    } catch (error) {
      setCashError(error instanceof Error ? error.message : 'Não foi possível atualizar o caixa.')
    } finally {
      setCashBusy(false)
    }
  }

  return (
    <section className="module-layout financas-layout">
      {/* Detail modal */}
      {selectedTxn && (
        <div className="modal-overlay" onClick={() => setSelectedTxn(null)}>
          <div className="modal-panel modal-panel--wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p
                  className="eyebrow"
                  style={{ color: DEPT[selectedTxn.source]?.color }}
                >
                  {DEPT[selectedTxn.source]?.label} · {formatDate(selectedTxn.created_at)} {formatTime(selectedTxn.created_at)}
                </p>
                <h3 className="section-title" style={{ margin: 0 }}>{selectedTxn.label}</h3>
              </div>
              <button type="button" className="modal-close" onClick={() => setSelectedTxn(null)}>✕</button>
            </div>

            <div className="cart-list">
              {selectedTxn.items.map((item) => (
                <div key={item.uid} className="cart-row" style={{ alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <strong>{item.label}</strong>
                    <small style={{ display: 'block', color: 'var(--muted)' }}>
                      {item.category} · {item.kind === 'service' ? 'Serviço' : 'Produto'}
                      {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                    </small>
                  </div>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            {receipt && <article className="panel receipt-print"><div className="panel-head"><h4>{receipt.business.name}</h4><span>{receipt.number}{receipt.copy > 0 ? ` · 2.ª via ${receipt.copy}` : ''}</span></div><p>{receipt.business.legal_name} · NUIT {receipt.business.nuit}<br />{receipt.business.address} · {receipt.business.phone}</p><div className="record-list">{receipt.items.map(item => <div className="record-row record-row--static" key={item.id}><span>{item.description} × {item.quantity}</span><strong>{formatCurrency(item.total_price)}</strong></div>)}</div><div className="summary-total"><span>Total</span><strong>{formatCurrency(receipt.total)}</strong></div><small>IVA incluído: {formatCurrency(receipt.tax_included)} · Operador: {receipt.operator}</small><p>{receipt.business.footer}</p></article>}

            <div className="summary-box">
              <div>
                <span>Subtotal</span>
                <strong>{formatCurrency(selectedTxn.subtotal)}</strong>
              </div>
              {selectedTxn.discount > 0 && (
                <div>
                  <span>Desconto</span>
                  <strong style={{ color: 'var(--danger)' }}>− {formatCurrency(selectedTxn.discount)}</strong>
                </div>
              )}
              <div className="summary-total">
                <span>{selectedTxn.status === 'pending' ? 'Valor em dívida' : 'Total pago'}</span>
                <strong style={selectedTxn.status === 'pending' ? { color: '#c2410c' } : undefined}>{formatCurrency(selectedTxn.total)}</strong>
              </div>
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Método</span>
                <strong>{selectedTxn.payment_method}</strong>
              </div>
            </div>

            {/* Mark as paid - for pending transactions */}
            {selectedTxn.status === 'pending' && onMarkAsPaid && (
              <div className="financas-mark-paid">
                <p className="financas-mark-paid__title">Cobrar dívida agora</p>
                <div className="chip-group" style={{ flexWrap: 'wrap' }}>
                  {PAY_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`chip-button${markAsPaidMethod === m ? ' is-selected' : ''}`}
                      onClick={() => setMarkAsPaidMethod(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="primary-button"
                  style={{ width: '100%', marginTop: '0.5rem' }}
                  disabled={transactionBusy}
                  onClick={() => void runTransactionAction(() => onMarkAsPaid(selectedTxn.id, markAsPaidMethod))}
                >
                  ✓ Marcar como pago · {formatCurrency(selectedTxn.total)}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
              <button type="button" className="primary-button" onClick={() => receipt ? window.print() : void showReceipt(false)}>{receipt ? '🖨 Imprimir / PDF' : '🧾 Ver recibo'}</button>
              {receipt && <button type="button" className="ghost-button" onClick={() => void showReceipt(true)}>Reimprimir</button>}
              {canCancel && onCancelTransaction && (
                <button
                  type="button"
                  className="ghost-button"
                  style={{ flex: 1, color: 'var(--danger)', borderColor: 'var(--danger)' }}
                  onClick={() => {
                    if (window.confirm(`Cancelar transação "${selectedTxn?.label}"? Esta ação não pode ser desfeita.`)) {
                      void runTransactionAction(() => onCancelTransaction(selectedTxn!.id))
                    }
                  }}
                >
                  🚫 Cancelar
                </button>
              )}
              <button
                type="button"
                className="ghost-button"
                style={{ flex: 1 }}
                onClick={() => setSelectedTxn(null)}
              >
                Fechar
              </button>
            </div>
            {transactionError && <p className="danger-text" role="alert">{transactionError}</p>}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="module-header">
        <div>
          <p className="eyebrow">Finanças</p>
          <h3 className="section-title">Histórico de caixa e transações</h3>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="chip">{filtered.length} transaç{filtered.length !== 1 ? 'ões' : 'ão'}</span>
          <button type="button" className="ghost-button financas-print-hide" onClick={handlePrint}>
            📄 Exportar PDF
          </button>
        </div>
      </div>

      <article className={`panel cash-control ${cashSession ? 'cash-control--open' : 'cash-control--closed'}`}>
        <div className="panel-head">
          <div>
            <h4>{cashSession ? 'Caixa aberto' : 'Caixa fechado'}</h4>
            <small className="touch-helper">
              {cashSession
                ? `Aberto em ${new Date(cashSession.opened_at).toLocaleString('pt-MZ')} · fundo ${formatCurrency(cashSession.opening_amount)}`
                : 'Abra o caixa antes de registar vendas ou pagamentos.'}
            </small>
          </div>
          <span className={`chip ${cashSession ? 'chip-good' : 'chip-warn'}`}>{cashSession ? 'Operacional' : 'Bloqueado'}</span>
        </div>
        <div className="cash-control__actions">
          <label className="touch-field">
            <span className="touch-label">{cashSession ? 'Valor contado no fecho' : 'Fundo inicial'}</span>
            <input className="touch-input" type="number" min="0" value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} />
          </label>
          <button type="button" className={cashSession ? 'ghost-button' : 'primary-button'} disabled={cashBusy} onClick={() => void handleCashAction()}>
            {cashBusy ? 'A processar...' : cashSession ? 'Fechar caixa' : 'Abrir caixa'}
          </button>
        </div>
        {cashError && <p className="danger-text" role="alert">{cashError}</p>}
      </article>

      {/* Stats strip */}
      <div className="stats-grid financas-print-hide">
        <div className="stat-card">
          <span className="touch-helper">Hoje</span>
          <strong>{formatCurrency(totalToday)}</strong>
        </div>
        <div className="stat-card">
          <span className="touch-helper">Este mês</span>
          <strong>{formatCurrency(totalMonth)}</strong>
        </div>
        <div className="stat-card">
          <span className="touch-helper">Período selecionado</span>
          <strong>{formatCurrency(totalRevenue)}</strong>
        </div>
        <div className="stat-card">
          <span className="touch-helper">Ticket médio</span>
          <strong>{formatCurrency(avgTicket)}</strong>
        </div>
        <div className="stat-card">
          <span className="touch-helper">Nº transações</span>
          <strong style={{ fontSize: '1.4rem' }}>{filtered.length}</strong>
        </div>
        {pendingCount > 0 && (
          <div className="stat-card stat-card--pending">
            <span className="touch-helper">Em dívida</span>
            <strong style={{ color: '#c2410c' }}>{formatCurrency(pendingTotal)}</strong>
            <small style={{ color: '#c2410c', fontSize: '0.78rem' }}>{pendingCount} conta{pendingCount !== 1 ? 's' : ''}</small>
          </div>
        )}
      </div>

      {/* Filters */}
      <article className="panel financas-filters financas-print-hide">
        {/* Period presets */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: 'var(--muted)', fontSize: '0.88rem', fontWeight: 600 }}>Período:</span>
          {(['today', 'week', 'month', 'custom'] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={`chip-button${periodPreset === p ? ' is-selected' : ''}`}
              onClick={() => applyPreset(p)}
            >
              {p === 'today' ? 'Hoje' : p === 'week' ? 'Esta semana' : p === 'month' ? 'Este mês' : 'Personalizado'}
            </button>
          ))}
          {periodPreset === 'custom' && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="date"
                className="touch-input"
                style={{ minHeight: 'auto', padding: '0.4rem 0.7rem', width: '155px' }}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span style={{ color: 'var(--muted)' }}>até</span>
              <input
                type="date"
                className="touch-input"
                style={{ minHeight: 'auto', padding: '0.4rem 0.7rem', width: '155px' }}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.75rem', alignItems: 'flex-end' }}>
          {/* Search */}
          <div style={{ display: 'grid', gap: '0.35rem', flex: '1 1 200px' }}>
            <label className="touch-label">Pesquisar cliente / descrição</label>
            <input
              className="touch-input"
              placeholder="Nome, mesa, matrícula..."
              value={search}
              style={{ minHeight: '2.8rem' }}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Dept filter */}
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <span className="touch-label">Departamento</span>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {DEPTS_FILTER.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`chip-button${deptFilter === d ? ' is-selected' : ''}`}
                  style={d !== 'Todos' && deptFilter === d ? { color: DEPT[d]?.color, borderColor: `${DEPT[d]?.color}44` } : {}}
                  onClick={() => setDeptFilter(d)}
                >
                  {d === 'Todos' ? 'Todos' : DEPT[d]?.label}
                </button>
              ))}
            </div>
          </div>

          {/* Method filter */}
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <span className="touch-label">Pagamento</span>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`chip-button${methodFilter === m ? ' is-selected' : ''}`}
                  onClick={() => setMethodFilter(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Status filter */}
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <span className="touch-label">Estado</span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {([['all', 'Todos'], ['completed', 'Pagos'], ['pending', 'Em dívida']] as const).map(([v, lbl]) => (
                <button
                  key={v}
                  type="button"
                  className={`chip-button${statusFilter === v ? ' is-selected' : ''}${v === 'pending' ? ' chip-button--credit' : ''}`}
                  onClick={() => setStatusFilter(v)}
                >
                  {lbl}
                  {v === 'pending' && pendingCount > 0 && ` (${pendingCount})`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </article>

      {/* Transaction list */}
      <article className="panel">
        {/* Print header (only shows when printing) */}
        <div className="financas-print-header">
          <h2 style={{ margin: '0 0 0.25rem' }}>O Capitão · Relatório Financeiro</h2>
          <p style={{ margin: 0, color: 'var(--muted)' }}>
            {dateFrom} — {dateTo} · Gerado em {new Date().toLocaleDateString('pt-PT')}
          </p>
        </div>

        <div className="panel-head">
          <h4>Transações</h4>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span className="chip">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
            <strong style={{ color: 'var(--accent)' }}>{formatCurrency(totalRevenue)}</strong>
          </div>
        </div>

        {/* Table header */}
        <div className="financas-table-head">
          <span>Hora</span>
          <span>Cliente / Mesa</span>
          <span>Departamento</span>
          <span>Itens</span>
          <span>Pagamento</span>
          <span style={{ textAlign: 'right' }}>Total</span>
          <span />
        </div>

        {/* Table rows */}
        <div className="financas-table-body">
          {filtered.length === 0 ? (
            <p className="empty-state" style={{ padding: '2rem 0' }}>
              Nenhuma transação encontrada para os filtros selecionados.
            </p>
          ) : (
            filtered
              .slice()
              .sort((a, b) => b.created_at - a.created_at)
              .map((txn) => {
                const dept = DEPT[txn.source] ?? { label: txn.source, color: '#666' }
                return (
                  <div key={txn.id} className="financas-table-row">
                    <div className="financas-cell financas-cell--time">
                      <strong>{formatTime(txn.created_at)}</strong>
                      <small>{formatDate(txn.created_at)}</small>
                    </div>
                    <div className="financas-cell">
                      <strong>{txn.label}</strong>
                      {txn.discount > 0 && (
                        <small style={{ color: 'var(--success)' }}>Desconto: {formatCurrency(txn.discount)}</small>
                      )}
                    </div>
                    <div className="financas-cell">
                      <span
                        className="financas-dept-badge"
                        style={{ background: `${dept.color}18`, color: dept.color, borderColor: `${dept.color}30` }}
                      >
                        {dept.label}
                      </span>
                    </div>
                    <div className="financas-cell financas-cell--items">
                      {itemsSummary(txn)}
                    </div>
                    <div className="financas-cell" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span className="chip" style={{ fontSize: '0.78rem', padding: '0.2rem 0.6rem', alignSelf: 'flex-start' }}>
                        {txn.payment_method}
                      </span>
                      {txn.status === 'pending' && (
                        <span className="financas-pending-badge">EM DÍVIDA</span>
                      )}
                    </div>
                    <div className="financas-cell financas-cell--total">
                      <strong style={txn.status === 'pending' ? { color: '#c2410c' } : undefined}>{formatCurrency(txn.total)}</strong>
                    </div>
                    <div className="financas-cell financas-print-hide">
                      <button
                        type="button"
                        className="ghost-button"
                        style={{ padding: '0.3rem 0.7rem', fontSize: '0.85rem' }}
                        onClick={() => { setReceipt(null); setSelectedTxn(txn) }}
                      >
                        Ver
                      </button>
                    </div>
                  </div>
                )
              })
          )}
        </div>

        {/* Summary row */}
        {filtered.length > 0 && (
          <div className="financas-summary-row">
            <span>{filtered.length} transaç{filtered.length !== 1 ? 'ões' : 'ão'}</span>
            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent)' }}>
              Total: {formatCurrency(totalRevenue)}
            </span>
          </div>
        )}
      </article>

      {/* Bottom breakdown */}
      {filtered.length > 0 && (
        <div className="content-grid two-columns financas-print-hide">
          <article className="panel">
            <div className="panel-head">
              <h4>Por departamento</h4>
            </div>
            <div className="detail-list" style={{ marginTop: '0.5rem' }}>
              {Object.entries(byDept).map(([dept, total]) => {
                const info = DEPT[dept] ?? { label: dept, color: '#666' }
                return (
                  <div key={dept} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.7rem 0', borderBottom: '1px solid var(--line)' }}>
                    <span
                      className="financas-dept-badge"
                      style={{ background: `${info.color}18`, color: info.color, borderColor: `${info.color}30` }}
                    >
                      {info.label}
                    </span>
                    <strong>{formatCurrency(total)}</strong>
                  </div>
                )
              })}
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <h4>Por método de pagamento</h4>
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              {Object.entries(byMethod).map(([method, total]) => (
                <div key={method} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.7rem 0', borderBottom: '1px solid var(--line)' }}>
                  <span>{method}</span>
                  <strong>{formatCurrency(total)}</strong>
                </div>
              ))}
            </div>
          </article>
        </div>
      )}
    </section>
  )
}
