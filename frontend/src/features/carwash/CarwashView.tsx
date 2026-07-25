import { useState } from 'react'

import { CalculatorModal } from '../../components/modals/CalculatorModal'
import { PaymentModal } from '../../components/modals/PaymentModal'
import { ClientAutocomplete } from '../../components/shared/ClientAutocomplete'
import { SplitMergeModal } from '../../components/modals/SplitMergeModal'
import { formatCurrency, toNumber } from '../../lib/formatters'
import { useSessionManager } from '../../lib/useSessionManager'
import type { Appointment, Customer, PosCartItem, Product, Service, Transaction, Vehicle } from '../../types/models'

interface CarwashViewProps {
  appointments: Appointment[]
  customers: Customer[]
  products: Product[]
  services: Service[]
  vehicles: Vehicle[]
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

export function CarwashView({
  customers,
  products,
  services,
  onTransactionComplete,
}: CarwashViewProps) {
  const sm = useSessionManager('carwash')
  const [search, setSearch] = useState('')
  const [showCalc, setShowCalc] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [splitMode, setSplitMode] = useState<'split' | 'merge' | null>(null)
  const [editingLabel, setEditingLabel] = useState<string | null>(null)
  const [labelDraft, setLabelDraft] = useState('')

  const activeServices = services.filter((s) => s.department === 'carwash' && s.active)
  const activeProducts = products.filter((p) => p.department === 'carwash')

  const serviceGroups = activeServices.reduce<Record<string, Service[]>>((acc, s) => {
    const key = s.subcategory ? `${s.category} / ${s.subcategory}` : s.category
    ;(acc[key] ??= []).push(s)
    return acc
  }, {})

  const filteredProducts = search
    ? activeProducts.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : activeProducts
  const filteredServices = search
    ? activeServices.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : activeServices

  const subtotal = sm.sessionSubtotal(sm.active)
  const activeTotal = sm.sessionTotal(sm.active)
  const activeSessionCount = sm.sessions.filter((s) => s.items.length > 0).length

  function addService(service: Service) {
    const item: PosCartItem = {
      uid: '',
      service_id: service.id,
      label: service.name,
      category: service.category,
      price: toNumber(service.price),
      kind: 'service',
      department: 'carwash',
      has_stock: false,
      quantity: 1,
    }
    sm.addItem(sm.activeId, item)
  }

  function addProduct(product: Product) {
    const item: PosCartItem = {
      uid: '',
      product_id: product.id,
      label: product.name,
      category: product.category,
      price: toNumber(product.sale_price),
      kind: 'product',
      department: 'carwash',
      has_stock: true,
      quantity: 1,
    }
    sm.addItem(sm.activeId, item)
  }

  function handleConfirmPayment(method: string, discount: number, _received: number) {
    const base = sm.active.vehiclePlate
      ? `${sm.active.vehiclePlate}`
      : sm.active.label
    const displayLabel = sm.active.clientName ? `${base} — ${sm.active.clientName}` : base

    const t: Transaction = {
      id: `txn-cw-${Date.now()}`,
      label: displayLabel,
      source: 'carwash',
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

  function getPaymentLabel() {
    const base = sm.active.vehiclePlate || sm.active.label
    return sm.active.clientName ? `${base} — ${sm.active.clientName}` : base
  }

  const showServiceSection = !search || filteredServices.length > 0
  const showProductSection = !search || filteredProducts.length > 0

  return (
    <section className="dept-view">
      <div className="dept-view__header">
        <div>
          <p className="eyebrow">Carwash</p>
          <h3 className="section-title" style={{ margin: 0 }}>Lavagem de viaturas</h3>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {activeSessionCount > 0 && <span className="chip">{activeSessionCount} viatura{activeSessionCount !== 1 ? 's' : ''} em serviço</span>}
          <button type="button" className="ghost-button" onClick={() => setShowCalc(true)}>🧮 Calculadora</button>
          <button type="button" className="primary-button" style={{ background: '#1f9d6d' }} onClick={() => sm.addSession()}>+ Nova Viatura</button>
        </div>
      </div>

      <div className="dept-layout">
        {/* ── Column 1: Sessions ── */}
        <aside className="dept-col dept-sessions-col">
          <div className="dept-sessions-header">
            <span className="dept-sessions-title">Viaturas</span>
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
                  className={`session-card${isActive ? ' is-active' : ''}${session.items.length > 0 ? ' session-card--has-items' : ''}`}
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
                        onDoubleClick={(e) => { e.stopPropagation(); setLabelDraft(session.label); setEditingLabel(session.id) }}
                        title="Duplo clique para renomear"
                      >
                        {session.vehiclePlate || session.label}
                      </span>
                    )}
                  </span>
                  {session.clientName && <span className="session-card__client">{session.clientName}</span>}
                  {session.vehiclePlate && <span className="session-card__meta session-card__plate">{session.label}</span>}
                  <span className="session-card__meta">{session.items.length > 0 ? `${session.items.length} serviço(s)` : 'Vazia'}</span>
                  {sub > 0 && (
                    <div className="session-card__amounts">
                      {session.discount > 0 && <span className="session-card__discount">−{formatCurrency(session.discount)}</span>}
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
              placeholder="Pesquisar serviço ou produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="dept-catalog-body">
            {showServiceSection && Object.entries(serviceGroups).map(([cat, svcs]) => (
              <div key={cat} className="dept-catalog-section">
                <h4 className="dept-catalog-section__title">{cat}</h4>
                <div className="dept-product-grid">
                  {svcs.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`dept-product-card ${catTone(cat)}`}
                      onClick={() => addService(s)}
                    >
                      <div className="dept-product-card__img dept-product-card__img--svc">🚗</div>
                      <strong className="dept-product-card__name">{s.name}</strong>
                      <span className="dept-product-card__price">{formatCurrency(toNumber(s.price))}</span>
                      {s.duration_minutes && <small className="dept-product-card__stock">{s.duration_minutes} min</small>}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {showProductSection && filteredProducts.length > 0 && (
              <div className="dept-catalog-section">
                <h4 className="dept-catalog-section__title">Produtos</h4>
                <div className="dept-product-grid">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`dept-product-card ${catTone(p.category ?? 'Produtos')}`}
                      onClick={() => addProduct(p)}
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
                      {toNumber(p.stock_quantity) > 0 && <small className="dept-product-card__stock">Stock: {p.stock_quantity}</small>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* ── Column 3: Cart ── */}
        <aside className="dept-col dept-cart-col">
          <div className="dept-cart-header">
            <div className="dept-cart-header__left">
              <strong>{sm.active.vehiclePlate || sm.active.label}</strong>
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
            <input
              type="text"
              className="touch-input"
              placeholder="Matrícula (ex.: AXP-1234)"
              value={sm.active.vehiclePlate ?? ''}
              onChange={(e) => sm.setMeta(sm.activeId, { vehiclePlate: e.target.value.toUpperCase() })}
              style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}
            />
            <ClientAutocomplete
              value={sm.active.clientName ?? ''}
              onChange={(name) => sm.setMeta(sm.activeId, { clientName: name })}
              customers={customers}
              placeholder="Nome do cliente (opcional)"
              className="mt-4"
            />
          </div>

          <div className="dept-cart-items">
            {sm.active.items.length === 0 ? (
              <p className="dept-cart-empty">Selecione serviços a realizar.</p>
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
                <>
                  <div className="dept-cart-subtotal"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                  <div className="dept-cart-subtotal dept-cart-subtotal--discount"><span>Desconto</span><span>−{formatCurrency(sm.active.discount)}</span></div>
                </>
              )}
              <div className="dept-cart-total-row">
                <span>Total</span>
                <strong>{formatCurrency(activeTotal)}</strong>
              </div>
            </div>
            <button
              type="button"
              className="dept-pay-btn dept-pay-btn--carwash"
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
                Fechar viatura
              </button>
            )}
          </div>
        </aside>
      </div>

      {showCalc && <CalculatorModal onClose={() => setShowCalc(false)} />}

      {showPayment && (
        <PaymentModal
          label={getPaymentLabel()}
          source="carwash"
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
