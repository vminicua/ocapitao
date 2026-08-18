import { useDeferredValue, useState } from 'react'

import { CalculatorModal } from '../../components/modals/CalculatorModal'
import { TouchInput } from '../../components/touch/TouchInput'
import { TouchNumberInput } from '../../components/touch/TouchNumberInput'
import { formatCurrency, toNumber } from '../../lib/formatters'
import type { Comanda, Product, Service } from '../../types/models'

interface CartItem {
  uid: string
  label: string
  price: number
  quantity: number
  kind: 'product' | 'service'
  department?: string
  category?: string
  product_id?: string
  has_stock?: boolean
  from_comanda?: string
}

const DEPT: Record<string, { label: string; color: string }> = {
  bar: { label: 'Bar', color: '#d97706' },
  barbershop: { label: 'Barbershop', color: '#1f5fbf' },
  carwash: { label: 'Carwash', color: '#1f9d6d' },
  pos: { label: 'Direto', color: '#66758f' },
}

interface PosViewProps {
  products: Product[]
  services: Service[]
  comandas: Comanda[]
  onCommandaProcessed: (id: string) => void
}

export function PosView({ products, services, comandas, onCommandaProcessed }: PosViewProps) {
  const [search, setSearch] = useState('')
  const [discount, setDiscount] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState('Dinheiro')
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCalc, setShowCalc] = useState(false)
  const deferredSearch = useDeferredValue(search)

  const fullCatalog = [
    ...products
      .filter((p) => p.active && p.item_type === 'resale')
      .map((p) => ({
        id: `prod-${p.id}`,
        product_id: p.id,
        label: p.name,
        price: toNumber(p.sale_price),
        meta: p.category_name || p.category_path || p.category || DEPT[p.department]?.label || p.department,
        kind: 'product' as const,
        department: p.department,
        has_stock: true,
      })),
    ...services
      .filter((s) => s.active)
      .map((s) => ({
        id: `svc-${s.id}`,
        product_id: undefined,
        label: s.name,
        price: toNumber(s.price),
        meta: s.subcategory ? `${s.category} / ${s.subcategory}` : s.category,
        kind: 'service' as const,
        department: s.department,
        has_stock: false,
      })),
  ]
  const catalogGroups = fullCatalog.reduce<Record<string, typeof fullCatalog>>((groups, item) => {
    ;(groups[item.meta] ??= []).push(item)
    return groups
  }, {})
  const categories = Object.entries(catalogGroups).map(([label, items]) => ({ key: label, label, count: items.length }))
  const [selectedCategory, setSelectedCategory] = useState('')
  const currentCategory = categories.some((category) => category.key === selectedCategory)
    ? selectedCategory
    : categories[0]?.key ?? ''
  const catalog = (catalogGroups[currentCategory] ?? []).filter((item) =>
    item.label.toLowerCase().includes(deferredSearch.toLowerCase()),
  )

  function addFromCatalog(item: (typeof catalog)[0]) {
    setCart((prev) => {
      const uid = `direct-${item.id}`
      const existing = prev.find((c) => c.uid === uid)
      if (existing) {
        return prev.map((c) => (c.uid === uid ? { ...c, quantity: c.quantity + 1 } : c))
      }
      return [
        ...prev,
        {
          uid,
          label: item.label,
          price: item.price,
          quantity: 1,
          kind: item.kind,
          department: item.department,
          category: item.meta,
          product_id: item.product_id,
          has_stock: item.has_stock,
        },
      ]
    })
  }

  function loadComanda(comanda: Comanda) {
    const alreadyLoaded = cart.some((c) => c.from_comanda === comanda.id)
    if (alreadyLoaded) return
    const newItems: CartItem[] = comanda.items.map((i) => ({
      uid: `cmd-${comanda.id}-${i.uid}`,
      label: i.label,
      price: i.price,
      quantity: i.quantity,
      kind: i.kind,
      department: i.department,
      category: i.category,
      product_id: i.product_id,
      has_stock: i.has_stock,
      from_comanda: comanda.id,
    }))
    setCart((prev) => [...prev, ...newItems])
    onCommandaProcessed(comanda.id)
  }

  function changeQty(uid: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => (c.uid === uid ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0),
    )
  }

  function removeFromCart(uid: string) {
    setCart((prev) => prev.filter((c) => c.uid !== uid))
  }

  function clearCart() {
    setCart([])
    setDiscount('0')
  }

  function finalizeSale() {
    // TODO: integrate with sale API endpoint to persist + deduct stock
    clearCart()
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const discountAmt = toNumber(discount)
  const total = Math.max(0, subtotal - discountAmt)
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0)

  // Group cart by department for display
  const cartByDept = cart.reduce<Record<string, CartItem[]>>((acc, item) => {
    const key = item.department ?? 'pos'
    acc[key] = [...(acc[key] ?? []), item]
    return acc
  }, {})
  const deptKeys = Object.keys(cartByDept)

  return (
    <section className="module-layout">
      {showCalc && <CalculatorModal onClose={() => setShowCalc(false)} />}

      <div className="module-header">
        <div>
          <p className="eyebrow">Caixa / POS</p>
          <h3 className="section-title">Venda integrada</h3>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {comandas.length > 0 && (
            <span className="chip chip-warn">
              {comandas.length} comanda{comandas.length !== 1 ? 's' : ''} pendente{comandas.length !== 1 ? 's' : ''}
            </span>
          )}
          <span className="chip chip-good">Caixa aberta</span>
          <button type="button" className="ghost-button" onClick={() => setShowCalc(true)}>
            🧮 Calculadora
          </button>
        </div>
      </div>

      {/* Pending comandas */}
      {comandas.length > 0 && (
        <article className="panel">
          <div className="panel-head">
            <h4>Comandas a cobrar</h4>
            <span className="chip chip-warn">{comandas.length} pendente{comandas.length !== 1 ? 's' : ''}</span>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginTop: '0.75rem',
            }}
          >
            {comandas.map((comanda) => {
              const deptInfo = DEPT[comanda.source] ?? { label: comanda.source, color: '#666' }
              const cmdTotal = comanda.items.reduce((s, i) => s + i.price * i.quantity, 0)
              const alreadyIn = cart.some((c) => c.from_comanda === comanda.id)
              return (
                <button
                  key={comanda.id}
                  type="button"
                  className="catalog-card"
                  disabled={alreadyIn}
                  style={{
                    minWidth: '180px',
                    maxWidth: '240px',
                    opacity: alreadyIn ? 0.5 : 1,
                  }}
                  onClick={() => loadComanda(comanda)}
                >
                  <span style={{ color: deptInfo.color, fontWeight: 700 }}>{deptInfo.label}</span>
                  <strong>{comanda.label}</strong>
                  <small>
                    {comanda.items.length} item{comanda.items.length !== 1 ? 's' : ''} ·{' '}
                    {formatCurrency(cmdTotal)}
                  </small>
                  <div className="card-meta">
                    <span style={{ color: alreadyIn ? 'var(--success)' : 'var(--accent)' }}>
                      {alreadyIn ? '✓ No carrinho' : 'Clique para cobrar →'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </article>
      )}

      <div className="content-grid pos-grid">
        {/* Left: catalog */}
        <article className="panel">
          <div className="panel-head">
            <h4>Catálogo direto</h4>
            <span className="chip">{catalog.length} itens</span>
          </div>

          <div className="pos-tools">
            <TouchInput
              label="Pesquisar produto ou serviço"
              value={search}
              onChange={setSearch}
              placeholder="Cerveja, corte, lavagem..."
            />
            <TouchNumberInput
              label="Desconto (MT)"
              value={discount}
              onChange={setDiscount}
              placeholder="0"
            />
          </div>

          <div className="dept-category-strip" aria-label="Categorias" style={{ marginBottom: '1rem' }}>
            {categories.map((category) => (
              <button
                key={category.key}
                type="button"
                className={`dept-category-card${currentCategory === category.key ? ' is-active' : ''}`}
                style={{ background: `${DEPT[catalogGroups[category.key]?.[0]?.department]?.color ?? '#66758f'}1a` }}
                onClick={() => setSelectedCategory(category.key)}
              >
                <strong>{category.label}</strong>
                <span>{category.count} {category.count === 1 ? 'item' : 'itens'}</span>
              </button>
            ))}
          </div>

          <div className="dept-product-list">
            {catalog.map((item) => {
              const deptInfo = DEPT[item.department] ?? { label: item.department, color: '#666' }
              return (
                <button
                  key={item.id}
                  type="button"
                  className="dept-product-list__item"
                  onClick={() => addFromCatalog(item)}
                >
                  <span className="dept-product-list__icon" style={{ background: `${deptInfo.color}1a`, color: deptInfo.color }}>
                    {item.kind === 'service' ? '✦' : '▣'}
                  </span>
                  <span className="dept-product-list__details">
                    <strong>{item.label}</strong>
                    <small style={{ color: deptInfo.color }}>{deptInfo.label}</small>
                  </span>
                  <strong className="dept-product-list__price">{formatCurrency(item.price)}</strong>
                  <span className="dept-product-list__add">+</span>
                </button>
              )
            })}
          </div>

          {catalog.length === 0 && (
            <p className="empty-state">
              {search ? `Sem resultados para "${search}".` : 'Nenhum item disponível.'}
            </p>
          )}
        </article>

        {/* Right: cart */}
        <article className="panel">
          <div className="panel-head">
            <h4>Carrinho da venda</h4>
            <span className="chip">{totalItems} iten{totalItems !== 1 ? 's' : ''}</span>
          </div>

          <div className="cart-list" style={{ minHeight: '220px', maxHeight: '420px', overflowY: 'auto' }}>
            {cart.length === 0 ? (
              <p className="empty-state" style={{ paddingTop: '2rem' }}>
                Carregue uma comanda pendente ou selecione produtos e serviços no catálogo.
              </p>
            ) : (
              deptKeys.map((dept) => {
                const deptInfo = DEPT[dept] ?? { label: dept, color: '#666' }
                const items = cartByDept[dept]
                return (
                  <div key={dept}>
                    {deptKeys.length > 1 && (
                      <div style={{ margin: '0.5rem 0 0.25rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.18rem 0.65rem',
                            borderRadius: '999px',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            background: `${deptInfo.color}1a`,
                            color: deptInfo.color,
                            border: `1px solid ${deptInfo.color}30`,
                          }}
                        >
                          {deptInfo.label}
                        </span>
                      </div>
                    )}
                    {items.map((item) => (
                      <div
                        key={item.uid}
                        className="cart-row"
                        style={{ alignItems: 'center', gap: '0.4rem' }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ display: 'block' }}>{item.label}</strong>
                          <small style={{ color: 'var(--muted)' }}>
                            {item.category}
                            {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                          </small>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            flexShrink: 0,
                          }}
                        >
                          <button
                            type="button"
                            className="ghost-button"
                            style={{ padding: '0.22rem 0.55rem', minWidth: 0, lineHeight: 1 }}
                            onClick={() => changeQty(item.uid, -1)}
                          >
                            −
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            style={{ padding: '0.22rem 0.55rem', minWidth: 0, lineHeight: 1 }}
                            onClick={() => changeQty(item.uid, 1)}
                          >
                            +
                          </button>
                          <span
                            style={{
                              minWidth: '5rem',
                              textAlign: 'right',
                              fontWeight: 600,
                              fontSize: '0.95rem',
                            }}
                          >
                            {formatCurrency(item.price * item.quantity)}
                          </span>
                          <button
                            type="button"
                            className="modal-close"
                            onClick={() => removeFromCart(item.uid)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })
            )}
          </div>

          <div className="summary-box">
            <div>
              <span>Subtotal</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>
            {discountAmt > 0 && (
              <div>
                <span>Desconto</span>
                <strong style={{ color: 'var(--danger)' }}>− {formatCurrency(discountAmt)}</strong>
              </div>
            )}
            <div className="summary-total">
              <span>Total a pagar</span>
              <strong>{formatCurrency(total)}</strong>
            </div>
          </div>

          <div className="chip-group" style={{ marginTop: '1rem' }}>
            {['Dinheiro', 'Cartão', 'M-Pesa', 'Transferência', 'Outro'].map((method) => (
              <button
                key={method}
                type="button"
                className={`chip-button${paymentMethod === method ? ' is-selected' : ''}`}
                onClick={() => setPaymentMethod(method)}
              >
                {method}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              className="ghost-button"
              disabled={cart.length === 0}
              onClick={clearCart}
            >
              Limpar
            </button>
            <button
              type="button"
              className="primary-button"
              style={{ flex: 1 }}
              disabled={cart.length === 0}
              onClick={finalizeSale}
            >
              Finalizar · {formatCurrency(total)}
            </button>
          </div>
        </article>
      </div>
    </section>
  )
}
