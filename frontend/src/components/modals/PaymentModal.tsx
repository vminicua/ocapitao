import { useEffect, useState } from 'react'

import { formatCurrency, toNumber } from '../../lib/formatters'
import type { PosCartItem } from '../../types/models'

const METHODS = ['Dinheiro', 'Cartão', 'M-Pesa', 'Transferência', 'Crédito', 'Outro']

const DEPT_COLOR: Record<string, string> = {
  bar: '#d97706',
  barbershop: '#1f5fbf',
  carwash: '#1f9d6d',
}
const DEPT_LABEL: Record<string, string> = {
  bar: 'Bar',
  barbershop: 'Barbershop',
  carwash: 'Carwash',
}

interface PaymentModalProps {
  label: string
  source: 'bar' | 'barbershop' | 'carwash'
  items: PosCartItem[]
  initialDiscount?: number
  onConfirm: (method: string, discount: number, received: number) => Promise<void>
  onClose: () => void
}

type Phase = 'input' | 'receipt'

export function PaymentModal({
  label,
  source,
  items,
  initialDiscount = 0,
  onConfirm,
  onClose,
}: PaymentModalProps) {
  const [method, setMethod] = useState('Dinheiro')
  const [discountStr, setDiscountStr] = useState(String(initialDiscount || '0'))
  const [receivedStr, setReceivedStr] = useState('')
  const [note, setNote] = useState('')
  const [phase, setPhase] = useState<Phase>('input')
  const [paidAt, setPaidAt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const discount = Math.min(toNumber(discountStr), subtotal)
  const total = subtotal - discount
  const received = toNumber(receivedStr)
  const troco = method === 'Dinheiro' && received > 0 ? received - total : 0
  const trocoOk = method !== 'Dinheiro' || received <= 0 || received >= total
  const isCredit = method === 'Crédito'

  const deptColor = DEPT_COLOR[source] ?? '#66758f'
  const autoPrint = localStorage.getItem('auto_print_receipt') === 'true'

  const businessName = localStorage.getItem('receipt_business_name') || 'O Capitão'
  const receiptHeader = localStorage.getItem('receipt_header') || ''
  const receiptFooter = localStorage.getItem('receipt_footer') || 'Obrigado pela preferência!'

  const now = paidAt || Date.now()
  const dateStr = new Date(now).toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = new Date(now).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })

  async function handlePay() {
    setSaving(true)
    setError('')
    try {
      await onConfirm(method, discount, received)
      setPaidAt(Date.now())
      setPhase('receipt')
      if (autoPrint && !isCredit) setTimeout(() => window.print(), 200)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível registar o pagamento.')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (phase !== 'receipt') return
    const area = document.getElementById('receipt-print-area')
    if (!area) return
    area.innerHTML = isCredit
      ? `<p>DÍVIDA REGISTADA</p><p>${businessName}</p><p>${label}</p><p>${dateStr} ${timeStr}</p><hr><p>Total: ${formatCurrency(total)}</p>${note ? `<p>Nota: ${note}</p>` : ''}<p>Obrigado.</p>`
      : `<p>${businessName}</p><p>${DEPT_LABEL[source]} · ${dateStr} ${timeStr}</p><p>${label}</p><hr>${items.map((i) => `<div style="display:flex;justify-content:space-between"><span>${i.label} ×${i.quantity}</span><span>${formatCurrency(i.price * i.quantity)}</span></div>`).join('')}<hr>${discount > 0 ? `<div style="display:flex;justify-content:space-between"><span>Desconto</span><span>-${formatCurrency(discount)}</span></div>` : ''}<div style="display:flex;justify-content:space-between;font-weight:700"><span>TOTAL</span><span>${formatCurrency(total)}</span></div><p>${method}</p>${received > 0 ? `<div style="display:flex;justify-content:space-between"><span>Troco</span><span>${formatCurrency(Math.max(0, troco))}</span></div>` : ''}<hr>${receiptFooter ? `<p>${receiptFooter}</p>` : ''}`
  }, [businessName, dateStr, discount, isCredit, items, label, method, note, phase, receiptFooter, received, source, timeStr, total, troco])

  if (phase === 'receipt') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-panel modal-panel--receipt" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <p className="eyebrow" style={{ color: isCredit ? '#c2410c' : deptColor }}>
                {isCredit ? 'Dívida registada' : 'Pagamento concluído'}
              </p>
              <h3 className="section-title" style={{ margin: 0 }}>
                {isCredit ? 'Conta em aberto' : 'Recibo'}
              </h3>
            </div>
            <button type="button" className="modal-close" onClick={onClose}>✕</button>
          </div>

          <div className="receipt-preview">
            {isCredit ? (
              <>
                <div className="receipt-biz">{businessName}</div>
                <div className="receipt-meta">
                  <span>{DEPT_LABEL[source]}</span>
                  <span>{dateStr} {timeStr}</span>
                </div>
                <div className="receipt-label">{label}</div>
                <div className="receipt-divider" />
                {items.map((item) => (
                  <div key={item.uid} className="receipt-item">
                    <span>{item.label} ×{item.quantity}</span>
                    <span>{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
                <div className="receipt-divider" />
                <div className="receipt-item receipt-total">
                  <strong>VALOR EM DÍVIDA</strong>
                  <strong style={{ color: '#c2410c' }}>{formatCurrency(total)}</strong>
                </div>
                {note && <p style={{ fontSize: '0.8rem', color: '#555', textAlign: 'center', margin: '0.3rem 0 0' }}>Nota: {note}</p>}
              </>
            ) : (
              <>
                {receiptHeader && <p className="receipt-header-text">{receiptHeader}</p>}
                <div className="receipt-biz">{businessName}</div>
                <div className="receipt-meta">
                  <span>{DEPT_LABEL[source]}</span>
                  <span>{dateStr} {timeStr}</span>
                </div>
                <div className="receipt-label">{label}</div>
                <div className="receipt-divider" />
                {items.map((item) => (
                  <div key={item.uid} className="receipt-item">
                    <span>{item.label} ×{item.quantity}</span>
                    <span>{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
                <div className="receipt-divider" />
                {discount > 0 && (
                  <div className="receipt-item receipt-item--discount">
                    <span>Desconto</span>
                    <span>−{formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="receipt-item receipt-total">
                  <strong>TOTAL</strong>
                  <strong>{formatCurrency(total)}</strong>
                </div>
                <div className="receipt-item receipt-item--method">
                  <span>Pagamento</span>
                  <span>{method}</span>
                </div>
                {method === 'Dinheiro' && received > 0 && (
                  <>
                    <div className="receipt-item">
                      <span>Recebido</span>
                      <span>{formatCurrency(received)}</span>
                    </div>
                    <div className="receipt-item receipt-item--troco">
                      <strong>Troco</strong>
                      <strong>{formatCurrency(Math.max(0, troco))}</strong>
                    </div>
                  </>
                )}
                <div className="receipt-divider" />
                {receiptFooter && <p className="receipt-footer-text">{receiptFooter}</p>}
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="ghost-button" onClick={onClose} style={{ flex: 1 }}>
              Fechar
            </button>
            {!isCredit && (
              <button type="button" className="primary-button" style={{ flex: 2 }} onClick={() => window.print()}>
                🖨 Imprimir recibo
              </button>
            )}
          </div>
        </div>

        <div id="receipt-print-area" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-panel--payment" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow" style={{ color: deptColor }}>
              {DEPT_LABEL[source]} · Pagamento
            </p>
            <h3 className="section-title" style={{ margin: 0 }}>{label}</h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Items */}
        <div className="pay-items-list">
          {items.map((item) => (
            <div key={item.uid} className="pay-item-row">
              <div className="pay-item-info">
                <span>{item.label}</span>
                {item.quantity > 1 && <small>×{item.quantity} · {formatCurrency(item.price)} cada</small>}
              </div>
              <span className="pay-item-price">{formatCurrency(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>

        {/* Discount */}
        <div className="pay-field">
          <label className="touch-label" htmlFor="pay-discount">Desconto (MT)</label>
          <input
            id="pay-discount"
            type="number"
            className="touch-input"
            min="0"
            max={subtotal}
            value={discountStr}
            onChange={(e) => setDiscountStr(e.target.value)}
            style={{ maxWidth: '160px' }}
          />
        </div>

        {/* Summary */}
        <div className="summary-box">
          <div>
            <span>Subtotal</span>
            <strong>{formatCurrency(subtotal)}</strong>
          </div>
          {discount > 0 && (
            <div>
              <span>Desconto</span>
              <strong style={{ color: 'var(--danger)' }}>−{formatCurrency(discount)}</strong>
            </div>
          )}
          <div className="summary-total">
            <span>{isCredit ? 'Valor em dívida' : 'Total a cobrar'}</span>
            <strong style={{ fontSize: '1.6rem', color: isCredit ? '#c2410c' : undefined }}>{formatCurrency(total)}</strong>
          </div>
        </div>

        {/* Payment method */}
        <div className="pay-field">
          <span className="touch-label">Método de pagamento</span>
          <div className="chip-group">
            {METHODS.map((m) => (
              <button
                key={m}
                type="button"
                className={`chip-button${method === m ? ' is-selected' : ''}${m === 'Crédito' ? ' chip-button--credit' : ''}`}
                onClick={() => setMethod(m)}
              >
                {m === 'Crédito' ? '⚠ Crédito' : m}
              </button>
            ))}
          </div>
        </div>

        {/* Cash change calculator */}
        {method === 'Dinheiro' && (
          <div className="pay-cash-block">
            <div className="pay-field">
              <label className="touch-label" htmlFor="pay-received">Valor recebido (MT)</label>
              <input
                id="pay-received"
                type="number"
                className="touch-input"
                min={total}
                value={receivedStr}
                onChange={(e) => setReceivedStr(e.target.value)}
                placeholder={String(total)}
                style={{ maxWidth: '200px' }}
              />
            </div>
            {received > 0 && (
              <div className={`pay-change-display${troco < 0 ? ' is-negative' : ' is-positive'}`}>
                {troco < 0 ? (
                  <><span>Faltam</span><strong>{formatCurrency(Math.abs(troco))}</strong></>
                ) : (
                  <><span>Troco</span><strong>{formatCurrency(troco)}</strong></>
                )}
              </div>
            )}
          </div>
        )}

        {/* Credit note */}
        {isCredit && (
          <div className="pay-credit-block">
            <div className="pay-field">
              <label className="touch-label" htmlFor="pay-note">Nota / prazo (opcional)</label>
              <input
                id="pay-note"
                type="text"
                className="touch-input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex.: Paga até 15/07"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        {error && <p className="danger-text" role="alert">{error}</p>}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
          <button type="button" className="ghost-button" onClick={onClose} style={{ flex: 1 }} disabled={saving}>
            Cancelar
          </button>
          <button
            type="button"
            className={isCredit ? 'dept-pay-btn dept-pay-btn--credit' : 'primary-button'}
            style={{ flex: 2 }}
            disabled={saving || !trocoOk || items.length === 0}
            onClick={() => void handlePay()}
          >
            {saving ? 'A registar...' : isCredit ? '⚠ Registar dívida' : `✓ Pagar · ${formatCurrency(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
