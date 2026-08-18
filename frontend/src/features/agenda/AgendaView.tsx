import { useMemo, useState } from 'react'

import type { Appointment, Customer, EmployeeRecord, Service } from '../../types/models'

interface Props {
  appointments: Appointment[]
  customers: Customer[]
  employees: EmployeeRecord[]
  services: Service[]
  onSave: (payload: Record<string, unknown>, id?: string) => Promise<unknown>
  onStart: (id: string) => Promise<unknown>
  canManage: boolean
}

const empty = { id: '', department: 'barbershop', customer_id: '', employee_id: '', service_id: '', scheduled_for: '', notes: '', walk_in: false, status: 'scheduled' }

export function AgendaView({ appointments, customers, employees, services, onSave, onStart, canManage }: Props) {
  const [form, setForm] = useState<typeof empty | null>(null)
  const [department, setDepartment] = useState('all')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const filtered = useMemo(() => appointments.filter((item) =>
    (department === 'all' || item.department === department) && item.scheduled_for.slice(0, 10) === selectedDate,
  ), [appointments, department, selectedDate])
  const availableServices = services.filter((item) => item.active && item.department === form?.department)
  const availableEmployees = employees.filter((item) => item.is_active_employee && (item.department === form?.department || item.department === 'management'))

  function edit(item: Appointment) {
    setForm({ id: item.id, department: item.department, customer_id: item.customer_id ?? '', employee_id: item.employee_id ?? '', service_id: item.service_id ?? '', scheduled_for: item.scheduled_for.slice(0, 16), notes: item.notes ?? '', walk_in: item.walk_in, status: item.status })
  }

  async function save() {
    if (!form || !form.customer_id || !form.employee_id || !form.service_id || !form.scheduled_for) return setError('Preencha cliente, responsável, serviço e data.')
    const service = services.find((item) => item.id === form.service_id)
    setBusy(true); setError('')
    try {
      await onSave({ ...form, id: undefined, price: service?.price ?? 0, payment_status: 'pending' }, form.id || undefined)
      setForm(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível guardar a marcação.') }
    finally { setBusy(false) }
  }

  async function start(id: string) {
    setBusy(true); setError('')
    try { await onStart(id) } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível iniciar o atendimento.') }
    finally { setBusy(false) }
  }

  return <section className="module-layout">
    <div className="module-header"><div><p className="eyebrow">Agenda</p><h3 className="section-title">Marcações e atendimentos</h3></div>{canManage && <button className="primary-button" onClick={() => setForm({ ...empty })}>+ Nova marcação</button>}</div>
    <div className="chip-group">
      {['all', 'barbershop', 'carwash'].map((value) => <button key={value} className={`chip-button${department === value ? ' is-selected' : ''}`} onClick={() => setDepartment(value)}>{value === 'all' ? 'Todas' : value === 'barbershop' ? 'Barbershop' : 'Carwash'}</button>)}
      <input className="touch-input" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
    </div>
    {error && <p className="danger-text" role="alert">{error}</p>}
    <article className="panel"><div className="record-list">
      {filtered.map((item) => <div className="record-row" key={item.id}>
        <div className="record-main"><strong>{item.customer_name}</strong><small>{new Date(item.scheduled_for).toLocaleString('pt-MZ')} · {item.service_name} · {item.employee_name || 'Sem responsável'}</small></div>
        <span className="chip">{item.status}</span>
        {canManage && <button className="ghost-button" onClick={() => edit(item)}>Editar</button>}
        {canManage && item.status === 'scheduled' && <button className="primary-button" disabled={busy} onClick={() => void start(item.id)}>Iniciar</button>}
      </div>)}
      {filtered.length === 0 && <p className="empty-state">Nenhuma marcação encontrada.</p>}
    </div></article>
    {form && <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && setForm(null)}><div className="modal-panel">
      <div className="modal-header"><h4>{form.id ? 'Editar marcação' : 'Nova marcação'}</h4><button className="modal-close" onClick={() => setForm(null)}>✕</button></div>
      <div className="form-grid">
        <label className="touch-field"><span className="touch-label">Área</span><select className="touch-input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value, service_id: '', employee_id: '' })}><option value="barbershop">Barbershop</option><option value="carwash">Carwash</option></select></label>
        <label className="touch-field"><span className="touch-label">Cliente</span><select className="touch-input" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}><option value="">Selecione</option>{customers.filter(c => c.active !== false).map(c => <option key={c.id} value={c.id}>{c.full_name} · {c.phone}</option>)}</select></label>
        <label className="touch-field"><span className="touch-label">Responsável</span><select className="touch-input" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}><option value="">Selecione</option>{availableEmployees.map(x => <option key={x.id} value={x.id}>{x.user.display_name || `${x.user.first_name} ${x.user.last_name}`}</option>)}</select></label>
        <label className="touch-field"><span className="touch-label">Serviço</span><select className="touch-input" value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })}><option value="">Selecione</option>{availableServices.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label className="touch-field"><span className="touch-label">Data e hora</span><input className="touch-input" type="datetime-local" value={form.scheduled_for} onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })}/></label>
        <label className="touch-field"><span className="touch-label">Estado</span><select className="touch-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="scheduled">Agendada</option><option value="in_progress">Em atendimento</option><option value="completed">Concluída</option><option value="cancelled">Cancelada</option><option value="no_show">Falta</option></select></label>
        <label className="toggle-card"><input type="checkbox" checked={form.walk_in} onChange={(e) => setForm({ ...form, walk_in: e.target.checked })}/><span>Atendimento sem marcação (walk-in)</span></label>
        <label className="touch-field"><span className="touch-label">Notas</span><textarea className="touch-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}/></label>
      </div>
      {error && <p className="danger-text">{error}</p>}
      <button className="primary-button" disabled={busy} onClick={() => void save()}>{busy ? 'A guardar...' : 'Guardar marcação'}</button>
    </div></div>}
  </section>
}
