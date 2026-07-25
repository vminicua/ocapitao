import { useState } from 'react'

import { CalculatorModal } from '../../components/modals/CalculatorModal'
import { PaymentModal } from '../../components/modals/PaymentModal'
import { ClientAutocomplete } from '../../components/shared/ClientAutocomplete'
import { SplitMergeModal } from '../../components/modals/SplitMergeModal'
import { formatCurrency, toNumber } from '../../lib/formatters'
import { useSessionManager } from '../../lib/useSessionManager'
import type { Customer, PosCartItem, Product, Transaction } from '../../types/models'

interface BarViewProps {
  products: Product[]
  customers: Customer[]
  onTransactionComplete: (transaction: Transaction) => void
}

const CARD_TONES = [
  'tone-lime', 'tone-mint', 'tone-aqua', 'tone-sand',
  'tone-peach', 'tone-lilac', 'tone-sky', 'tone-rose', 'tone-gold',
]
function catTone(cat: string): string {
  let h = 0
  for (const c of cat) h = ((h << 5) - h + c.charCodeAt(0)) | 0
  return CARD_TONES[Math.abs(h) % CARD_TONES.length]
}
function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    ;(acc[key(item)] ??= []).push(item)
    return acc
  }, {})
}

export function BarView({ products, customers, onTransactionComplete }: BarViewProps) {
  const sm = useSessionManager('bar')
  const [search, setSearch] = useState('')
  const [showCalc, setShowCalc] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [splitMode, setSplitMode] = useState<'split' | 'merge' | null>(null)
  const [editingLabel, setEditingLabel] = useState<string | null>(null)
  const [labelDraft, setLabelDraft] = useState('')

  const filtered = search
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : products
  const grouped = groupBy(filtered, (p) => p.category ?? 'Produtos')

  const subtotal = sm.sessionSubtotal(sm.active)
  const activeTotal = sm.sessionTotal(sm.active)
  const totalActive = sm.sessions.reduce((t, s) => t + sm.sessionTotal(s), 0)

  function handleAdd(product: Product) {
    const item: PosCartItem = {
      uid: '',
      product_id: product.id,
      label: product.name,
      category: product.category,
      price: toNumber(product.sale_price),
      kind: 'product',
      department: 'bar',
      has_stock: true,
      quantity: 1,
    }
    sm.addItem(sm.activeId, item)
  }

  function handleConfirmPayment(method: string, discount: number, _received: number) {
    const t: Transaction = {
      id: `txn-bar-${Date.now()}`,
      label: sm.active.clientName
        ? `${sm.active.label} — ${sm.active.clientName}`
        : sm.active.label,
      source: 'bar',
      items: sm.active.items,
      payment_method: method,
      subtotal,
      discount,
      total: Math.max(0, subtotal - discount),
      created_at: Date.now(),
      status: method === 'Crédito' ? 'pending' : 'completed',
    }
    onTransactionComplete(t)
    sm.closeSession(sm.activeId)
    setShowPayment(false)
  }

  return (
    <section className="dept-view">
      <div className="dept-view__header">
        <div>
          <p className="eyebrow">Bar</p>
          <h3 className="section-title" style={{ margin: 0 }}>Atendimento e comendas</h3>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="chip">{sm.sessions.length} mesa{sm.sessions.length !== 1 ? 's' : ''}</span>
          {totalActive > 0 && <span className="chip">{formatCurrency(totalActive)} em aberto</span>}
          <button type="button" className="ghost-button" onClick={() => setShowCalc(true)}>🧮 Calculadora</button>
          <button type="button" className="primary-button" onClick={() => sm.addSession()}>+ Nova Mesa</button>
        </div>
      </div>

      <div className="dept-layout">
        {/* ── Column 1: Sessions ── */}
        <aside className="dept-col dept-sessions-col">
          <div className="dept-sessions-header">
            <span className="dept-sessions-title">Mesas</span>
            <button type="button" className="dept-sessions-new" onClick={() => sm.addSession()}>+ Nova</button>
          </div>
          <div className="dept-sessions-list">
            {sm.sessions.map((session) => {
              const tot = sm.sessionTotal(session)
              const isActive = session.id === sm.activeId
              const sub = sm.sessionSubtotal(session)
              return (
                <button
                  key={session.id}
                  type="button"
                  className={`session-card${isActive ? ' is-active' : ''}${session.items.length === 0 ? '' : ' session-card--has-items'}`}
                  onClick={() => sm.setActiveId(session.id)}
                >
                  <span className="session-card__label">
                    {editingLabel === session.id ? (
                      <input
                        className="session-label-input"
                        value={labelDraft}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setLabelDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { sm.renameSession(session.id, labelDraft); setEditingLabel(null) }
                          if (e.key === 'Escape') setEditingLabel(null)
                        }}
                        onBlur={() => { sm.renameSession(session.id, labelDraft); setEditingLabel(null) }}
                      />
                    ) : (
                      <span
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          setLabelDraft(session.label)
                          setEditingLabel(session.id)
                        }}
                        title="Duplo clique para renomear"
                      >
                        {session.label}
                      </span>
                    )}
                  </span>
                  {session.clientName && <span className="session-card__client">{session.clientName}</span>}
                  <span className="session-card__meta">
                    {session.items.length > 0 ? `${session.items.length} item(s)` : 'Vazia'}
                  </span>
                  {sub > 0 && (
                    <div className="session-card__amounts">
                      {session.discount > 0 && (
                        <span className="session-card__discount">−{formatCurrency(session.discount)}</span>
                      )}
                      <span className="session-card__total">{formatCurrency(tot)}</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </aside>

        {/* ── Column 2: Catalog ── */}
        <main className="dept-col dept-catalog-col">
          <div className="dept-catalog-search">
            <input
              type="search"
              className="touch-input"
              placeholder="Pesquisar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="dept-catalog-body">
            {products.length === 0 ? (
              <p style={{ color: 'var(--muted)', padding: '1rem' }}>Nenhum produto disponível para o bar.</p>
            ) : Object.entries(grouped).map(([cat, prods]) => (
              <div key={cat} className="dept-catalog-section">
                <h4 className="dept-catalog-section__title">{cat}</h4>
                <div className="dept-product-grid">
                  {prods.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`dept-product-card ${catTone(cat)}`}
                      onClick={() => handleAdd(p)}
                    >
                      <div className="dept-product-card__img">
                        <img
                          src={p.image_url || '/branding/placeholders/product-default.svg'}
                          alt=""
                          onError={(e) => { ;(e.target as HTMLImageElement).src = '/branding/placeholders/product-default.svg' }}
                        />
                      </div>
                      <strong className="dept-product-card__name">{p.name}</strong>
                      <span className="dept-product-card__price">{formatCurrency(toNumber(p.sale_price))}</span>
                      {toNumber(p.stock_quantity) > 0 && (
                        <small className="dept-product-card__stock">Stock: {p.stock_quantity}</small>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* ── Column 3: Cart ── */}
        <aside className="dept-col dept-cart-col">
          <div className="dept-cart-header">
            <div className="dept-cart-header__left">
              <strong>{sm.active.label}</strong>
              {sm.active.clientName && <span className="dept-cart-header__client">{sm.active.clientName}</span>}
            </div>
            <div className="dept-cart-header__actions">
              {sm.active.items.length > 1 && (
                <button type="button" className="dept-cart-action-btn" onClick={() => setSplitMode('split')}>Dividir</button>
              )}
              {sm.sessions.length > 1 && (
                <button type="button" className="dept-cart-action-btn" onClick={() => setSplitMode('merge')}>Juntar</button>
              )}
            </div>
          </div>

          <div className="dept-cart-meta">
            <ClientAutocomplete
              value={sm.active.clientName ?? ''}
              onChange={(name) => sm.setMeta(sm.activeId, { clientName: name })}
              customers={customers}
              placeholder="Nome do cliente (opcional)"
            />
          </div>

          <div className="dept-cart-items">
            {sm.active.items.length === 0 ? (
              <p className="dept-cart-empty">Toque num produto para adicionar.</p>
            ) : sm.active.items.map((item) => (
              <div key={item.uid} className="dept-cart-item">
                <div className="dept-cart-item__info">
                  <span className="dept-cart-item__name">{item.label}</span>
                  <span className="dept-cart-item__line-total">{formatCurrency(item.price * item.quantity)}</span>
                </div>
                <div className="dept-cart-item__controls">
                  <button type="button" className="qty-btn qty-btn--minus" onClick={() => sm.adjustQty(sm.activeId, item.uid, -1)}>−</button>
                  <span className="qty-value">{item.quantity}</span>
                  <button type="button" className="qty-btn qty-btn--plus" onClick={() => sm.adjustQty(sm.activeId, item.uid, +1)}>+</button>
                </div>
              </div>
            ))}
          </div>

          <div className="dept-cart-discount">
            <label className="dept-cart-discount__label">Desconto (MT)</label>
            <input
              type="number"
              className="touch-input"
              min="0"
              max={subtotal}
              value={sm.active.discount || ''}
              placeholder="0"
              onChange={(e) => sm.setDiscount(sm.activeId, toNumber(e.target.value))}
              style={{ width: '120px', textAlign: 'right' }}
            />
          </div>

          <div className="dept-cart-footer">
            <div className="dept-cart-total">
              {sm.active.discount > 0 && (
                <div className="dept-cart-subtotal">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
              )}
              {sm.active.discount > 0 && (
                <div className="dept-cart-subtotal dept-cart-subtotal--discount">
                  <span>Desconto</span>
                  <span>−{formatCurrency(sm.active.discount)}</span>
                </div>
              )}
              <div className="dept-cart-total-row">
                <span>Total</span>
                <strong>{formatCurrency(activeTotal)}</strong>
              </div>
            </div>
            <button
              type="button"
              className="dept-pay-btn"
              disabled={sm.active.items.length === 0}
              onClick={() => setShowPayment(true)}
            >
              💳 Pagar
            </button>
            {sm.sessions.length > 1 && sm.active.items.length === 0 && (
              <button
                type="button"
                className="ghost-button"
                style={{ marginTop: '0.4rem', fontSize: '0.82rem' }}
                onClick={() => sm.closeSession(sm.activeId)}
              >
                Fechar mesa
              </button>
            )}
          </div>
        </aside>
      </div>

      {showCalc && <CalculatorModal onClose={() => setShowCalc(false)} />}

      {showPayment && (
        <PaymentModal
          label={sm.active.clientName ? `${sm.active.label} — ${sm.active.clientName}` : sm.active.label}
          source="bar"
          items={sm.active.items}
          initialDiscount={sm.active.discount}
          onConfirm={handleConfirmPayment}
          onClose={() => setShowPayment(false)}
        />
      )}

      {splitMode && (
        <SplitMergeModal
          mode={splitMode}
          active={sm.active}
          sessions={sm.sessions}
          crossDeptSessions={splitMode === 'merge' ? sm.getOtherDeptSessions() : []}
          onSplit={(uids) => { sm.splitSession(sm.activeId, uids); setSplitMode(null) }}
          onMerge={(ids) => { sm.mergeSessions(sm.activeId, ids); setSplitMode(null) }}
          onMergeCross={(dept, id) => { sm.crossDeptMerge(dept, id); setSplitMode(null) }}
          onClose={() => setSplitMode(null)}
        />
      )}
    </section>
  )
}
