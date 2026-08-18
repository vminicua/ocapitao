import { useEffect, useState } from 'react'

import { TouchInput } from '../../components/touch/TouchInput'
import { TouchNumberInput } from '../../components/touch/TouchNumberInput'
import { TouchSelect } from '../../components/touch/TouchSelect'
import { TouchTextarea } from '../../components/touch/TouchTextarea'
import { showErrorAlert, showSuccessToast } from '../../lib/alerts'
import { formatCurrency } from '../../lib/formatters'
import type {
  AppSettings,
  BackupRecord,
  AuthUser,
  EmployeeDepartment,
  PermissionDefinition,
  RoleRecord,
  Service,
  ServiceCategory,
  SyncState,
  SyncQueueRecord,
  UserRecord,
} from '../../types/models'
import { LoyaltySettings } from './LoyaltySettings'

type SettingsTab = 'business' | 'operations' | 'team' | 'services' | 'loyalty' | 'access' | 'printers'

interface SettingsViewProps {
  backups: BackupRecord[]
  syncQueue: SyncQueueRecord[]
  settings: AppSettings
  syncState: SyncState
  permissions: PermissionDefinition[]
  roles: RoleRecord[]
  users: UserRecord[]
  services: Service[]
  serviceCategories: ServiceCategory[]
  currentUser: AuthUser | null
  canManageSettings: boolean
  canManageUsers: boolean
  canManageLoyalty: boolean
  onSyncNow: () => void
  onSaveSettings: (payload: Record<string, unknown>) => Promise<unknown>
  onSaveRole: (payload: Record<string, unknown>, roleId?: string) => Promise<unknown>
  onSaveService: (payload: Record<string, unknown>, serviceId?: string) => Promise<unknown>
  onSaveServiceCategory: (payload: Record<string, unknown>, categoryId?: string) => Promise<unknown>
  onSaveUser: (payload: Record<string, unknown>, userId?: number) => Promise<unknown>
  onDeactivateUser: (userId: number) => Promise<unknown>
  onCreateBackup: () => Promise<unknown>
  onRestoreBackup: (file: string) => Promise<unknown>
  onResolveSync: (id: number, resolution: 'keep_local' | 'use_cloud') => Promise<unknown>
  accessToken: string
}

interface SettingsFormState {
  business_name: string
  legal_name: string
  nuit: string
  address: string
  city: string
  country: string
  phone: string
  email: string
  currency_code: string
  currency_symbol: string
  timezone: string
  tax_rate: string
  appointment_slot_minutes: string
  receipt_header: string
  receipt_footer: string
  printer_name: string
  business_hours: string
  backup_folder: string
  ssh_tunnel_command: string
  sync_interval_seconds: string
  auto_sync_enabled: boolean
  enable_barbershop_module: boolean
  enable_bar_module: boolean
  enable_carwash_module: boolean
  enable_pos_module: boolean
  enable_reports_module: boolean
  allow_walk_in: boolean
  enable_low_stock_alerts: boolean
  allow_negative_stock: boolean
  require_pin_on_sale: boolean
  default_markup_percent: string
  default_commission_percent: string
  dark_mode: boolean
}

interface RoleFormState {
  id?: string
  code: string
  name: string
  description: string
  permissionIds: string[]
}

interface UserFormState {
  id?: number
  username: string
  email: string
  first_name: string
  last_name: string
  phone: string
  role_id: string
  password: string
  force_password_change: boolean
  is_active: boolean
  is_staff: boolean
  department: EmployeeDepartment | ''
  title: string
  commission_rate: string
  hire_date: string
  is_active_employee: boolean
  employee_notes: string
}

interface ServiceCategoryFormState {
  id?: string
  department: 'barbershop' | 'carwash'
  parent_id: string
  name: string
  description: string
  active: boolean
}

interface ServiceFormState {
  id?: string
  department: 'barbershop' | 'carwash'
  category_ref_id: string
  name: string
  duration_minutes: string
  price: string
  description: string
  active: boolean
}

function buildSettingsForm(settings: AppSettings): SettingsFormState {
  return {
    business_name: settings.business_name,
    legal_name: settings.legal_name,
    nuit: settings.nuit,
    address: settings.address,
    city: settings.city,
    country: settings.country,
    phone: settings.phone,
    email: settings.email,
    currency_code: settings.currency_code,
    currency_symbol: settings.currency_symbol,
    timezone: settings.timezone,
    tax_rate: String(settings.tax_rate ?? ''),
    appointment_slot_minutes: String(settings.appointment_slot_minutes ?? ''),
    receipt_header: settings.receipt_header,
    receipt_footer: settings.receipt_footer,
    printer_name: settings.printer_name,
    business_hours: settings.business_hours,
    backup_folder: settings.backup_folder,
    ssh_tunnel_command: settings.ssh_tunnel_command,
    sync_interval_seconds: String(settings.sync_interval_seconds ?? ''),
    auto_sync_enabled: settings.auto_sync_enabled,
    enable_barbershop_module: settings.enable_barbershop_module,
    enable_bar_module: settings.enable_bar_module,
    enable_carwash_module: settings.enable_carwash_module,
    enable_pos_module: settings.enable_pos_module,
    enable_reports_module: settings.enable_reports_module,
    allow_walk_in: settings.allow_walk_in,
    enable_low_stock_alerts: settings.enable_low_stock_alerts,
    allow_negative_stock: settings.allow_negative_stock,
    require_pin_on_sale: settings.require_pin_on_sale,
    default_markup_percent: String(settings.default_markup_percent ?? ''),
    default_commission_percent: String(settings.default_commission_percent ?? ''),
    dark_mode: settings.dark_mode,
  }
}

function emptyRoleForm(): RoleFormState {
  return {
    code: '',
    name: '',
    description: '',
    permissionIds: [],
  }
}

function buildRoleForm(role: RoleRecord): RoleFormState {
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    permissionIds: role.permissions.map((permission) => permission.id),
  }
}

function emptyUserForm(): UserFormState {
  return {
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    role_id: '',
    password: '',
    force_password_change: false,
    is_active: true,
    is_staff: false,
    department: '',
    title: '',
    commission_rate: '0',
    hire_date: '',
    is_active_employee: true,
    employee_notes: '',
  }
}

function buildUserForm(user: UserRecord): UserFormState {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    phone: user.phone,
    role_id: user.role?.id ?? '',
    password: '',
    force_password_change: user.force_password_change,
    is_active: user.is_active,
    is_staff: user.is_staff,
    department: user.department ?? '',
    title: user.title ?? '',
    commission_rate: String(user.commission_rate ?? 0),
    hire_date: user.hire_date ?? '',
    is_active_employee: user.is_active_employee ?? true,
    employee_notes: user.employee_notes ?? '',
  }
}

function emptyServiceCategoryForm(): ServiceCategoryFormState {
  return {
    department: 'barbershop',
    parent_id: '',
    name: '',
    description: '',
    active: true,
  }
}

function buildServiceCategoryForm(category: ServiceCategory): ServiceCategoryFormState {
  return {
    id: category.id,
    department: category.department,
    parent_id: category.parent_id ?? '',
    name: category.name,
    description: category.description,
    active: category.active,
  }
}

function emptyServiceForm(): ServiceFormState {
  return {
    department: 'barbershop',
    category_ref_id: '',
    name: '',
    duration_minutes: '30',
    price: '0',
    description: '',
    active: true,
  }
}

function buildServiceForm(service: Service): ServiceFormState {
  return {
    id: service.id,
    department: service.department,
    category_ref_id: service.category_ref_id ?? '',
    name: service.name,
    duration_minutes: String(service.duration_minutes ?? 30),
    price: String(service.price ?? 0),
    description: service.description ?? '',
    active: service.active,
  }
}

export function SettingsView({
  backups,
  syncQueue,
  settings,
  syncState,
  permissions,
  roles,
  users,
  services,
  serviceCategories,
  currentUser,
  canManageSettings,
  canManageUsers,
  canManageLoyalty,
  onSyncNow,
  onSaveSettings,
  onSaveRole,
  onSaveService,
  onSaveServiceCategory,
  onSaveUser,
  onDeactivateUser,
  onCreateBackup,
  onRestoreBackup,
  onResolveSync, accessToken,
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('business')
  const [settingsForm, setSettingsForm] = useState<SettingsFormState>(() => buildSettingsForm(settings))
  const [roleForm, setRoleForm] = useState<RoleFormState>(emptyRoleForm)
  const [userForm, setUserForm] = useState<UserFormState>(emptyUserForm)
  const [serviceCategoryForm, setServiceCategoryForm] = useState<ServiceCategoryFormState>(emptyServiceCategoryForm)
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(emptyServiceForm)
  const [savingSettings, setSavingSettings] = useState(false)
  const [savingRole, setSavingRole] = useState(false)
  const [savingUser, setSavingUser] = useState(false)
  const [savingServiceCategory, setSavingServiceCategory] = useState(false)
  const [savingService, setSavingService] = useState(false)
  const [backupBusy, setBackupBusy] = useState(false)

  async function handleCreateBackup() {
    setBackupBusy(true)
    try { await onCreateBackup(); void showSuccessToast('Backup verificado e criado com sucesso.') }
    catch { void showErrorAlert('Falha no backup', 'Não foi possível criar o backup local.') }
    finally { setBackupBusy(false) }
  }

  async function handleRestoreBackup(file: string) {
    if (!window.confirm(`Restaurar ${file}? Será criado um backup de segurança antes da recuperação.`)) return
    setBackupBusy(true)
    try { await onRestoreBackup(file); void showSuccessToast('Backup restaurado. Reinicie a aplicação para carregar os dados recuperados.') }
    catch { void showErrorAlert('Falha no restauro', 'O ficheiro não passou a validação ou não pôde ser restaurado.') }
    finally { setBackupBusy(false) }
  }

  useEffect(() => {
    setSettingsForm(buildSettingsForm(settings))
  }, [settings])

  useEffect(() => {
    if (roleForm.id && !roles.some((role) => role.id === roleForm.id)) {
      setRoleForm(emptyRoleForm())
    }
  }, [roleForm.id, roles])

  useEffect(() => {
    if (userForm.id && !users.some((user) => user.id === userForm.id)) {
      setUserForm(emptyUserForm())
    }
  }, [userForm.id, users])

  useEffect(() => {
    if (serviceCategoryForm.id && !serviceCategories.some((category) => category.id === serviceCategoryForm.id)) {
      setServiceCategoryForm(emptyServiceCategoryForm())
    }
  }, [serviceCategoryForm.id, serviceCategories])

  useEffect(() => {
    if (serviceForm.id && !services.some((service) => service.id === serviceForm.id)) {
      setServiceForm(emptyServiceForm())
    }
  }, [serviceForm.id, services])

  const groupedPermissions = permissions.reduce<Record<string, PermissionDefinition[]>>((accumulator, permission) => {
    const moduleName = permission.module || 'geral'
    accumulator[moduleName] = [...(accumulator[moduleName] ?? []), permission]
    return accumulator
  }, {})

  const roleOptions = roles.map((role) => ({ value: role.id, label: `${role.name} (${role.code})` }))
  const departmentOptions = [
    { value: 'management', label: 'Gestão' },
    { value: 'barbershop', label: 'Barbershop' },
    { value: 'bar', label: 'Bar' },
    { value: 'carwash', label: 'Carwash' },
    { value: 'cashier', label: 'Caixa' },
  ]
  const serviceDepartmentOptions = [
    { value: 'barbershop', label: 'Barbershop' },
    { value: 'carwash', label: 'Carwash' },
  ]

  const activePermissionsCount = permissions.length
  const activeUsersCount = users.filter((user) => user.is_active).length
  const roleCount = roles.length
  const rootServiceCategories = serviceCategories.filter(
    (category) => category.department === serviceCategoryForm.department && !category.parent_id,
  )
  const leafServiceCategories = serviceCategories.filter(
    (category) => category.department === serviceForm.department && Boolean(category.parent_id),
  )
  const filteredServices = services.filter((service) => service.department === serviceForm.department)
  const canOperateSecurity = canManageUsers || canManageSettings
  const permissionCodes = currentUser?.role?.permissions?.map((permission) => permission.code) ?? []
  const canViewSettings = Boolean(currentUser?.is_superuser || permissionCodes.some((code) => ['settings.view', 'settings.manage'].includes(code)))
  const canViewUsers = Boolean(currentUser?.is_superuser || permissionCodes.some((code) => ['users.view', 'users.manage'].includes(code)))
  const canViewLoyalty = Boolean(currentUser?.is_superuser || permissionCodes.some((code) => ['loyalty.view', 'loyalty.adjust', 'promotions.view', 'promotions.manage'].includes(code)))

  useEffect(() => {
    if (!canViewSettings && !canViewUsers && canViewLoyalty) setActiveTab('loyalty')
  }, [canViewLoyalty, canViewSettings, canViewUsers])

  async function handleSaveSettings() {
    setSavingSettings(true)
    try {
      await onSaveSettings({ ...settingsForm })
      void showSuccessToast('Configurações atualizadas.')
    } catch (error) {
      console.error(error)
      void showErrorAlert('Falha ao guardar configurações', 'Confirme os dados e volte a tentar.')
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleSaveRole() {
    if (!roleForm.code || !roleForm.name) {
      void showErrorAlert('Campos em falta', 'Preencha pelo menos o código e o nome do perfil.')
      return
    }

    setSavingRole(true)
    try {
      await onSaveRole(
        {
          code: roleForm.code.trim(),
          name: roleForm.name.trim(),
          description: roleForm.description.trim(),
          permission_ids: roleForm.permissionIds,
        },
        roleForm.id,
      )
      setRoleForm(emptyRoleForm())
      void showSuccessToast('Perfil guardado com sucesso.')
    } catch (error) {
      console.error(error)
      void showErrorAlert('Falha ao guardar perfil', 'Verifique se o código é único e tente novamente.')
    } finally {
      setSavingRole(false)
    }
  }

  async function handleSaveUser() {
    if (!userForm.username || !userForm.email || !userForm.first_name || !userForm.role_id) {
      void showErrorAlert('Campos em falta', 'Username, nome, email e perfil são obrigatórios.')
      return
    }

    const payload: Record<string, unknown> = {
      username: userForm.username.trim(),
      email: userForm.email.trim(),
      first_name: userForm.first_name.trim(),
      last_name: userForm.last_name.trim(),
      phone: userForm.phone.trim(),
      role_id: userForm.role_id,
      force_password_change: userForm.force_password_change,
      is_active: userForm.is_active,
      is_staff: userForm.is_staff,
      department: userForm.department || null,
      title: userForm.title.trim(),
      commission_rate: userForm.commission_rate,
      hire_date: userForm.hire_date || null,
      is_active_employee: userForm.is_active_employee,
      employee_notes: userForm.employee_notes.trim(),
    }

    if (userForm.password.trim()) {
      payload.password = userForm.password.trim()
    }

    setSavingUser(true)
    try {
      await onSaveUser(payload, userForm.id)
      setUserForm(emptyUserForm())
      void showSuccessToast('Utilizador guardado com sucesso.')
    } catch (error) {
      console.error(error)
      void showErrorAlert('Falha ao guardar utilizador', 'Confirme o email, o username e o perfil selecionado.')
    } finally {
      setSavingUser(false)
    }
  }

  async function handleDeactivateUser() {
    if (!userForm.id) {
      return
    }

    setSavingUser(true)
    try {
      await onDeactivateUser(userForm.id)
      setUserForm(emptyUserForm())
      void showSuccessToast('Utilizador desativado.')
    } catch (error) {
      console.error(error)
      void showErrorAlert('Falha ao desativar utilizador', 'Tente novamente dentro de instantes.')
    } finally {
      setSavingUser(false)
    }
  }

  async function handleSaveServiceCategory() {
    if (!serviceCategoryForm.name.trim()) {
      void showErrorAlert('Categoria incompleta', 'Indique o nome da categoria ou subcategoria.')
      return
    }

    setSavingServiceCategory(true)
    try {
      await onSaveServiceCategory(
        {
          department: serviceCategoryForm.department,
          parent_id: serviceCategoryForm.parent_id || null,
          name: serviceCategoryForm.name.trim(),
          description: serviceCategoryForm.description.trim(),
          active: serviceCategoryForm.active,
        },
        serviceCategoryForm.id,
      )
      setServiceCategoryForm(emptyServiceCategoryForm())
      void showSuccessToast('Categoria de serviço guardada.')
    } catch (error) {
      console.error(error)
      void showErrorAlert('Falha ao guardar categoria', 'Confirme os dados da categoria e volte a tentar.')
    } finally {
      setSavingServiceCategory(false)
    }
  }

  async function handleSaveService() {
    if (!serviceForm.name.trim() || !serviceForm.category_ref_id) {
      void showErrorAlert('Serviço incompleto', 'Selecione a subcategoria e o nome do serviço.')
      return
    }

    setSavingService(true)
    try {
      await onSaveService(
        {
          department: serviceForm.department,
          category_ref_id: serviceForm.category_ref_id,
          name: serviceForm.name.trim(),
          duration_minutes: serviceForm.duration_minutes,
          price: serviceForm.price,
          description: serviceForm.description.trim(),
          active: serviceForm.active,
        },
        serviceForm.id,
      )
      setServiceForm(emptyServiceForm())
      void showSuccessToast('Serviço guardado com sucesso.')
    } catch (error) {
      console.error(error)
      void showErrorAlert('Falha ao guardar serviço', 'Confirme a duração, preço e categoria selecionada.')
    } finally {
      setSavingService(false)
    }
  }

  return (
    <section className="module-layout">
      <div className="module-header">
        <div>
          <p className="eyebrow">Configurações</p>
          <h3 className="section-title">Governo da operação, equipa, serviços e segurança</h3>
        </div>
        <div className="chip-group">
          <span className="chip">{roleCount} perfis</span>
          <span className="chip">{activeUsersCount} utilizadores ativos</span>
          <span className="chip">{services.length} serviços</span>
          <span className="chip">{activePermissionsCount} permissões</span>
        </div>
      </div>

      <div className="tab-row">
        {canViewSettings && <button type="button" className={`chip-button ${activeTab === 'business' ? 'is-selected' : ''}`} onClick={() => setActiveTab('business')}>
          Negócio
        </button>}
        {canViewSettings && <button type="button" className={`chip-button ${activeTab === 'operations' ? 'is-selected' : ''}`} onClick={() => setActiveTab('operations')}>
          Operação
        </button>}
        {canViewUsers && <button type="button" className={`chip-button ${activeTab === 'team' ? 'is-selected' : ''}`} onClick={() => setActiveTab('team')}>
          Equipa
        </button>}
        {canViewSettings && <button type="button" className={`chip-button ${activeTab === 'services' ? 'is-selected' : ''}`} onClick={() => setActiveTab('services')}>
          Serviços
        </button>}
        {canViewLoyalty && <button type="button" className={`chip-button ${activeTab === 'loyalty' ? 'is-selected' : ''}`} onClick={() => setActiveTab('loyalty')}>Fidelização</button>}
        {canViewUsers && <button type="button" className={`chip-button ${activeTab === 'access' ? 'is-selected' : ''}`} onClick={() => setActiveTab('access')}>
          Perfis e acessos
        </button>}
        {canViewSettings && <button type="button" className={`chip-button ${activeTab === 'printers' ? 'is-selected' : ''}`} onClick={() => setActiveTab('printers')}>
          Impressoras
        </button>}
      </div>

      {activeTab === 'business' ? (
        <div className="content-grid two-columns">
          <article className="panel">
            <div className="panel-head">
              <h4>Perfil do negócio</h4>
              <span className="chip">{settingsForm.business_name}</span>
            </div>
            <div className="form-grid">
              <TouchInput label="Nome comercial" value={settingsForm.business_name} onChange={(value) => setSettingsForm((current) => ({ ...current, business_name: value }))} />
              <TouchInput label="Nome legal" value={settingsForm.legal_name} onChange={(value) => setSettingsForm((current) => ({ ...current, legal_name: value }))} />
              <TouchInput label="NUIT" value={settingsForm.nuit} onChange={(value) => setSettingsForm((current) => ({ ...current, nuit: value }))} />
              <TouchInput label="Telefone" value={settingsForm.phone} onChange={(value) => setSettingsForm((current) => ({ ...current, phone: value }))} />
              <TouchInput label="Email" value={settingsForm.email} onChange={(value) => setSettingsForm((current) => ({ ...current, email: value }))} type="email" />
              <TouchInput label="Morada" value={settingsForm.address} onChange={(value) => setSettingsForm((current) => ({ ...current, address: value }))} />
              <TouchInput label="Cidade" value={settingsForm.city} onChange={(value) => setSettingsForm((current) => ({ ...current, city: value }))} />
              <TouchInput label="País" value={settingsForm.country} onChange={(value) => setSettingsForm((current) => ({ ...current, country: value }))} />
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <h4>Fiscal e comunicação</h4>
              <span className="chip">{settingsForm.currency_symbol}</span>
            </div>
            <div className="form-grid">
              <TouchInput label="Código da moeda" value={settingsForm.currency_code} onChange={(value) => setSettingsForm((current) => ({ ...current, currency_code: value }))} />
              <TouchInput label="Símbolo da moeda" value={settingsForm.currency_symbol} onChange={(value) => setSettingsForm((current) => ({ ...current, currency_symbol: value }))} />
              <TouchInput label="Timezone" value={settingsForm.timezone} onChange={(value) => setSettingsForm((current) => ({ ...current, timezone: value }))} />
              <TouchNumberInput label="Taxa de IVA (%)" value={settingsForm.tax_rate} onChange={(value) => setSettingsForm((current) => ({ ...current, tax_rate: value }))} />
            </div>
            <TouchTextarea
              label="Cabeçalho do recibo"
              value={settingsForm.receipt_header}
              onChange={(value) => setSettingsForm((current) => ({ ...current, receipt_header: value }))}
              rows={3}
            />
            <TouchTextarea
              label="Rodapé do recibo"
              value={settingsForm.receipt_footer}
              onChange={(value) => setSettingsForm((current) => ({ ...current, receipt_footer: value }))}
              rows={3}
            />
            <div className="form-actions">
              <button type="button" className="primary-button" onClick={() => void handleSaveSettings()} disabled={!canManageSettings || savingSettings}>
                {savingSettings ? 'A guardar...' : 'Guardar configurações'}
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {activeTab === 'operations' ? (
        <div className="content-grid two-columns">
          <article className="panel">
            <div className="panel-head">
              <h4>Operação diária</h4>
              <span className={`chip ${syncState.online ? 'chip-good' : 'chip-warn'}`}>{syncState.label ?? 'Sincronização'}</span>
            </div>
            <div className="form-grid">
              <TouchNumberInput label="Intervalo de sync (seg.)" value={settingsForm.sync_interval_seconds} onChange={(value) => setSettingsForm((current) => ({ ...current, sync_interval_seconds: value }))} />
              <TouchNumberInput label="Intervalo padrão de agenda (min.)" value={settingsForm.appointment_slot_minutes} onChange={(value) => setSettingsForm((current) => ({ ...current, appointment_slot_minutes: value }))} />
              <TouchNumberInput label="Markup padrão (%)" value={settingsForm.default_markup_percent} onChange={(value) => setSettingsForm((current) => ({ ...current, default_markup_percent: value }))} />
              <TouchNumberInput label="Comissão padrão (%)" value={settingsForm.default_commission_percent} onChange={(value) => setSettingsForm((current) => ({ ...current, default_commission_percent: value }))} />
              <TouchInput label="Impressora padrão" value={settingsForm.printer_name} onChange={(value) => setSettingsForm((current) => ({ ...current, printer_name: value }))} />
              <TouchInput label="Pasta de backup" value={settingsForm.backup_folder} onChange={(value) => setSettingsForm((current) => ({ ...current, backup_folder: value }))} />
            </div>
            <TouchTextarea label="Horário de funcionamento" value={settingsForm.business_hours} onChange={(value) => setSettingsForm((current) => ({ ...current, business_hours: value }))} rows={3} />
            <div className="panel-head"><h4>Backups locais</h4><button className="primary-button" disabled={backupBusy || !canManageSettings} onClick={() => void handleCreateBackup()}>Criar backup agora</button></div>
            <div className="record-list">{backups.slice(0, 5).map(backup => <div className="record-row record-row--static" key={backup.file}><div className="record-main"><strong>{backup.file}</strong><small>{new Date(backup.created_at).toLocaleString('pt-MZ')} · {backup.reason}</small></div><button className="ghost-button" disabled={backupBusy || !canManageSettings} onClick={() => void handleRestoreBackup(backup.file)}>Restaurar</button></div>)}{backups.length === 0 && <p className="empty-state">Ainda não existem backups.</p>}</div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <h4>Módulos e políticas</h4>
              <span className="chip">{currentUser?.role?.name ?? 'Perfil atual'}</span>
            </div>
            <div className="toggle-grid">
              <label className="toggle-card"><input type="checkbox" checked={settingsForm.enable_barbershop_module} onChange={(event) => setSettingsForm((current) => ({ ...current, enable_barbershop_module: event.target.checked }))} /><span>Barbershop ativo</span></label>
              <label className="toggle-card"><input type="checkbox" checked={settingsForm.enable_bar_module} onChange={(event) => setSettingsForm((current) => ({ ...current, enable_bar_module: event.target.checked }))} /><span>Bar ativo</span></label>
              <label className="toggle-card"><input type="checkbox" checked={settingsForm.enable_carwash_module} onChange={(event) => setSettingsForm((current) => ({ ...current, enable_carwash_module: event.target.checked }))} /><span>Carwash ativo</span></label>
              <label className="toggle-card"><input type="checkbox" checked={settingsForm.enable_pos_module} onChange={(event) => setSettingsForm((current) => ({ ...current, enable_pos_module: event.target.checked }))} /><span>POS ativo</span></label>
              <label className="toggle-card"><input type="checkbox" checked={settingsForm.enable_reports_module} onChange={(event) => setSettingsForm((current) => ({ ...current, enable_reports_module: event.target.checked }))} /><span>Relatórios ativos</span></label>
              <label className="toggle-card"><input type="checkbox" checked={settingsForm.auto_sync_enabled} onChange={(event) => setSettingsForm((current) => ({ ...current, auto_sync_enabled: event.target.checked }))} /><span>Sync automática</span></label>
              <label className="toggle-card"><input type="checkbox" checked={settingsForm.enable_low_stock_alerts} onChange={(event) => setSettingsForm((current) => ({ ...current, enable_low_stock_alerts: event.target.checked }))} /><span>Alertas de baixo stock</span></label>
              <label className="toggle-card"><input type="checkbox" checked={settingsForm.allow_negative_stock} onChange={(event) => setSettingsForm((current) => ({ ...current, allow_negative_stock: event.target.checked }))} /><span>Permitir stock negativo</span></label>
              <label className="toggle-card"><input type="checkbox" checked={settingsForm.require_pin_on_sale} onChange={(event) => setSettingsForm((current) => ({ ...current, require_pin_on_sale: event.target.checked }))} /><span>PIN obrigatório na venda</span></label>
              <label className="toggle-card"><input type="checkbox" checked={settingsForm.allow_walk_in} onChange={(event) => setSettingsForm((current) => ({ ...current, allow_walk_in: event.target.checked }))} /><span>Permitir walk-in</span></label>
              <label className="toggle-card"><input type="checkbox" checked={settingsForm.dark_mode} onChange={(event) => setSettingsForm((current) => ({ ...current, dark_mode: event.target.checked }))} /><span>Dark mode preparado</span></label>
            </div>
            <TouchTextarea label="Comando do túnel SSH" value={settingsForm.ssh_tunnel_command} onChange={(value) => setSettingsForm((current) => ({ ...current, ssh_tunnel_command: value }))} rows={4} />
            <div className="form-actions">
              <button type="button" className="ghost-button" onClick={onSyncNow}>Sincronizar agora</button>
              <button type="button" className="primary-button" onClick={() => void handleSaveSettings()} disabled={!canManageSettings || savingSettings}>
                {savingSettings ? 'A guardar...' : 'Guardar configurações'}
              </button>
            </div>
            {syncQueue.some(item => item.status === 'conflict' || item.status === 'failed') && <div className="record-list">
              <h4>Conflitos e falhas de sincronização</h4>
              {syncQueue.filter(item => item.status === 'conflict' || item.status === 'failed').map(item => <div className="record-row record-row--static" key={item.id}><div className="record-main"><strong>{item.model_label}</strong><small>{item.last_error || `Falhou após ${item.attempts} tentativas`}</small></div><button className="ghost-button" onClick={() => void onResolveSync(item.id, 'use_cloud')}>Usar cloud</button><button className="primary-button" onClick={() => void onResolveSync(item.id, 'keep_local')}>Manter local</button></div>)}
            </div>}
          </article>
        </div>
      ) : null}

      {activeTab === 'team' ? (
        <div className="content-grid two-columns">
          <article className="panel">
            <div className="panel-head">
              <h4>Utilizadores</h4>
              <span className="chip">{activeUsersCount} ativos</span>
            </div>
            <div className="record-list">
              {users.map((user) => (
                <button key={user.id} type="button" className={`record-row ${userForm.id === user.id ? 'is-active' : ''}`} onClick={() => setUserForm(buildUserForm(user))}>
                  <div>
                    <strong>{user.display_name || `${user.first_name} ${user.last_name}`.trim() || user.username}</strong>
                    <small>{user.role?.name ?? 'Sem perfil'} · {user.department ?? 'Sem departamento'}</small>
                  </div>
                  <span className={`chip ${user.is_active ? 'chip-good' : 'chip-warn'}`}>{user.is_active ? 'Ativo' : 'Inativo'}</span>
                </button>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <h4>{userForm.id ? 'Editar utilizador' : 'Novo utilizador'}</h4>
              <div className="chip-group">
                <button type="button" className="chip-button" onClick={() => setUserForm(emptyUserForm())}>Novo</button>
              </div>
            </div>
            <div className="form-grid">
              <TouchInput label="Username" value={userForm.username} onChange={(value) => setUserForm((current) => ({ ...current, username: value }))} />
              <TouchInput label="Email" value={userForm.email} onChange={(value) => setUserForm((current) => ({ ...current, email: value }))} type="email" />
              <TouchInput label="Primeiro nome" value={userForm.first_name} onChange={(value) => setUserForm((current) => ({ ...current, first_name: value }))} />
              <TouchInput label="Apelido" value={userForm.last_name} onChange={(value) => setUserForm((current) => ({ ...current, last_name: value }))} />
              <TouchInput label="Telefone" value={userForm.phone} onChange={(value) => setUserForm((current) => ({ ...current, phone: value }))} />
              <TouchSelect label="Perfil de acesso" value={userForm.role_id} onChange={(value) => setUserForm((current) => ({ ...current, role_id: value }))} options={roleOptions} />
              <TouchSelect label="Departamento" value={userForm.department} onChange={(value) => setUserForm((current) => ({ ...current, department: value as EmployeeDepartment }))} options={departmentOptions} />
              <TouchInput label="Cargo" value={userForm.title} onChange={(value) => setUserForm((current) => ({ ...current, title: value }))} />
              <TouchNumberInput label="Comissão (%)" value={userForm.commission_rate} onChange={(value) => setUserForm((current) => ({ ...current, commission_rate: value }))} />
              <TouchInput label="Data de admissão" value={userForm.hire_date} onChange={(value) => setUserForm((current) => ({ ...current, hire_date: value }))} placeholder="AAAA-MM-DD" />
              <TouchInput label={userForm.id ? 'Novo PIN (opcional)' : 'PIN inicial'} value={userForm.password} onChange={(value) => setUserForm((current) => ({ ...current, password: value }))} type="password" />
            </div>
            <TouchTextarea label="Notas internas" value={userForm.employee_notes} onChange={(value) => setUserForm((current) => ({ ...current, employee_notes: value }))} rows={3} />
            <div className="toggle-grid">
              <label className="toggle-card"><input type="checkbox" checked={userForm.force_password_change} onChange={(event) => setUserForm((current) => ({ ...current, force_password_change: event.target.checked }))} /><span>Obrigar troca de PIN</span></label>
              <label className="toggle-card"><input type="checkbox" checked={userForm.is_active} onChange={(event) => setUserForm((current) => ({ ...current, is_active: event.target.checked }))} /><span>Utilizador ativo</span></label>
              <label className="toggle-card"><input type="checkbox" checked={userForm.is_staff} onChange={(event) => setUserForm((current) => ({ ...current, is_staff: event.target.checked }))} /><span>Staff administrativo</span></label>
              <label className="toggle-card"><input type="checkbox" checked={userForm.is_active_employee} onChange={(event) => setUserForm((current) => ({ ...current, is_active_employee: event.target.checked }))} /><span>Colaborador ativo</span></label>
            </div>
            <div className="form-actions">
              {userForm.id ? <button type="button" className="ghost-button danger-text" onClick={() => void handleDeactivateUser()} disabled={!canManageUsers || savingUser}>Desativar utilizador</button> : null}
              <button type="button" className="primary-button" onClick={() => void handleSaveUser()} disabled={!canManageUsers || savingUser}>
                {savingUser ? 'A guardar...' : userForm.id ? 'Atualizar utilizador' : 'Criar utilizador'}
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {activeTab === 'services' ? (
        <div className="content-grid two-columns">
          <article className="panel">
            <div className="panel-head">
              <h4>Categorias e subcategorias de serviço</h4>
              <span className="chip">{serviceCategories.length}</span>
            </div>
            <div className="toolbar-inline">
              <button type="button" className={`chip-button ${serviceCategoryForm.department === 'barbershop' ? 'is-selected' : ''}`} onClick={() => setServiceCategoryForm((current) => ({ ...current, department: 'barbershop', parent_id: '' }))}>
                Barbershop
              </button>
              <button type="button" className={`chip-button ${serviceCategoryForm.department === 'carwash' ? 'is-selected' : ''}`} onClick={() => setServiceCategoryForm((current) => ({ ...current, department: 'carwash', parent_id: '' }))}>
                Carwash
              </button>
            </div>
            <div className="record-list">
              {serviceCategories
                .filter((category) => category.department === serviceCategoryForm.department)
                .map((category) => (
                  <button key={category.id} type="button" className={`record-row ${serviceCategoryForm.id === category.id ? 'is-active' : ''}`} onClick={() => setServiceCategoryForm(buildServiceCategoryForm(category))}>
                    <div>
                      <strong>{category.full_name ?? category.name}</strong>
                      <small>{category.parent_id ? 'Subcategoria' : 'Categoria'} · {category.active ? 'Ativa' : 'Inativa'}</small>
                    </div>
                  </button>
                ))}
            </div>
            <div className="form-grid">
              <TouchSelect label="Departamento" value={serviceCategoryForm.department} onChange={(value) => setServiceCategoryForm((current) => ({ ...current, department: value as 'barbershop' | 'carwash', parent_id: '' }))} options={serviceDepartmentOptions} />
              <TouchSelect label="Categoria pai" value={serviceCategoryForm.parent_id} onChange={(value) => setServiceCategoryForm((current) => ({ ...current, parent_id: value }))} options={rootServiceCategories.map((category) => ({ value: category.id, label: category.name }))} helperText="Deixe vazio para criar uma categoria principal." />
              <TouchInput label="Nome" value={serviceCategoryForm.name} onChange={(value) => setServiceCategoryForm((current) => ({ ...current, name: value }))} />
            </div>
            <TouchTextarea label="Descrição" value={serviceCategoryForm.description} onChange={(value) => setServiceCategoryForm((current) => ({ ...current, description: value }))} rows={3} />
            <div className="toggle-grid">
              <label className="toggle-card"><input type="checkbox" checked={serviceCategoryForm.active} onChange={(event) => setServiceCategoryForm((current) => ({ ...current, active: event.target.checked }))} /><span>Categoria ativa</span></label>
            </div>
            <div className="form-actions">
              <button type="button" className="ghost-button" onClick={() => setServiceCategoryForm(emptyServiceCategoryForm())}>Limpar</button>
              <button type="button" className="primary-button" onClick={() => void handleSaveServiceCategory()} disabled={!canManageSettings || savingServiceCategory}>
                {savingServiceCategory ? 'A guardar...' : serviceCategoryForm.id ? 'Atualizar categoria' : 'Criar categoria'}
              </button>
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <h4>Catálogo de serviços</h4>
              <span className="chip">{filteredServices.length} serviços</span>
            </div>
            <div className="toolbar-inline">
              <button type="button" className={`chip-button ${serviceForm.department === 'barbershop' ? 'is-selected' : ''}`} onClick={() => setServiceForm((current) => ({ ...current, department: 'barbershop', category_ref_id: '' }))}>
                Barbershop
              </button>
              <button type="button" className={`chip-button ${serviceForm.department === 'carwash' ? 'is-selected' : ''}`} onClick={() => setServiceForm((current) => ({ ...current, department: 'carwash', category_ref_id: '' }))}>
                Carwash
              </button>
            </div>
            <div className="record-list">
              {filteredServices.map((service) => (
                <button key={service.id} type="button" className={`record-row ${serviceForm.id === service.id ? 'is-active' : ''}`} onClick={() => setServiceForm(buildServiceForm(service))}>
                  <div>
                    <strong>{service.name}</strong>
                    <small>{service.category}{service.subcategory ? ` / ${service.subcategory}` : ''} · {service.duration_minutes} min</small>
                  </div>
                  <span className="chip">{formatCurrency(service.price)}</span>
                </button>
              ))}
            </div>
            <div className="form-grid">
              <TouchSelect label="Departamento" value={serviceForm.department} onChange={(value) => setServiceForm((current) => ({ ...current, department: value as 'barbershop' | 'carwash', category_ref_id: '' }))} options={serviceDepartmentOptions} />
              <TouchSelect label="Subcategoria" value={serviceForm.category_ref_id} onChange={(value) => setServiceForm((current) => ({ ...current, category_ref_id: value }))} options={leafServiceCategories.map((category) => ({ value: category.id, label: category.full_name ?? category.name }))} />
              <TouchInput label="Nome do serviço" value={serviceForm.name} onChange={(value) => setServiceForm((current) => ({ ...current, name: value }))} />
              <TouchNumberInput label="Duração (min.)" value={serviceForm.duration_minutes} onChange={(value) => setServiceForm((current) => ({ ...current, duration_minutes: value }))} />
              <TouchNumberInput label="Preço" value={serviceForm.price} onChange={(value) => setServiceForm((current) => ({ ...current, price: value }))} />
            </div>
            <TouchTextarea label="Descrição" value={serviceForm.description} onChange={(value) => setServiceForm((current) => ({ ...current, description: value }))} rows={3} />
            <div className="toggle-grid">
              <label className="toggle-card"><input type="checkbox" checked={serviceForm.active} onChange={(event) => setServiceForm((current) => ({ ...current, active: event.target.checked }))} /><span>Serviço ativo</span></label>
            </div>
            <div className="form-actions">
              <button type="button" className="ghost-button" onClick={() => setServiceForm(emptyServiceForm())}>Limpar</button>
              <button type="button" className="primary-button" onClick={() => void handleSaveService()} disabled={!canManageSettings || savingService}>
                {savingService ? 'A guardar...' : serviceForm.id ? 'Atualizar serviço' : 'Criar serviço'}
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {activeTab === 'loyalty' ? <LoyaltySettings accessToken={accessToken} services={services} canManage={canManageLoyalty} /> : null}

      {activeTab === 'access' ? (
        <div className="content-grid two-columns">
          <article className="panel">
            <div className="panel-head">
              <h4>Perfis e permissões</h4>
              <span className="chip">{roleCount} perfis</span>
            </div>
            <div className="record-list">
              {roles.map((role) => (
                <button key={role.id} type="button" className={`record-row ${roleForm.id === role.id ? 'is-active' : ''}`} onClick={() => setRoleForm(buildRoleForm(role))}>
                  <div>
                    <strong>{role.name}</strong>
                    <small>{role.code} · {role.permissions.length} permissões</small>
                  </div>
                  <span className="chip">{role.permissions.length}</span>
                </button>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <h4>{roleForm.id ? 'Editar perfil' : 'Novo perfil'}</h4>
              <button type="button" className="chip-button" onClick={() => setRoleForm(emptyRoleForm())}>Novo</button>
            </div>
            <div className="form-grid">
              <TouchInput label="Código" value={roleForm.code} onChange={(value) => setRoleForm((current) => ({ ...current, code: value }))} />
              <TouchInput label="Nome" value={roleForm.name} onChange={(value) => setRoleForm((current) => ({ ...current, name: value }))} />
            </div>
            <TouchTextarea label="Descrição" value={roleForm.description} onChange={(value) => setRoleForm((current) => ({ ...current, description: value }))} rows={3} />
            <div className="permission-groups">
              {Object.entries(groupedPermissions).map(([moduleName, modulePermissions]) => (
                <div key={moduleName} className="permission-block">
                  <strong>{moduleName}</strong>
                  <div className="toggle-grid">
                    {modulePermissions.map((permission) => {
                      const selected = roleForm.permissionIds.includes(permission.id)
                      return (
                        <label key={permission.id} className="toggle-card">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) =>
                              setRoleForm((current) => ({
                                ...current,
                                permissionIds: event.target.checked
                                  ? [...current.permissionIds, permission.id]
                                  : current.permissionIds.filter((permissionId) => permissionId !== permission.id),
                              }))
                            }
                          />
                          <span>{permission.name}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="form-actions">
              <button type="button" className="primary-button" onClick={() => void handleSaveRole()} disabled={!canOperateSecurity || savingRole}>
                {savingRole ? 'A guardar...' : roleForm.id ? 'Atualizar perfil' : 'Criar perfil'}
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {activeTab === 'printers' ? (
        <PrintersTab />
      ) : null}
    </section>
  )
}

function PrintersTab() {
  const [printerName, setPrinterName] = useState(
    () => localStorage.getItem('thermal_printer_name') ?? '',
  )
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>(
    () => (localStorage.getItem('receipt_width') as '58mm' | '80mm') ?? '80mm',
  )
  const [autoPrint, setAutoPrint] = useState(
    () => localStorage.getItem('auto_print_receipt') === 'true',
  )
  const [header, setHeader] = useState(
    () => localStorage.getItem('receipt_header') ?? '',
  )
  const [footer, setFooter] = useState(
    () => localStorage.getItem('receipt_footer') ?? 'Obrigado pela preferência!',
  )
  const [bizName, setBizName] = useState(
    () => localStorage.getItem('receipt_business_name') ?? 'O Capitão',
  )
  const [saved, setSaved] = useState(false)

  function save() {
    localStorage.setItem('thermal_printer_name', printerName)
    localStorage.setItem('receipt_width', paperWidth)
    localStorage.setItem('auto_print_receipt', String(autoPrint))
    localStorage.setItem('receipt_header', header)
    localStorage.setItem('receipt_footer', footer)
    localStorage.setItem('receipt_business_name', bizName)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function testPrint() {
    const win = window.open('', '_blank', 'width=400,height=600')
    if (!win) return
    win.document.write(`
      <html><head><title>Teste de Impressão</title>
      <style>
        body { font-family: monospace; font-size: 12px; margin: 0; padding: 8px; width: ${paperWidth}; }
        hr { border: none; border-top: 1px dashed #000; }
        .center { text-align: center; }
        .row { display: flex; justify-content: space-between; }
      </style></head><body>
      ${header ? `<p class="center">${header}</p><hr>` : ''}
      <p class="center"><strong>${bizName}</strong></p>
      <p class="center">Teste de impressão</p>
      <p class="center">${new Date().toLocaleString('pt-MZ')}</p>
      <hr>
      <div class="row"><span>Artigo de teste ×1</span><span>100,00 MT</span></div>
      <div class="row"><span>Outro artigo ×2</span><span>200,00 MT</span></div>
      <hr>
      <div class="row"><strong>TOTAL</strong><strong>300,00 MT</strong></div>
      <div class="row"><span>Pagamento</span><span>Dinheiro</span></div>
      <div class="row"><span>Recebido</span><span>400,00 MT</span></div>
      <div class="row"><strong>Troco</strong><strong>100,00 MT</strong></div>
      <hr>
      ${footer ? `<p class="center">${footer}</p>` : ''}
      </body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 500)
  }

  return (
    <div className="content-grid two-columns">
      <article className="panel">
        <div className="panel-head">
          <h4>Configuração da impressora</h4>
          <span className="chip">Impressora térmica</span>
        </div>
        <div className="form-grid">
          <div className="form-field">
            <label className="touch-label" htmlFor="printer-name">
              Nome / porta da impressora
            </label>
            <input
              id="printer-name"
              type="text"
              className="touch-input"
              value={printerName}
              onChange={(e) => setPrinterName(e.target.value)}
              placeholder="Ex.: POS58, COM3, USB001"
            />
            <small style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
              Configure a impressora como impressora padrão do sistema para impressão automática.
            </small>
          </div>

          <div className="form-field">
            <span className="touch-label">Largura do papel</span>
            <div className="chip-group">
              {(['58mm', '80mm'] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  className={`chip-button${paperWidth === w ? ' is-selected' : ''}`}
                  onClick={() => setPaperWidth(w)}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
            <input
              id="auto-print"
              type="checkbox"
              checked={autoPrint}
              onChange={(e) => setAutoPrint(e.target.checked)}
              style={{ width: '1.2rem', height: '1.2rem' }}
            />
            <label htmlFor="auto-print" className="touch-label" style={{ margin: 0 }}>
              Imprimir recibo automaticamente após pagamento
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="ghost-button" onClick={testPrint}>
            🖨 Imprimir página de teste
          </button>
          <button type="button" className="primary-button" onClick={save}>
            {saved ? '✓ Guardado' : 'Guardar configuração'}
          </button>
        </div>
      </article>

      <article className="panel">
        <div className="panel-head">
          <h4>Cabeçalho e rodapé do recibo</h4>
        </div>
        <div className="form-grid">
          <div className="form-field">
            <label className="touch-label" htmlFor="biz-name-receipt">
              Nome do negócio no recibo
            </label>
            <input
              id="biz-name-receipt"
              type="text"
              className="touch-input"
              value={bizName}
              onChange={(e) => setBizName(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="touch-label" htmlFor="receipt-header">
              Cabeçalho (texto livre)
            </label>
            <textarea
              id="receipt-header"
              className="touch-input"
              rows={3}
              value={header}
              onChange={(e) => setHeader(e.target.value)}
              placeholder="Ex.: NIF: 123456789 | Tel: 84 000 0000"
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="form-field">
            <label className="touch-label" htmlFor="receipt-footer">
              Rodapé (texto livre)
            </label>
            <textarea
              id="receipt-footer"
              className="touch-input"
              rows={3}
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              placeholder="Ex.: Obrigado pela preferência!"
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="primary-button" onClick={save}>
            {saved ? '✓ Guardado' : 'Guardar configuração'}
          </button>
        </div>
      </article>
    </div>
  )
}
