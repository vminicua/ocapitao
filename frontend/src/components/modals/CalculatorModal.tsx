import { useState } from 'react'

import { formatCurrency } from '../../lib/formatters'

interface HistoryEntry {
  expression: string
  result: string
}

interface CalculatorModalProps {
  onClose: () => void
}

function applyOp(a: number, b: number, op: string): number {
  if (op === '+') return a + b
  if (op === '-') return a - b
  if (op === '×') return a * b
  if (op === '÷') return b !== 0 ? a / b : 0
  return b
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '0'
  const rounded = Math.round(n * 100) / 100
  return String(rounded)
}

export function CalculatorModal({ onClose }: CalculatorModalProps) {
  const [display, setDisplay] = useState('0')
  const [prevValue, setPrevValue] = useState<number | null>(null)
  const [operation, setOperation] = useState<string | null>(null)
  const [waitingForNew, setWaitingForNew] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])

  function addToHistory(expression: string, result: string) {
    setHistory((prev) => [{ expression, result }, ...prev].slice(0, 30))
  }

  function handleDigit(digit: string) {
    if (waitingForNew) {
      setDisplay(digit === '.' ? '0.' : digit)
      setWaitingForNew(false)
    } else {
      if (digit === '.' && display.includes('.')) return
      setDisplay((prev) => (prev === '0' && digit !== '.' ? digit : prev + digit))
    }
  }

  function handleOp(op: string) {
    if (op === '%') {
      const current = Number.parseFloat(display)
      const result = prevValue !== null ? (prevValue * current) / 100 : current / 100
      setDisplay(fmt(result))
      setWaitingForNew(true)
      return
    }
    const current = Number.parseFloat(display)
    if (prevValue !== null && !waitingForNew) {
      const result = applyOp(prevValue, current, operation!)
      setDisplay(fmt(result))
      setPrevValue(result)
    } else {
      setPrevValue(current)
    }
    setOperation(op)
    setWaitingForNew(true)
  }

  function handleEquals() {
    if (prevValue === null || operation === null) return
    const current = Number.parseFloat(display)
    const result = applyOp(prevValue, current, operation)
    const resultStr = fmt(result)
    const expression = `${prevValue} ${operation} ${current}`
    addToHistory(expression, resultStr)
    setDisplay(resultStr)
    setPrevValue(null)
    setOperation(null)
    setWaitingForNew(true)
  }

  function handleClear() {
    setDisplay('0')
    setPrevValue(null)
    setOperation(null)
    setWaitingForNew(false)
  }

  function handleBackspace() {
    if (waitingForNew) return
    setDisplay((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)))
  }

  function applyHistoryResult(result: string) {
    setDisplay(result)
    setPrevValue(null)
    setOperation(null)
    setWaitingForNew(false)
  }

  const displayNum = Number.parseFloat(display)

  type CalcKey = { k: string; t?: 'clear' | 'back' | 'op' | 'eq'; wide?: boolean }
  const rows: CalcKey[][] = [
    [
      { k: 'C', t: 'clear' },
      { k: '⌫', t: 'back' },
      { k: '%', t: 'op' },
      { k: '÷', t: 'op' },
    ],
    [{ k: '7' }, { k: '8' }, { k: '9' }, { k: '×', t: 'op' }],
    [{ k: '4' }, { k: '5' }, { k: '6' }, { k: '-', t: 'op' }],
    [{ k: '1' }, { k: '2' }, { k: '3' }, { k: '+', t: 'op' }],
    [{ k: '0', wide: true }, { k: '.' }, { k: '=', t: 'eq' }],
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel modal-panel--calc-wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Ferramenta</p>
            <h3 className="section-title" style={{ margin: 0 }}>
              Calculadora
            </h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 220px', gap: '1rem' }}>
          {/* Calculator */}
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div className="calc-display">
              <div className="calc-display__expr">
                {prevValue !== null ? `${prevValue} ${operation ?? ''}` : ' '}
              </div>
              <div className="calc-display__number">{display}</div>
              {!Number.isNaN(displayNum) && (
                <div className="calc-display__mt">{formatCurrency(displayNum)}</div>
              )}
            </div>

            <div className="calc-grid">
              {rows.map((row, ri) => (
                <div key={ri} className="calc-row">
                  {row.map(({ k, t, wide }) => (
                    <button
                      key={k}
                      type="button"
                      className={[
                        'calc-key',
                        t === 'op' ? 'calc-key--op' : '',
                        t === 'eq' ? 'calc-key--eq' : '',
                        t === 'clear' ? 'calc-key--clear' : '',
                        wide ? 'calc-key--wide' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => {
                        if (k === 'C') handleClear()
                        else if (k === '⌫') handleBackspace()
                        else if (k === '=') handleEquals()
                        else if (['+', '-', '×', '÷', '%'].includes(k)) handleOp(k)
                        else handleDigit(k)
                      }}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* History panel */}
          <div className="calc-history">
            <div className="calc-history__header">
              <span>Histórico</span>
              {history.length > 0 && (
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--danger)',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  onClick={() => setHistory([])}
                >
                  Limpar
                </button>
              )}
            </div>
            <div className="calc-history__list">
              {history.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '0.82rem', textAlign: 'center', marginTop: '1rem' }}>
                  Os cálculos aparecem aqui.
                </p>
              ) : (
                history.map((entry, i) => (
                  <button
                    key={i}
                    type="button"
                    className="calc-history__entry"
                    title="Clique para usar este resultado"
                    onClick={() => applyHistoryResult(entry.result)}
                  >
                    <span className="calc-history__expr">{entry.expression}</span>
                    <span className="calc-history__result">= {entry.result}</span>
                    <span className="calc-history__mt">{formatCurrency(Number.parseFloat(entry.result))}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
