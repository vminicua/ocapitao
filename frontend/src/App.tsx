import { startTransition, useEffect, useEffectEvent, useState } from 'react'

import { ModuleMenu } from './components/layout/ModuleMenu'
import { Navbar } from './components/layout/Navbar'
import { OnScreenKeyboard } from './components/touch/OnScreenKeyboard'
import { SplashScreen } from './components/layout/SplashScreen'
import { LoginScreen } from './features/auth/LoginScreen'
import { ChangePinScreen } from './features/auth/ChangePinScreen'
import { BarView } from './features/bar/BarView'
import { AgendaView } from './features/agenda/AgendaView'
import { BarbershopView } from './features/barbershop/BarbershopView'
import { CarwashView } from './features/carwash/CarwashView'
import { DashboardView } from './features/dashboard/DashboardView'
import { FinancasView } from './features/financas/FinancasView'
import { ReportsView } from './features/reports/ReportsView'
import { SettingsView } from './features/settings/SettingsView'
import { CustomersView } from './features/customers/CustomersView'
import { StockView } from './features/stock/StockView'
import { showErrorAlert, showSuccessToast, showWarningToast } from './lib/alerts'
import {
  connectCloud,
  changePin,
  createAppointment,
  createBackup,
  cancelSale,
  completeSale,
  closeCashSession,
  createCustomer,
  createVehicle,
  createProduct,
  createProductCategory,
  createRole,
  createService,
  createServiceCategory,
  createStockMovement,
  createUser,
  deactivateUser,
  deleteStockMovement,
  disconnectCloud,
  getAppointments,
  getCurrentUser,
  getCurrentCashSession,
  getCommissions,
  getBackups,
  getCustomers,
  getDashboardSummary,
  getEmployees,
  getPermissions,
  getProductCategories,
  getProducts,
  getPublicHealth,
  getRoles,
  getSales,
  getServiceCategories,
  getServices,
  getSettings,
  getStockMovements,
  getSyncStatus,
  getSyncQueue,
  getUsers,
  getVehicles,
  signIn,
  openCashSession,
  receiveSalePayment,
  triggerSyncNow,
  startAppointment,
  restoreBackup,
  resolveSyncConflict,
  updateCustomer,
  updateAppointment,
  updateProduct,
  updateProductCategory,
  updateRole,
  updateService,
  updateServiceCategory,
  updateSettings,
  updateUser,
  updateVehicle,
} from './lib/api'
import type {
  AppSettings,
  Appointment,
  AuthSession,
  AuthUser,
  Customer,
  Transaction,
  DashboardSummary,
  ModuleId,
  PermissionDefinition,
  Product,
  ProductCategory,
  RoleRecord,
  SaleRecord,
  CashSessionRecord,
  EmployeeRecord,
  CommissionRecord,
  BackupRecord,
  SyncQueueRecord,
  Service,
  ServiceCategory,
  StockMovement,
  SyncState,
  UserRecord,
  Vehicle,
} from './types/models'

const STORAGE_KEY = 'ocapitao.auth'

interface AppData {
  appointments: Appointment[]
  customers: Customer[]
  dashboard: DashboardSummary
  permissions: PermissionDefinition[]
  productCategories: ProductCategory[]
  products: Product[]
  roles: RoleRecord[]
  serviceCategories: ServiceCategory[]
  services: Service[]
  settings: AppSettings
  stockMovements: StockMovement[]
  syncState: SyncState
  users: UserRecord[]
  vehicles: Vehicle[]
  sales: SaleRecord[]
  cashSession: CashSessionRecord | null
  employees: EmployeeRecord[]
  commissions: CommissionRecord[]
  backups: BackupRecord[]
  syncQueue: SyncQueueRecord[]
}

const offlineSyncState: SyncState = { online: false, pending_count: 0, mode: 'offline' }
const emptyDashboard: DashboardSummary = {
  data: '', total_vendas: 0, totais_por_area: {}, servicos_pendentes: 0,
  caixa_aberto: false, estado_sincronizacao: offlineSyncState,
}
const defaultSettings: AppSettings = {
  id: '', business_name: 'O Capitão', legal_name: '', nuit: '', address: '', city: '', country: 'Moçambique',
  phone: '', email: '', currency_code: 'MZN', currency_symbol: 'MT', timezone: 'Africa/Maputo', tax_rate: 0,
  appointment_slot_minutes: 30, receipt_header: '', receipt_footer: '', printer_name: '', business_hours: '',
  backup_folder: '', ssh_tunnel_command: '', sync_interval_seconds: 60, auto_sync_enabled: false,
  enable_barbershop_module: true, enable_bar_module: true, enable_carwash_module: true, enable_pos_module: true,
  enable_reports_module: true, allow_walk_in: true, enable_low_stock_alerts: true, allow_negative_stock: false,
  require_pin_on_sale: false, default_markup_percent: 0, default_commission_percent: 0, dark_mode: false,
}
const emptyData: AppData = {
  appointments: [], customers: [], dashboard: emptyDashboard, permissions: [], productCategories: [], products: [],
  roles: [], serviceCategories: [], services: [], settings: defaultSettings, stockMovements: [],
  syncState: offlineSyncState, users: [], vehicles: [],
  sales: [],
  cashSession: null,
  employees: [],
  commissions: [],
  backups: [],
  syncQueue: [],
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Dinheiro',
  card: 'Cartão',
  mpesa: 'M-Pesa',
  transfer: 'Transferência',
  other: 'Outro',
}

function saleToTransaction(sale: SaleRecord): Transaction {
  const payment = sale.payments[0]
  return {
    id: sale.id,
    label: sale.label || sale.customer_name || `Venda ${sale.id.slice(0, 8)}`,
    source: sale.department,
    items: sale.items.map((item) => ({
      uid: item.id,
      product_id: item.product_id ?? undefined,
      service_id: item.service_id ?? undefined,
      label: item.description,
      price: Number(item.unit_price),
      kind: item.item_type,
      department: sale.department,
      has_stock: item.item_type === 'product',
      quantity: Number(item.quantity),
    })),
    payment_method: sale.payment_status === 'paid' ? PAYMENT_LABELS[payment?.method] ?? 'Outro' : 'Crédito',
    subtotal: Number(sale.subtotal),
    discount: Number(sale.discount_amount),
    total: Number(sale.total_amount),
    created_at: new Date(sale.created_at).getTime(),
    status: sale.payment_status === 'paid' ? 'completed' : 'pending',
    note: sale.notes,
  }
}

function readStoredSession(): AuthSession {
  const rawSession = localStorage.getItem(STORAGE_KEY)
  if (!rawSession) {
    return {
      accessToken: null,
      refreshToken: null,
      user: null,
    }
  }

  try {
    return JSON.parse(rawSession) as AuthSession
  } catch {
    return {
      accessToken: null,
      refreshToken: null,
      user: null,
    }
  }
}

function hasAnyPermission(user: AuthUser | null, permissionCodes: string[]) {
  if (!user) {
    return false
  }
  if (user.is_superuser) {
    return true
  }

  const rolePermissions = user.role?.permissions?.map((permission) => permission.code) ?? []
  return permissionCodes.some((code) => rolePermissions.includes(code))
}

function getVisibleModules(user: AuthUser | null, settings: AppSettings): Array<Exclude<ModuleId, 'menu'>> {
  const modules: Array<Exclude<ModuleId, 'menu'>> = []

  if (hasAnyPermission(user, ['dashboard.view'])) modules.push('dashboard')
  if (settings.enable_barbershop_module && hasAnyPermission(user, ['barbershop.view', 'barbershop.manage'])) {
    modules.push('barbershop')
  }
  if (settings.enable_bar_module && hasAnyPermission(user, ['bar.view', 'bar.manage'])) {
    modules.push('bar')
  }
  if (settings.enable_carwash_module && hasAnyPermission(user, ['carwash.view', 'carwash.manage'])) {
    modules.push('carwash')
  }
  if (settings.enable_pos_module && hasAnyPermission(user, ['pos.view', 'pos.manage'])) {
    modules.push('caixa')
  }
  if (hasAnyPermission(user, ['inventory.view', 'inventory.manage'])) {
    modules.push('stock')
  }
  if (hasAnyPermission(user, ['appointments.view', 'appointments.manage'])) modules.push('agenda')
  if (hasAnyPermission(user, ['customers.view', 'customers.manage', 'vehicles.view', 'vehicles.manage'])) modules.push('customers')
  if (settings.enable_reports_module && hasAnyPermission(user, ['reports.view'])) {
    modules.push('reports')
  }
  if (hasAnyPermission(user, ['settings.view', 'settings.manage', 'users.view', 'users.manage', 'loyalty.view', 'promotions.view', 'promotions.manage'])) {
    modules.push('settings')
  }

  return modules
}

function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>('menu')
  const [moduleHistory, setModuleHistory] = useState<ModuleId[]>([])
  const [appData, setAppData] = useState<AppData>(emptyData)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Bem-vindo ao cockpit operacional do O Capitão.')
  const [publicSyncState, setPublicSyncState] = useState<SyncState>({
    ...offlineSyncState,
    api_online: false,
    label: 'A verificar serviços locais',
    last_error: 'Ainda estamos a validar a API local e a cloud.',
  })
  const [showSplash, setShowSplash] = useState(true)
  const [session, setSession] = useState<AuthSession>(readStoredSession)

  const persistSession = (nextSession: AuthSession) => {
    setSession(nextSession)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession))
  }

  const refreshPublicHealth = useEffectEvent(async () => {
    try {
      const status = await getPublicHealth()
      setPublicSyncState(status)
    } catch {
      setPublicSyncState({
        online: false,
        api_online: false,
        remote_api_online: false,
        database_online: false,
        postgres_online: false,
        pending_count: 0,
        mode: 'offline',
        label: 'API local desligada',
        last_error: 'O frontend não conseguiu contactar o Django local em http://127.0.0.1:8000/api.',
      })
    }
  })

  const loadApplicationData = useEffectEvent(async (accessToken: string) => {
    const [
      userResult,
      dashboardResult,
      productsResult,
      productCategoriesResult,
      serviceCategoriesResult,
      stockMovementsResult,
      servicesResult,
      customersResult,
      appointmentsResult,
      vehiclesResult,
      settingsResult,
      syncResult,
      permissionsResult,
      rolesResult,
      usersResult,
      salesResult,
      cashSessionResult,
      employeesResult,
      commissionsResult,
      backupsResult,
      syncQueueResult,
    ] = await Promise.allSettled([
      getCurrentUser(accessToken),
      getDashboardSummary(accessToken),
      getProducts(accessToken),
      getProductCategories(accessToken),
      getServiceCategories(accessToken),
      getStockMovements(accessToken),
      getServices(accessToken),
      getCustomers(accessToken),
      getAppointments(accessToken),
      getVehicles(accessToken),
      getSettings(accessToken),
      getSyncStatus(accessToken),
      getPermissions(accessToken),
      getRoles(accessToken),
      getUsers(accessToken),
      getSales(accessToken),
      getCurrentCashSession(accessToken),
      getEmployees(accessToken),
      getCommissions(accessToken),
      getBackups(accessToken),
      getSyncQueue(accessToken),
    ])

    const failures = [
      userResult,
      dashboardResult,
      productsResult,
      productCategoriesResult,
      serviceCategoriesResult,
      stockMovementsResult,
      servicesResult,
      customersResult,
      appointmentsResult,
      vehiclesResult,
      settingsResult,
      syncResult,
      permissionsResult,
      rolesResult,
      usersResult,
      salesResult,
      cashSessionResult,
      employeesResult,
      commissionsResult,
      backupsResult,
      syncQueueResult,
    ].filter((item) => item.status === 'rejected').length

    setAppData({
      dashboard: dashboardResult.status === 'fulfilled' ? dashboardResult.value : emptyDashboard,
      products: productsResult.status === 'fulfilled' ? productsResult.value : [],
      productCategories: productCategoriesResult.status === 'fulfilled' ? productCategoriesResult.value : [],
      serviceCategories: serviceCategoriesResult.status === 'fulfilled' ? serviceCategoriesResult.value : [],
      stockMovements: stockMovementsResult.status === 'fulfilled' ? stockMovementsResult.value : [],
      services: servicesResult.status === 'fulfilled' ? servicesResult.value : [],
      customers: customersResult.status === 'fulfilled' ? customersResult.value : [],
      appointments: appointmentsResult.status === 'fulfilled' ? appointmentsResult.value : [],
      vehicles: vehiclesResult.status === 'fulfilled' ? vehiclesResult.value : [],
      settings: settingsResult.status === 'fulfilled' && settingsResult.value ? settingsResult.value : defaultSettings,
      syncState: syncResult.status === 'fulfilled' ? syncResult.value : offlineSyncState,
      permissions: permissionsResult.status === 'fulfilled' ? permissionsResult.value : [],
      roles: rolesResult.status === 'fulfilled' ? rolesResult.value : [],
      users: usersResult.status === 'fulfilled' ? usersResult.value : [],
      sales: salesResult.status === 'fulfilled' ? salesResult.value : [],
      cashSession: cashSessionResult.status === 'fulfilled' ? cashSessionResult.value : null,
      employees: employeesResult.status === 'fulfilled' ? employeesResult.value : [],
      commissions: commissionsResult.status === 'fulfilled' ? commissionsResult.value : [],
      backups: backupsResult.status === 'fulfilled' ? backupsResult.value : [],
      syncQueue: syncQueueResult.status === 'fulfilled' ? syncQueueResult.value : [],
    })
    setTransactions(salesResult.status === 'fulfilled' ? salesResult.value.map(saleToTransaction) : [])

    if (userResult.status === 'fulfilled') {
      setSession((current) => {
        const nextSession = { ...current, accessToken, user: userResult.value }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession))
        return nextSession
      })
    }

    setMessage(
      failures === 0
        ? 'Tudo pronto. Escolha um módulo e continue a operação.'
        : 'Alguns dados não puderam ser carregados. Nenhum dado demonstrativo foi usado.',
    )
  })

  const runWithReload = useEffectEvent(async (action: (accessToken: string) => Promise<unknown>) => {
    const accessToken = session.accessToken
    if (!accessToken) {
      throw new Error('Sessão expirada.')
    }

    const result = await action(accessToken)
    await loadApplicationData(accessToken)
    return result
  })

  useEffect(() => {
    void refreshPublicHealth()
    const timer = window.setInterval(() => {
      void refreshPublicHealth()
    }, 30000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const splashTimer = window.setTimeout(() => setShowSplash(false), 1900)
    return () => window.clearTimeout(splashTimer)
  }, [])

  useEffect(() => {
    if (!session.accessToken) {
      return
    }
    void loadApplicationData(session.accessToken)
  }, [session.accessToken])

  useEffect(() => {
    if (!session.accessToken) {
      return
    }
    const timer = window.setInterval(() => {
      void loadApplicationData(session.accessToken as string)
    }, 45000)

    return () => window.clearInterval(timer)
  }, [session.accessToken])

  const visibleModules = getVisibleModules(session.user, appData.settings)
  const canOpenSettings = visibleModules.includes('settings')
  const canManageSettings = hasAnyPermission(session.user, ['settings.manage'])
  const canManageUsers = hasAnyPermission(session.user, ['users.manage'])
  const canManageStock = hasAnyPermission(session.user, ['inventory.manage'])
  const canViewPurchases = hasAnyPermission(session.user, ['purchases.view', 'purchases.manage'])
  const canManagePurchases = hasAnyPermission(session.user, ['purchases.manage'])
  const canCancelSales = hasAnyPermission(session.user, ['sales.cancel'])
  const canApplyDiscount = hasAnyPermission(session.user, ['sales.discount'])
  const canManageCustomers = hasAnyPermission(session.user, ['customers.manage'])
  const canManageAppointments = hasAnyPermission(session.user, ['appointments.manage'])
  const canExportReports = hasAnyPermission(session.user, ['reports.export'])
  const canManageLoyalty = hasAnyPermission(session.user, ['promotions.manage', 'loyalty.adjust'])

  useEffect(() => {
    if (activeModule === 'menu') {
      return
    }
    if (!visibleModules.includes(activeModule as Exclude<ModuleId, 'menu'>)) {
      setActiveModule('menu')
      setModuleHistory([])
    }
  }, [activeModule, visibleModules])

  async function handleLogin(userId: number, pin: string) {
    setBusy(true)
    try {
      const nextSession = await signIn(userId, pin)
      persistSession(nextSession)
      await loadApplicationData(nextSession.accessToken as string)
      setActiveModule('menu')
      setModuleHistory([])
      void showSuccessToast('Login efetuado com sucesso.')
    } catch (error) {
      if (!publicSyncState.api_online) {
        void showErrorAlert(
          'Backend local desligado',
          'Inicie o Django local em 127.0.0.1:8000 antes de tentar entrar.',
        )
      } else {
        void showErrorAlert(
          'Não foi possível entrar',
          'Confirme as credenciais e volte a tentar.',
        )
      }
      console.error(error)
    } finally {
      setBusy(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY)
    setSession({
      accessToken: null,
      refreshToken: null,
      user: null,
    })
    setActiveModule('menu')
    setModuleHistory([])
    setAppData(emptyData)
    setMessage('Sessão terminada.')
  }

  function handleSwitchUser() {
    localStorage.removeItem(STORAGE_KEY)
    setSession({
      accessToken: null,
      refreshToken: null,
      user: null,
    })
    setActiveModule('menu')
    setModuleHistory([])
    setMessage('Escolha outro utilizador para continuar.')
  }

  async function handleCloudConnect(password: string): Promise<{ ok: boolean; message: string }> {
    try {
      const result = await connectCloud(session.accessToken!, password)
      if (result.ok) {
        void refreshPublicHealth()
        void pollUntilCloudReady()
      }
      return result
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Erro de comunicação com o servidor.' }
    }
  }

  async function pollUntilCloudReady() {
    for (let i = 0; i < 20; i++) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 3000))
      try {
        const s = await getPublicHealth()
        setPublicSyncState(s)
        if (s.database_online) {
          void showSuccessToast('Cloud ligada com sucesso.')
          return
        }
      } catch {
        // keep polling
      }
    }
  }

  async function handleCloudDisconnect() {
    try {
      await disconnectCloud(session.accessToken!)
    } catch {
      // ignore errors on disconnect
    }
    await refreshPublicHealth()
  }

  async function handleSyncNow() {
    if (!session.accessToken) {
      setMessage('Faça login para sincronizar os dados.')
      return
    }

    try {
      const result = await triggerSyncNow(session.accessToken)
      setMessage(`${result.message} Sincronizados: ${result.synced_count}. Falhas: ${result.failed_count}.`)
      const syncState = await getSyncStatus(session.accessToken)
      setAppData((current) => ({ ...current, syncState }))
      await refreshPublicHealth()
      if (result.failed_count > 0) {
        void showWarningToast('Sincronização concluída com pendências.')
      } else {
        void showSuccessToast('Sincronização concluída com sucesso.')
      }
    } catch (error) {
      setMessage('Não foi possível sincronizar agora. Verifique o túnel SSH e a API remota.')
      void showErrorAlert(
        'Falha ao sincronizar',
        'Verifique o túnel SSH, a password do MySQL e a API remota.',
      )
      console.error(error)
    }
  }

  async function handleTransactionComplete(transaction: Transaction) {
    await runWithReload((accessToken) => completeSale(accessToken, {
      department: transaction.source,
      label: transaction.label,
      customer_name: transaction.customer_name ?? '',
      customer_id: transaction.customer_id,
      vehicle_id: transaction.vehicle_id,
      operational_session_id: transaction.operational_session_id,
      responsible_employee_id: transaction.responsible_employee_id,
      discount_amount: transaction.discount,
      payment_method: transaction.payment_method,
      notes: transaction.note ?? '',
      items: transaction.items.map((item) => ({
        product_id: item.product_id,
        service_id: item.service_id,
        quantity: item.quantity,
      })),
    }))
    void showSuccessToast(`Pagamento de "${transaction.label}" registado — ${transaction.payment_method}.`)
  }

  async function handleChangePin(currentPin: string, newPin: string) {
    if (!session.accessToken) return
    setBusy(true)
    try {
      await changePin(session.accessToken, currentPin, newPin)
      void showSuccessToast('PIN alterado. Entre novamente com o novo PIN.')
      handleLogout()
    } catch (error) {
      console.error(error)
      void showErrorAlert('Não foi possível alterar o PIN', 'Confirme o PIN atual e escolha um novo PIN menos previsível.')
    } finally {
      setBusy(false)
    }
  }

  async function handleOpenCash(openingAmount: number) {
    await runWithReload((accessToken) => openCashSession(accessToken, openingAmount))
    void showSuccessToast('Caixa aberto com sucesso.')
  }

  async function handleCloseCash(closingAmount: number) {
    if (!appData.cashSession) throw new Error('Não existe caixa aberto.')
    await runWithReload((accessToken) => closeCashSession(accessToken, appData.cashSession!.id, closingAmount))
    void showSuccessToast('Caixa fechado com sucesso.')
  }

  async function handleCancelTransaction(id: string) {
    await runWithReload((accessToken) => cancelSale(accessToken, id))
    void showSuccessToast('Transação cancelada.')
  }

  async function handleMarkAsPaid(id: string, method: string) {
    const aliases: Record<string, string> = {
      Dinheiro: 'cash', Cartão: 'card', 'M-Pesa': 'mpesa', Transferência: 'transfer', Outro: 'other',
    }
    await runWithReload((accessToken) => receiveSalePayment(accessToken, id, aliases[method] ?? 'other'))
    void showSuccessToast(`Dívida quitada — ${method}.`)
  }

  function navigateTo(nextModule: ModuleId) {
    if (nextModule === activeModule) {
      return
    }
    if (nextModule !== 'menu' && !visibleModules.includes(nextModule as Exclude<ModuleId, 'menu'>)) {
      setMessage('Este módulo não está disponível para o seu perfil ou está desativado.')
      return
    }
    setModuleHistory((current) => [...current, activeModule])
    startTransition(() => setActiveModule(nextModule))
  }

  function navigateHome() {
    setModuleHistory([])
    startTransition(() => setActiveModule('menu'))
  }

  function navigateBack() {
    if (moduleHistory.length === 0) {
      return
    }
    const previousModule = moduleHistory[moduleHistory.length - 1]
    setModuleHistory((current) => current.slice(0, -1))
    startTransition(() => setActiveModule(previousModule))
  }

  function renderModule() {
    switch (activeModule) {
      case 'menu':
        return <ModuleMenu onSelect={navigateTo} visibleModules={visibleModules} />
      case 'dashboard':
        return <DashboardView dashboard={appData.dashboard} />
      case 'barbershop':
        return (
          <BarbershopView
            canApplyDiscount={canApplyDiscount}
            accessToken={session.accessToken!}
            appointments={appData.appointments}
            customers={appData.customers}
            employees={appData.employees}
            products={appData.products.filter((product) => product.department === 'barbershop')}
            services={appData.services}
            onTransactionComplete={handleTransactionComplete}
          />
        )
      case 'bar':
        return (
          <BarView
            canApplyDiscount={canApplyDiscount}
            accessToken={session.accessToken!}
            products={appData.products.filter((product) => product.department === 'bar')}
            customers={appData.customers}
            employees={appData.employees}
            onTransactionComplete={handleTransactionComplete}
          />
        )
      case 'carwash':
        return (
          <CarwashView
            canApplyDiscount={canApplyDiscount}
            accessToken={session.accessToken!}
            appointments={appData.appointments}
            customers={appData.customers}
            products={appData.products.filter((product) => product.department === 'carwash')}
            services={appData.services}
            vehicles={appData.vehicles}
            employees={appData.employees}
            onTransactionComplete={handleTransactionComplete}
          />
        )
      case 'caixa':
        return (
          <FinancasView
            accessToken={session.accessToken ?? ''}
            transactions={transactions}
            cashSession={appData.cashSession}
            onOpenCash={handleOpenCash}
            onCloseCash={handleCloseCash}
            onCancelTransaction={handleCancelTransaction}
            onMarkAsPaid={handleMarkAsPaid}
            canCancel={canCancelSales}
          />
        )
      case 'stock':
        return (
          <StockView
            accessToken={session.accessToken ?? ''}
            categories={appData.productCategories}
            currentUser={session.user}
            movements={appData.stockMovements}
            products={appData.products}
            canManageStock={canManageStock}
            canViewPurchases={canViewPurchases}
            canManagePurchases={canManagePurchases}
            onDeleteMovement={(movementId) =>
              runWithReload((accessToken) => deleteStockMovement(accessToken, movementId))
            }
            onSaveCategory={(payload, categoryId) =>
              runWithReload((accessToken) =>
                categoryId
                  ? updateProductCategory(accessToken, categoryId, payload)
                  : createProductCategory(accessToken, payload),
              )
            }
            onSaveProduct={(payload, productId) =>
              runWithReload((accessToken) =>
                productId ? updateProduct(accessToken, productId, payload) : createProduct(accessToken, payload),
              )
            }
            onSaveMovement={(payload) => runWithReload((accessToken) => createStockMovement(accessToken, payload))}
          />
        )
      case 'customers':
        return (
          <CustomersView
            customers={appData.customers}
            appointments={appData.appointments}
            vehicles={appData.vehicles}
            employees={appData.employees}
            canManage={canManageCustomers}
            onSaveCustomer={(payload, customerId) =>
              runWithReload((accessToken) =>
                customerId
                  ? updateCustomer(accessToken, customerId, payload)
                  : createCustomer(accessToken, payload),
              )
            }
            onSaveVehicle={(payload, vehicleId) => runWithReload((token) => vehicleId ? updateVehicle(token, vehicleId, payload) : createVehicle(token, payload))}
          />
        )
      case 'agenda':
        return (
          <AgendaView
            canManage={canManageAppointments}
            appointments={appData.appointments}
            customers={appData.customers}
            employees={appData.employees}
            services={appData.services}
            onSave={(payload, id) => canManageAppointments ? runWithReload((token) => id ? updateAppointment(token, id, payload) : createAppointment(token, payload)) : Promise.reject(new Error('Sem permissão para gerir agenda.'))}
            onStart={(id) => canManageAppointments ? runWithReload((token) => startAppointment(token, id)) : Promise.reject(new Error('Sem permissão para iniciar atendimentos.'))}
          />
        )
      case 'reports':
        return <ReportsView appointments={appData.appointments} commissions={appData.commissions} dashboard={appData.dashboard} accessToken={session.accessToken ?? ''} canExport={canExportReports} />
      case 'settings':
        return (
          <SettingsView
            accessToken={session.accessToken ?? ''}
            backups={appData.backups}
            syncQueue={appData.syncQueue}
            currentUser={session.user}
            permissions={appData.permissions}
            roles={appData.roles}
            serviceCategories={appData.serviceCategories}
            services={appData.services}
            settings={appData.settings}
            syncState={appData.syncState}
            users={appData.users}
            canManageSettings={canManageSettings}
            canManageUsers={canManageUsers}
            canManageLoyalty={canManageLoyalty}
            onDeactivateUser={(userId) => runWithReload((accessToken) => deactivateUser(accessToken, userId))}
            onCreateBackup={() => runWithReload((token) => createBackup(token))}
            onRestoreBackup={(file) => runWithReload((token) => restoreBackup(token, file))}
            onResolveSync={(id, resolution) => runWithReload((token) => resolveSyncConflict(token, id, resolution))}
            onSaveRole={(payload, roleId) =>
              runWithReload((accessToken) =>
                roleId ? updateRole(accessToken, roleId, payload) : createRole(accessToken, payload),
              )
            }
            onSaveSettings={(payload) =>
              runWithReload((accessToken) => updateSettings(accessToken, appData.settings.id, payload))
            }
            onSaveService={(payload, serviceId) =>
              runWithReload((accessToken) =>
                serviceId ? updateService(accessToken, serviceId, payload) : createService(accessToken, payload),
              )
            }
            onSaveServiceCategory={(payload, categoryId) =>
              runWithReload((accessToken) =>
                categoryId
                  ? updateServiceCategory(accessToken, categoryId, payload)
                  : createServiceCategory(accessToken, payload),
              )
            }
            onSaveUser={(payload, userId) =>
              runWithReload((accessToken) =>
                userId ? updateUser(accessToken, userId, payload) : createUser(accessToken, payload),
              )
            }
            onSyncNow={() => void handleSyncNow()}
          />
        )
      default:
        return <ModuleMenu onSelect={navigateTo} visibleModules={visibleModules} />
    }
  }

  const currentSyncState = session.user
    ? {
        ...appData.syncState,
        api_online: publicSyncState.api_online,
      }
    : publicSyncState
  const currentUserName =
    session.user?.display_name ||
    [session.user?.first_name, session.user?.last_name].filter(Boolean).join(' ').trim() ||
    session.user?.username ||
    'Utilizador'

  const splashCloudStatus = publicSyncState.database_online
    ? 'connected'
    : publicSyncState.has_cloud_credentials
      ? 'connecting'
      : 'offline'

  if (showSplash) {
    return <SplashScreen cloudStatus={splashCloudStatus} />
  }

  if (!session.user) {
    return (
      <>
        <LoginScreen
          busy={busy}
          onLogin={handleLogin}
          syncState={currentSyncState}
        />
        <OnScreenKeyboard />
      </>
    )
  }

  if (session.user.force_password_change) {
    return (
      <>
        <ChangePinScreen busy={busy} onCancel={handleLogout} onChangePin={handleChangePin} />
        <OnScreenKeyboard />
      </>
    )
  }

  return (
    <>
      <div className="app-shell app-shell--light">
        <Navbar
          canGoBack={moduleHistory.length > 0}
          canOpenSettings={canOpenSettings}
          onCloudConnect={handleCloudConnect}
          onCloudDisconnect={handleCloudDisconnect}
          onGoBack={navigateBack}
          onLogout={handleLogout}
          onOpenMenu={navigateHome}
          onOpenSettings={() => navigateTo('settings')}
          onSwitchUser={handleSwitchUser}
          syncState={currentSyncState}
          userName={currentUserName}
        />

        <div className="main-shell">
          <main className={`workspace ${activeModule === 'menu' ? 'workspace--menu' : ''}`} aria-label={message}>
            {renderModule()}
          </main>
        </div>
      </div>
      <OnScreenKeyboard />
    </>
  )
}

export default App
