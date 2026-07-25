import { useEffect, useRef, useState } from 'react'

import type { PosCartItem } from '../types/models'

export interface Session {
  id: string
  label: string
  clientName?: string
  phone?: string
  vehiclePlate?: string
  items: PosCartItem[]
  discount: number
  created_at: number
}

export type DeptKind = 'bar' | 'barbershop' | 'carwash'

const LABELS: Record<DeptKind, string> = { bar: 'Mesa', barbershop: 'Cadeira', carwash: 'Viatura' }

let _gid = 0
function gid(dept: string) { return `${dept}-${Date.now()}-${++_gid}` }

function extractMaxN(sessions: Session[], prefix: string): number {
  let max = sessions.length
  for (const s of sessions) {
    const m = s.label.match(new RegExp(`^${prefix} (\\d+)$`))
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return max + 1
}

interface StoredData {
  sessions: Session[]
  activeId: string
}

function load(dept: DeptKind): StoredData {
  try {
    const raw = localStorage.getItem(`dept-sessions-${dept}`)
    if (raw) {
      const parsed = JSON.parse(raw) as StoredData
      if (Array.isArray(parsed?.sessions) && parsed.sessions.length > 0) {
        // Ensure discount field exists (migration for old data)
        const sessions = parsed.sessions.map((s) => ({ discount: 0, ...s }))
        return { sessions, activeId: parsed.activeId ?? sessions[0].id }
      }
    }
  } catch {}
  const id = gid(dept)
  const first: Session = {
    id,
    label: `${LABELS[dept]} 1`,
    items: [],
    discount: 0,
    created_at: Date.now(),
  }
  return { sessions: [first], activeId: id }
}

function save(dept: DeptKind, data: StoredData) {
  try {
    localStorage.setItem(`dept-sessions-${dept}`, JSON.stringify(data))
  } catch {}
}

export function useSessionManager(dept: DeptKind) {
  const initial = useRef(load(dept))
  const counterRef = useRef(extractMaxN(initial.current.sessions, LABELS[dept]))

  const [sessions, setSessions] = useState<Session[]>(initial.current.sessions)
  const [activeId, setActiveId] = useState<string>(initial.current.activeId)

  // Persist on every change
  useEffect(() => {
    save(dept, { sessions, activeId })
  }, [dept, sessions, activeId])

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0]

  function sessionTotal(s: Session) {
    const sub = s.items.reduce((t, i) => t + i.price * i.quantity, 0)
    return Math.max(0, sub - s.discount)
  }

  function sessionSubtotal(s: Session) {
    return s.items.reduce((t, i) => t + i.price * i.quantity, 0)
  }

  function addSession(extra?: Partial<Omit<Session, 'id' | 'created_at' | 'items' | 'discount'>>) {
    const n = counterRef.current++
    const s: Session = {
      id: gid(dept),
      label: extra?.label ?? `${LABELS[dept]} ${n}`,
      items: [],
      discount: 0,
      created_at: Date.now(),
      ...extra,
    }
    setSessions((prev) => [...prev, s])
    setActiveId(s.id)
    return s.id
  }

  function closeSession(id: string) {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id)
      if (next.length === 0) {
        const fresh: Session = {
          id: gid(dept),
          label: `${LABELS[dept]} 1`,
          items: [],
          discount: 0,
          created_at: Date.now(),
        }
        counterRef.current = 2
        setActiveId(fresh.id)
        return [fresh]
      }
      if (id === activeId) setActiveId(next[0].id)
      return next
    })
  }

  function renameSession(id: string, label: string) {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, label } : s)))
  }

  function setMeta(id: string, meta: Partial<Pick<Session, 'clientName' | 'phone' | 'vehiclePlate'>>) {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...meta } : s)))
  }

  function setDiscount(id: string, discount: number) {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, discount: Math.max(0, discount) } : s)),
    )
  }

  function addItem(sessionId: string, incoming: PosCartItem) {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s
        const key = incoming.product_id ?? incoming.service_id ?? incoming.label
        const existing = s.items.find(
          (i) => (i.product_id ?? i.service_id ?? i.label) === key,
        )
        if (existing) {
          return {
            ...s,
            items: s.items.map((i) =>
              i.uid === existing.uid ? { ...i, quantity: i.quantity + 1 } : i,
            ),
          }
        }
        const newItem: PosCartItem = { ...incoming, uid: `${sessionId}-${key}-${Date.now()}` }
        return { ...s, items: [...s.items, newItem] }
      }),
    )
  }

  function adjustQty(sessionId: string, uid: string, delta: number) {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s
        return {
          ...s,
          items: s.items
            .map((i) => (i.uid === uid ? { ...i, quantity: i.quantity + delta } : i))
            .filter((i) => i.quantity > 0),
        }
      }),
    )
  }

  function removeItem(sessionId: string, uid: string) {
    setSessions((prev) =>
      prev.map((s) =>
        s.id !== sessionId ? s : { ...s, items: s.items.filter((i) => i.uid !== uid) },
      ),
    )
  }

  function splitSession(sessionId: string, uids: string[]) {
    if (uids.length === 0) return
    const source = sessions.find((s) => s.id === sessionId)
    if (!source) return
    const moving = source.items.filter((i) => uids.includes(i.uid))
    const staying = source.items.filter((i) => !uids.includes(i.uid))
    const n = counterRef.current++
    const newId = gid(dept)
    setSessions((prev) => [
      ...prev.map((s) => (s.id === sessionId ? { ...s, items: staying } : s)),
      { id: newId, label: `${LABELS[dept]} ${n}`, items: moving.map((i) => ({ ...i, uid: `sp-${i.uid}` })), discount: 0, created_at: Date.now() },
    ])
    setActiveId(newId)
  }

  function mergeSessions(targetId: string, sourceIds: string[]) {
    if (sourceIds.length === 0) return
    setSessions((prev) => {
      const target = prev.find((s) => s.id === targetId)
      if (!target) return prev
      const sources = prev.filter((s) => sourceIds.includes(s.id))
      const merged = [...target.items]
      for (const src of sources) {
        for (const item of src.items) {
          const k = item.product_id ?? item.service_id ?? item.label
          const exist = merged.find((i) => (i.product_id ?? i.service_id ?? i.label) === k)
          if (exist) {
            const idx = merged.indexOf(exist)
            merged[idx] = { ...exist, quantity: exist.quantity + item.quantity }
          } else {
            merged.push({ ...item, uid: `mg-${item.uid}-${Date.now()}` })
          }
        }
      }
      return prev
        .filter((s) => !sourceIds.includes(s.id))
        .map((s) => (s.id === targetId ? { ...s, items: merged } : s))
    })
    setActiveId(targetId)
  }

  /** Pull items from a session in another department into the current active session. */
  function crossDeptMerge(sourceDept: DeptKind, sourceSessionId: string) {
    const storageKey = `dept-sessions-${sourceDept}`
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return
      const stored = JSON.parse(raw) as StoredData
      const src = stored.sessions.find((s) => s.id === sourceSessionId)
      if (!src || src.items.length === 0) return

      // Absorb items into current active session
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeId) return s
          const merged = [...s.items]
          for (const item of src.items) {
            const k = item.product_id ?? item.service_id ?? item.label
            const exist = merged.find((i) => (i.product_id ?? i.service_id ?? i.label) === k)
            if (exist) {
              const idx = merged.indexOf(exist)
              merged[idx] = { ...exist, quantity: exist.quantity + item.quantity }
            } else {
              merged.push({ ...item, uid: `xd-${item.uid}-${Date.now()}` })
            }
          }
          return { ...s, items: merged }
        }),
      )

      // Remove session from source dept in localStorage
      const remaining = stored.sessions.filter((s) => s.id !== sourceSessionId)
      if (remaining.length === 0) {
        const newId = gid(sourceDept)
        save(sourceDept, {
          sessions: [{ id: newId, label: `${LABELS[sourceDept]} 1`, items: [], discount: 0, created_at: Date.now() }],
          activeId: newId,
        })
      } else {
        save(sourceDept, {
          sessions: remaining,
          activeId: stored.activeId === sourceSessionId ? remaining[0].id : stored.activeId,
        })
      }
    } catch {}
  }

  /** Read sessions with items from other departments (snapshot from localStorage). */
  function getOtherDeptSessions(): Array<{ dept: DeptKind; label: string; session: Session }> {
    const others = (['bar', 'barbershop', 'carwash'] as DeptKind[]).filter((d) => d !== dept)
    const result: Array<{ dept: DeptKind; label: string; session: Session }> = []
    for (const d of others) {
      try {
        const raw = localStorage.getItem(`dept-sessions-${d}`)
        if (!raw) continue
        const stored = JSON.parse(raw) as StoredData
        for (const s of stored.sessions) {
          if (s.items.length > 0) result.push({ dept: d, label: LABELS[d], session: s })
        }
      } catch {}
    }
    return result
  }

  return {
    sessions,
    activeId,
    active,
    setActiveId,
    addSession,
    closeSession,
    renameSession,
    setMeta,
    setDiscount,
    addItem,
    adjustQty,
    removeItem,
    splitSession,
    mergeSessions,
    crossDeptMerge,
    getOtherDeptSessions,
    sessionTotal,
    sessionSubtotal,
  }
}
