import { useState } from 'react'

import { CalculatorModal } from '../../components/modals/CalculatorModal'
import { PaymentModal } from '../../components/modals/PaymentModal'
import { ClientAutocomplete } from '../../components/shared/ClientAutocomplete'
import { SplitMergeModal } from '../../components/modals/SplitMergeModal'
import { formatCurrency, toNumber } from '../../lib/formatters'
import { useSessionManager } from '../../lib/useSessionManager'
import type { Appointment, Customer, EmployeeRecord, PosCartItem, Product, Service, Transaction, Vehicle } from '../../types/models'

interface CarwashViewProps {
  accessToken: string
  appointments: Appointment[]
  customers: Customer[]
  products: Product[]
  services: Service[]
  vehicles: Vehicle[]
  employees: EmployeeRecord[]
  onTransactionComplete: (transaction: Transaction) => Promise<void>
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
  accessToken,
  customers,
  products,
  services,
  vehicles,
  employees,
  onTransactionComplete,
}: CarwashViewProps) {
  const sm = useSessionManager('carwash', accessToken)
  const [search, setSearch] = useState('')
  const [showCalc, setShowCalc] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [splitMode, setSplitMode] = useState<'split' | 'merge' | null>(null)
  const [editingLabel, setEditingLabel] = useState<string | null>(null)
  const [labelDraft, setLabelDraft] = useState('')

  const activeServices = services.filter((s) => s.department === 'carwash' && s.active)
  const activeProducts = products.filter((p) => p.department === 'carwash' && p.active && p.item_type === 'resale')

  const serviceGroups = activeServices.reduce<Record<string, Service[]>>((acc, s) => {
    const key = s.subcategory ? `${s.category} / ${s.subcategory}` : s.category
    ;(acc[key] ??= []).push(s)
    return acc
  }, {})

  const categories = [
    ...Object.entries(serviceGroups).map(([label, items]) => ({ key: `service:${label}`, label, count: items.length })),
    ...(activeProducts.length > 0 ? [{ key: 'products', label: 'Produtos', count: activeProducts.length }] : []),
  ]
  const [selectedCategory, setSelectedCategory] = useState('')
  const currentCategory = categories.some((category) => category.key === selectedCategory)
    ? selectedCategory
    : categories[0]?.key ?? ''

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

  async function handleConfirmPayment(method: string, discount: number, _received: number) {
    const base = sm.active.vehiclePlate
      ? `${sm.active.vehiclePlate}`
      : sm.active.label
    const displayLabel = sm.active.clientName ? `${base} — ${sm.active.clientName}` : base

    const t: Transaction = {
      id: `txn-cw-${Date.now()}`,
      operational_session_id: sm.active.id,
      customer_name: sm.active.clientName,
      customer_id: sm.active.customerId,
      vehicle_id: sm.active.vehicleId,
      responsible_employee_id: sm.active.responsibleId,
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
    await onTransactionComplete(t)
    sm.closeSession(sm.activeId)
    setShowPayment(false)
  }

  function getPaymentLabel() {
    const base = sm.active.vehiclePlate || sm.active.label
    return sm.active.clientName ? `${base} — ${sm.active.clientName}` : base
  }

  const selectedServiceGroup = currentCategory.startsWith('service:')
    ? currentCategory.slice('service:'.length)
    : ''
  const visibleServices = selectedServiceGroup
    ? (serviceGroups[selectedServiceGroup] ?? []).filter((service) => filteredServices.some((item) => item.id === service.id))
    : []
  const visibleProducts = currentCategory === 'products' ? filteredProducts : []

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
            <div className="dept-category-strip" aria-label="Categorias">
              {categories.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  className={`dept-category-card ${catTone(category.label)}${currentCategory === category.key ? ' is-active' : ''}`}
                  onClick={() => setSelectedCategory(category.key)}
                >
                  <strong>{category.label}</strong>
                  <span>{category.count} {category.count === 1 ? 'item' : 'itens'}</span>
                </button>
              ))}
            </div>

            {currentCategory && (
              <div className="dept-catalog-section">
                <h4 className="dept-catalog-section__title">
                  {categories.find((category) => category.key === currentCategory)?.label}
                </h4>
                <div className="dept-product-list">
                  {visibleServices.map((service) => (
                    <button key={service.id} type="button" className="dept-product-list__item" onClick={() => addService(service)}>
                      <span className={`dept-product-list__icon ${catTone(selectedServiceGroup)}`}>🚗</span>
                      <span className="dept-product-list__details">
                        <strong>{service.name}</strong>
                        {service.duration_minutes > 0 && <small>{service.duration_minutes} min</small>}
                      </span>
                      <strong className="dept-product-list__price">{formatCurrency(toNumber(service.price))}</strong>
                      <span className="dept-product-list__add">+</span>
                    </button>
                  ))}
                  {visibleProducts.map((product) => (
                    <button key={product.id} type="button" className="dept-product-list__item" onClick={() => addProduct(product)}>
                      <span className={`dept-product-list__icon ${catTone(product.category_name || product.category || 'Produtos')}`}>
                        <img
                          src={product.image_url || '/branding/placeholders/product-default.svg'}
                          alt=""
                          onError={(e) => { ;(e.target as HTMLImageElement).src = '/branding/placeholders/product-default.svg' }}
                        />
                      </span>
                      <span className="dept-product-list__details">
                        <strong>{product.name}</strong>
                        <small>{toNumber(product.stock_quantity) > 0 ? `Stock: ${product.stock_quantity}` : 'Sem stock'}</small>
                      </span>
                      <strong className="dept-product-list__price">{formatCurrency(toNumber(product.sale_price))}</strong>
                      <span className="dept-product-list__add">+</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {visibleServices.length === 0 && visibleProducts.length === 0 && search && (
              <p style={{ color: 'var(--muted)', padding: '1rem' }}>Sem resultados para "{search}".</p>
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
            <select className="touch-input" value={sm.active.vehicleId ?? ''} onChange={(e) => {
              const vehicle = vehicles.find((item) => item.id === e.target.value)
              sm.setMeta(sm.activeId, { vehicleId: vehicle?.id, vehiclePlate: vehicle?.registration_number ?? '', customerId: vehicle?.customer_id, clientName: vehicle?.customer_name ?? '' })
            }}>
              <option value="">Selecionar viatura cadastrada</option>
              {vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.registration_number || 'Sem matrícula'} · {vehicle.brand} {vehicle.model} · {vehicle.customer_name}</option>)}
            </select>
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
              onChange={(name, customer) => sm.setMeta(sm.activeId, { clientName: name, customerId: customer?.id })}
              customers={customers}
              placeholder="Nome do cliente (opcional)"
              className="mt-4"
            />
            <select className="touch-input" value={sm.active.responsibleId ?? ''} onChange={(e) => sm.setMeta(sm.activeId, { responsibleId: e.target.value || undefined })}>
              <option value="">Técnico responsável</option>
              {employees.filter(e => e.is_active_employee && (e.department === 'carwash' || e.department === 'management')).map(e => <option key={e.id} value={e.id}>{e.user.display_name || e.user.email}</option>)}
            </select>
            <select className="touch-input" value={sm.active.status ?? 'waiting'} onChange={(e) => sm.setMeta(sm.activeId, { status: e.target.value as typeof sm.active.status })}><option value="waiting">Aguardando</option><option value="in_progress">Em lavagem</option><option value="paused">Pausada</option><option value="ready">Pronta</option><option value="awaiting_payment">Aguardando pagamento</option></select>
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
