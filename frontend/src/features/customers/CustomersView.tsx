import { useState } from 'react'

import { TouchInput } from '../../components/touch/TouchInput'
import { TouchNumberInput } from '../../components/touch/TouchNumberInput'
import { TouchTextarea } from '../../components/touch/TouchTextarea'
import { showErrorAlert, showSuccessToast } from '../../lib/alerts'
import { formatCurrency, formatDateTime } from '../../lib/formatters'
import type { Appointment, Customer, EmployeeRecord, Vehicle } from '../../types/models'

interface CustomersViewProps {
  customers: Customer[]
  appointments: Appointment[]
  vehicles: Vehicle[]
  canManage: boolean
  onSaveCustomer: (payload: Record<string, unknown>, customerId?: string) => Promise<unknown>
  employees: EmployeeRecord[]
  onSaveVehicle: (payload: Record<string, unknown>, vehicleId?: string) => Promise<unknown>
}

interface CustomerFormState {
  id?: string
  full_name: string
  phone: string
  email: string
  address: string
  birth_date: string
  preferred_barber_id: string
  loyalty_points: string
  notes: string
  active: boolean
}

function emptyForm(): CustomerFormState {
  return { full_name: '', phone: '', email: '', address: '', birth_date: '', preferred_barber_id: '', loyalty_points: '0', notes: '', active: true }
}

function buildForm(customer: Customer): CustomerFormState {
  return {
    id: customer.id,
    full_name: customer.full_name,
    phone: customer.phone,
    email: customer.email ?? '', address: customer.address ?? '', birth_date: customer.birth_date ?? '',
    preferred_barber_id: customer.preferred_barber ?? '',
    loyalty_points: String(customer.loyalty_points ?? 0),
    notes: customer.notes ?? '',
    active: customer.active !== false,
  }
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

const PALETTES = [
  'linear-gradient(135deg, #1f5fbf, #17458c)',
  'linear-gradient(135deg, #1f9d6d, #157350)',
  'linear-gradient(135deg, #7c3aed, #5b21b6)',
  'linear-gradient(135deg, #d97706, #b45309)',
  'linear-gradient(135deg, #d93c4a, #b02030)',
  'linear-gradient(135deg, #0891b2, #0e7490)',
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return PALETTES[Math.abs(hash) % PALETTES.length]
}

export function CustomersView({ customers, appointments, vehicles, employees, canManage, onSaveCustomer, onSaveVehicle }: CustomersViewProps) {
  const [search, setSearch] = useState('')
  const [modalForm, setModalForm] = useState<CustomerFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [vehicleForm, setVehicleForm] = useState<{ id?: string; registration_number: string; brand: string; model: string; color: string; notes: string } | null>(null)

  const filtered = customers.filter((c) => {
    const term = search.trim().toLowerCase()
    return !term
      ? true
      : [c.full_name, c.phone, c.notes, c.preferred_barber_name]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(term))
  })

  const totalPoints = customers.reduce((sum, c) => sum + (c.loyalty_points ?? 0), 0)
  const topCustomer = customers.reduce<Customer | null>(
    (top, c) => (!top || (c.loyalty_points ?? 0) > (top.loyalty_points ?? 0) ? c : top),
    null,
  )
  const topPoints = Math.max(...customers.map((c) => c.loyalty_points ?? 0), 1)

  const selectedCustomer = modalForm?.id ? customers.find((c) => c.id === modalForm.id) : null
  const customerAppointments = selectedCustomer
    ? appointments.filter((a) => a.customer_name === selectedCustomer.full_name)
    : []
  const customerVehicles = selectedCustomer
    ? vehicles.filter((v) => v.customer_name === selectedCustomer.full_name)
    : []

  async function handleSave() {
    if (!modalForm) return
    if (!modalForm.full_name.trim() || !modalForm.phone.trim()) {
      void showErrorAlert('Dados em falta', 'Nome e telefone são obrigatórios.')
      return
    }
    setSaving(true)
    try {
      await onSaveCustomer(
        {
          full_name: modalForm.full_name.trim(),
          phone: modalForm.phone.trim(),
          email: modalForm.email.trim(), address: modalForm.address.trim(), birth_date: modalForm.birth_date || null,
          preferred_barber_id: modalForm.preferred_barber_id || null,
          loyalty_points: modalForm.loyalty_points,
          notes: modalForm.notes.trim(),
          active: modalForm.active,
        },
        modalForm.id,
      )
      setModalForm(null)
      void showSuccessToast('Cliente guardado com sucesso.')
    } catch (error) {
      console.error(error)
      void showErrorAlert('Falha ao guardar cliente', 'Verifique os dados e tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  async function saveVehicle() {
    if (!vehicleForm || !modalForm?.id || !vehicleForm.brand.trim() || !vehicleForm.model.trim()) return
    setSaving(true)
    try {
      await onSaveVehicle({ ...vehicleForm, id: undefined, customer_id: modalForm.id }, vehicleForm.id)
      setVehicleForm(null)
      void showSuccessToast('Viatura guardada com sucesso.')
    } catch { void showErrorAlert('Falha ao guardar viatura', 'Verifique os dados e tente novamente.') }
    finally { setSaving(false) }
  }

  function patch(field: Partial<CustomerFormState>) {
    setModalForm((f) => (f ? { ...f, ...field } : f))
  }

  return (
    <section className="module-layout">
      <div className="module-header">
        <div>
          <p className="eyebrow">Clientes</p>
          <h3 className="section-title">Base de clientes</h3>
        </div>
        <div className="chip-group">
          <span className="chip">{customers.length} registados</span>
          <span className="chip chip-good">{totalPoints} pontos atribuídos</span>
        </div>
      </div>

      <div className="stats-grid">
        <article className="stat-card">
          <span className="touch-helper">Total de clientes</span>
          <strong>{customers.length}</strong>
        </article>
        <article className="stat-card">
          <span className="touch-helper">Pontos atribuídos</span>
          <strong>{totalPoints} pts</strong>
        </article>
        <article className="stat-card">
          <span className="touch-helper">Líder de fidelidade</span>
          <strong>{topCustomer?.full_name ?? '—'}</strong>
        </article>
      </div>

      <div className="toolbar-strip">
        <div className="toolbar-search">
          <TouchInput
            label="Pesquisar cliente"
            value={search}
            onChange={setSearch}
            placeholder="Nome, telefone, notas..."
            type="search"
          />
        </div>
        <button type="button" className="primary-button" onClick={() => setModalForm(emptyForm())}>
          + Novo cliente
        </button>
      </div>

      {filtered.length === 0 ? (
        <article className="panel">
          <p className="empty-state" style={{ padding: '2rem', textAlign: 'center' }}>
            {search ? 'Nenhum cliente encontrado para esta pesquisa.' : 'Ainda não existem clientes registados.'}
          </p>
        </article>
      ) : (
        <article className="panel">
          <div className="record-list">
            {filtered.map((customer) => {
              const pts = customer.loyalty_points ?? 0
              const barFill = Math.round((pts / topPoints) * 100)
              return (
                <button
                  key={customer.id}
                  type="button"
                  className={`record-row record-row--with-thumb ${customer.active === false ? 'record-row--inactive' : ''}`}
                  onClick={() => setModalForm(buildForm(customer))}
                >
                  <div
                    className="customer-avatar"
                    style={{ background: avatarColor(customer.full_name) }}
                    aria-hidden="true"
                  >
                    {getInitials(customer.full_name)}
                  </div>
                  <div className="record-main">
                    <strong>{customer.full_name}</strong>
                    <small>
                      {customer.phone}
                      {customer.preferred_barber_name ? ` · ${customer.preferred_barber_name}` : ''}
                    </small>
                  </div>
                  <div className="customer-row-loyalty">
                    <div className="loyalty-bar loyalty-bar--sm">
                      <div className="loyalty-bar__fill" style={{ width: `${barFill}%` }} />
                    </div>
                    <span className="chip chip-good">{pts} pts</span>
                    {customer.active === false && <span className="chip chip-warn">Inativo</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </article>
      )}

      {modalForm !== null && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalForm(null)
          }}
        >
          <div className="modal-panel">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Clientes</p>
                <h4 className="section-title" style={{ margin: 0 }}>
                  {modalForm.id ? 'Editar cliente' : 'Novo cliente'}
                </h4>
              </div>
              <button type="button" className="modal-close" onClick={() => setModalForm(null)}>
                ✕
              </button>
            </div>

            {modalForm.id && modalForm.full_name && (
              <div className="customer-profile-header">
                <div
                  className="customer-avatar customer-avatar--lg"
                  style={{ background: avatarColor(modalForm.full_name) }}
                  aria-hidden="true"
                >
                  {getInitials(modalForm.full_name)}
                </div>
                <div>
                  <strong className="customer-profile-name">{modalForm.full_name}</strong>
                  <p className="touch-helper">{modalForm.phone}</p>
                  <span className="chip chip-good">{modalForm.loyalty_points} pontos</span>
                </div>
              </div>
            )}

            <div className="form-grid">
              <TouchInput
                label="Nome completo"
                value={modalForm.full_name}
                onChange={(v) => patch({ full_name: v })}
              />
              <TouchInput
                label="Telefone"
                value={modalForm.phone}
                onChange={(v) => patch({ phone: v })}
                placeholder="84 000 0000"
              />
              <TouchInput label="Email" value={modalForm.email} onChange={(v) => patch({ email: v })} />
              <TouchInput label="Morada" value={modalForm.address} onChange={(v) => patch({ address: v })} />
              <label className="touch-field"><span className="touch-label">Data de nascimento</span><input className="touch-input" type="date" value={modalForm.birth_date} onChange={(e) => patch({ birth_date: e.target.value })}/></label>
              <label className="touch-field"><span className="touch-label">Barbeiro preferido</span><select className="touch-input" value={modalForm.preferred_barber_id} onChange={(e) => patch({ preferred_barber_id: e.target.value })}><option value="">Sem preferência</option>{employees.filter(e => e.department === 'barbershop' && e.is_active_employee).map(e => <option key={e.id} value={e.id}>{e.user.display_name || e.user.email}</option>)}</select></label>
              <TouchNumberInput
                label="Pontos de fidelidade"
                value={modalForm.loyalty_points}
                onChange={(v) => patch({ loyalty_points: v })}
              />
            </div>

            <TouchTextarea
              label="Notas"
              value={modalForm.notes}
              onChange={(v) => patch({ notes: v })}
              rows={3}
            />

            <div className="toggle-grid">
              <label className="toggle-card">
                <input
                  type="checkbox"
                  checked={modalForm.active}
                  onChange={(e) => patch({ active: e.target.checked })}
                />
                <span>Cliente ativo</span>
              </label>
            </div>

            {modalForm.id && (
              <article className="panel">
                <div className="panel-head">
                  <h4>Viaturas</h4>
                  <button className="ghost-button" onClick={() => setVehicleForm({ registration_number: '', brand: '', model: '', color: '', notes: '' })}>+ Nova viatura</button>
                </div>
                <div className="record-list">
                  {customerVehicles.map((v) => (
                    <button key={v.id} className="record-row" onClick={() => setVehicleForm({ id: v.id, registration_number: v.registration_number, brand: v.brand, model: v.model, color: v.color ?? '', notes: '' })}>
                      <div className="record-main">
                        <strong>{v.brand} {v.model}{v.color ? ` · ${v.color}` : ''}</strong>
                        <small>{v.registration_number}</small>
                      </div>
                    </button>
                  ))}
                </div>
              </article>
            )}

            {customerAppointments.length > 0 && (
              <article className="panel">
                <div className="panel-head">
                  <h4>Historial de visitas</h4>
                  <span className="chip">{customerAppointments.length}</span>
                </div>
                <div className="timeline-list">
                  {customerAppointments.map((apt) => (
                    <div key={apt.id} className="timeline-item">
                      <div>
                        <strong>{apt.service_name}</strong>
                        <small>{apt.employee_name} · {apt.department}</small>
                      </div>
                      <div className="timeline-meta">
                        <span>{formatDateTime(apt.scheduled_for)}</span>
                        <small>{formatCurrency(apt.price)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            )}

            <div className="form-actions">
              <button type="button" className="ghost-button" onClick={() => setModalForm(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => void handleSave()}
                disabled={!canManage || saving}
              >
                {saving ? 'A guardar...' : modalForm.id ? 'Atualizar cliente' : 'Criar cliente'}
              </button>
            </div>
            {vehicleForm && <div className="panel"><h4>{vehicleForm.id ? 'Editar viatura' : 'Nova viatura'}</h4><div className="form-grid">
              <TouchInput label="Matrícula" value={vehicleForm.registration_number} onChange={(v) => setVehicleForm({ ...vehicleForm, registration_number: v.toUpperCase() })}/>
              <TouchInput label="Marca" value={vehicleForm.brand} onChange={(v) => setVehicleForm({ ...vehicleForm, brand: v })}/>
              <TouchInput label="Modelo" value={vehicleForm.model} onChange={(v) => setVehicleForm({ ...vehicleForm, model: v })}/>
              <TouchInput label="Cor" value={vehicleForm.color} onChange={(v) => setVehicleForm({ ...vehicleForm, color: v })}/>
            </div><div className="form-actions"><button className="ghost-button" onClick={() => setVehicleForm(null)}>Cancelar</button><button className="primary-button" disabled={saving} onClick={() => void saveVehicle()}>Guardar viatura</button></div></div>}
          </div>
        </div>
      )}
    </section>
  )
}
