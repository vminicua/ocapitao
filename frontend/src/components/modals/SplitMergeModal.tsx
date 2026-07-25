import { useState } from 'react'

import { formatCurrency } from '../../lib/formatters'
import type { DeptKind, Session } from '../../lib/useSessionManager'

const DEPT_COLORS: Record<DeptKind, string> = {
  bar: '#d97706',
  barbershop: '#1f5fbf',
  carwash: '#1f9d6d',
}

const DEPT_LABELS: Record<DeptKind, string> = {
  bar: 'Bar',
  barbershop: 'Barbershop',
  carwash: 'Carwash',
}

interface CrossDeptEntry {
  dept: DeptKind
  label: string
  session: Session
}

interface SplitMergeModalProps {
  mode: 'split' | 'merge'
  active: Session
  sessions: Session[]
  crossDeptSessions?: CrossDeptEntry[]
  onSplit: (uids: string[]) => void
  onMerge: (sourceIds: string[]) => void
  onMergeCross?: (dept: DeptKind, sessionId: string) => void
  onClose: () => void
}

export function SplitMergeModal({
  mode,
  active,
  sessions,
  crossDeptSessions = [],
  onSplit,
  onMerge,
  onMergeCross,
  onClose,
}: SplitMergeModalProps) {
  const [selectedUids, setSelectedUids] = useState<string[]>([])
  const [selectedSessions, setSelectedSessions] = useState<string[]>([])
  const [selectedCross, setSelectedCross] = useState<Array<{ dept: DeptKind; id: string }>>([])

  const otherSessions = sessions.filter((s) => s.id !== active.id)
  const hasCross = crossDeptSessions.length > 0

  function toggleUid(uid: string) {
    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((u) => u !== uid) : [...prev, uid],
    )
  }

  function toggleSession(id: string) {
    setSelectedSessions((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  function toggleCross(dept: DeptKind, id: string) {
    setSelectedCross((prev) => {
      const exists = prev.some((e) => e.dept === dept && e.id === id)
      return exists
        ? prev.filter((e) => !(e.dept === dept && e.id === id))
        : [...prev, { dept, id }]
    })
  }

  function isCrossSelected(dept: DeptKind, id: string) {
    return selectedCross.some((e) => e.dept === dept && e.id === id)
  }

  function confirm() {
    if (mode === 'split') {
      onSplit(selectedUids)
    } else {
      if (selectedSessions.length > 0) onMerge(selectedSessions)
      if (selectedCross.length > 0 && onMergeCross) {
        for (const { dept, id } of selectedCross) {
          onMergeCross(dept, id)
        }
      }
    }
  }

  const totalSelected = selectedSessions.length + selectedCross.length

  const canConfirm =
    mode === 'split'
      ? selectedUids.length > 0 && selectedUids.length < active.items.length
      : totalSelected > 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">{active.label}</p>
            <h3 className="section-title" style={{ margin: 0 }}>
              {mode === 'split' ? 'Dividir conta' : 'Juntar contas'}
            </h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        {mode === 'split' ? (
          <>
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginBottom: '0.5rem' }}>
              Selecione os itens a mover para uma nova conta:
            </p>
            <div className="split-items-list">
              {active.items.map((item) => (
                <label
                  key={item.uid}
                  className={`split-item-row${selectedUids.includes(item.uid) ? ' is-selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedUids.includes(item.uid)}
                    onChange={() => toggleUid(item.uid)}
                  />
                  <span className="split-item-name">{item.label}</span>
                  <span className="split-item-qty">×{item.quantity}</span>
                  <span className="split-item-price">{formatCurrency(item.price * item.quantity)}</span>
                </label>
              ))}
            </div>
            {selectedUids.length > 0 && (
              <p className="split-hint">{selectedUids.length} item(s) irão para uma nova conta.</p>
            )}
          </>
        ) : (
          <>
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginBottom: '0.5rem' }}>
              Selecione as contas a juntar em <strong>{active.label}</strong>:
            </p>

            {/* Same-dept sessions */}
            {otherSessions.length > 0 && (
              <div className="split-merge-section">
                {(hasCross) && <p className="split-merge-section__label">Mesmo departamento</p>}
                <div className="split-items-list">
                  {otherSessions.map((s) => (
                    <label
                      key={s.id}
                      className={`split-item-row${selectedSessions.includes(s.id) ? ' is-selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSessions.includes(s.id)}
                        onChange={() => toggleSession(s.id)}
                      />
                      <span className="split-item-name">
                        {s.label}{s.clientName ? ` — ${s.clientName}` : ''}
                      </span>
                      <span className="split-item-qty">{s.items.length} itens</span>
                      <span className="split-item-price">
                        {formatCurrency(s.items.reduce((t, i) => t + i.price * i.quantity, 0))}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Cross-dept sessions */}
            {hasCross && (
              <div className="split-merge-section" style={{ marginTop: otherSessions.length > 0 ? '0.85rem' : 0 }}>
                <p className="split-merge-section__label">Outros departamentos</p>
                <div className="split-items-list">
                  {crossDeptSessions.map(({ dept, session }) => (
                    <label
                      key={`${dept}-${session.id}`}
                      className={`split-item-row${isCrossSelected(dept, session.id) ? ' is-selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isCrossSelected(dept, session.id)}
                        onChange={() => toggleCross(dept, session.id)}
                      />
                      <span className="split-item-name">
                        <span
                          className="split-dept-badge"
                          style={{ color: DEPT_COLORS[dept], borderColor: `${DEPT_COLORS[dept]}40` }}
                        >
                          {DEPT_LABELS[dept]}
                        </span>
                        {session.label}{session.clientName ? ` — ${session.clientName}` : ''}
                        {session.vehiclePlate ? ` · ${session.vehiclePlate}` : ''}
                      </span>
                      <span className="split-item-qty">{session.items.length} itens</span>
                      <span className="split-item-price">
                        {formatCurrency(session.items.reduce((t, i) => t + i.price * i.quantity, 0))}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {otherSessions.length === 0 && !hasCross && (
              <p style={{ color: 'var(--muted)' }}>Não há outras contas abertas.</p>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <button type="button" className="ghost-button" onClick={onClose} style={{ flex: 1 }}>
            Cancelar
          </button>
          <button
            type="button"
            className="primary-button"
            style={{ flex: 2 }}
            disabled={!canConfirm}
            onClick={confirm}
          >
            {mode === 'split' ? 'Dividir' : `Juntar ${totalSelected > 0 ? `(${totalSelected})` : ''} conta${totalSelected !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
