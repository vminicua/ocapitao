import { startTransition, useEffect, useEffectEvent, useState } from 'react'

import { ModuleMenu } from './components/layout/ModuleMenu'
import { Navbar } from './components/layout/Navbar'
import { OnScreenKeyboard } from './components/touch/OnScreenKeyboard'
import { SplashScreen } from './components/layout/SplashScreen'
import { LoginScreen } from './features/auth/LoginScreen'
import { BarView } from './features/bar/BarView'
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
  createCustomer,
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
  getCustomers,
  getDashboardSummary,
  getPermissions,
  getProductCategories,
  getProducts,
  getPublicHealth,
  getRoles,
  getServiceCategories,
  getServices,
  getSettings,
  getStockMovements,
  getSyncStatus,
  getUsers,
  getVehicles,
  signIn,
  triggerSyncNow,
  updateCustomer,
  updateProduct,
  updateProductCategory,
  updateRole,
  updateService,
  updateServiceCategory,
  updateSettings,
  updateUser,
} from './lib/api'
import {
  mockAppointments,
  mockCategories,
  mockCustomers,
  mockDashboard,
  mockPermissions,
  mockProducts,
  mockRoles,
  mockServiceCategories,
  mockServices,
  mockSettings,
  mockStockMovements,
  mockSyncState,
  mockUsers,
  mockVehicles,
} from './lib/mockData'
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
}

const demoData: AppData = {
  appointments: mockAppointments,
  customers: mockCustomers,
  dashboard: mockDashboard,
  permissions: mockPermissions,
  productCategories: mockCategories,
  products: mockProducts,
  roles: mockRoles,
  serviceCategories: mockServiceCategories,
  services: mockServices,
  settings: mockSettings,
  stockMovements: mockStockMovements,
  syncState: mockSyncState,
  users: mockUsers,
  vehicles: mockVehicles,
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
  const modules: Array<Exclude<ModuleId, 'menu'>> = ['dashboard']

  if (settings.enable_barbershop_module) {
    modules.push('barbershop')
  }
  if (settings.enable_bar_module) {
    modules.push('bar')
  }
  if (settings.enable_carwash_module) {
    modules.push('carwash')
  }
  if (settings.enable_pos_module) {
    modules.push('caixa')
  }
  if (hasAnyPermission(user, ['inventory.view', 'inventory.manage'])) {
    modules.push('stock')
  }
  if (user) {
    modules.push('customers')
  }
  if (settings.enable_reports_module) {
    modules.push('reports')
  }
  if (hasAnyPermission(user, ['settings.view', 'settings.manage', 'users.view', 'users.manage'])) {
    modules.push('settings')
  }

  return modules
}

function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>('menu')
  const [moduleHistory, setModuleHistory] = useState<ModuleId[]>([])
  const [appData, setAppData] = useState<AppData>(demoData)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Bem-vindo ao cockpit operacional do O Capitão.')
  const [publicSyncState, setPublicSyncState] = useState<SyncState>({
    ...mockSyncState,
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
    ].filter((item) => item.status === 'rejected').length

    setAppData({
      dashboard: dashboardResult.status === 'fulfilled' ? dashboardResult.value : demoData.dashboard,
      products: productsResult.status === 'fulfilled' ? productsResult.value : demoData.products,
      productCategories: productCategoriesResult.status === 'fulfilled' ? productCategoriesResult.value : [],
      serviceCategories: serviceCategoriesResult.status === 'fulfilled' ? serviceCategoriesResult.value : [],
      stockMovements: stockMovementsResult.status === 'fulfilled' ? stockMovementsResult.value : [],
      services: servicesResult.status === 'fulfilled' ? servicesResult.value : demoData.services,
      customers: customersResult.status === 'fulfilled' ? customersResult.value : demoData.customers,
      appointments: appointmentsResult.status === 'fulfilled' ? appointmentsResult.value : demoData.appointments,
      vehicles: vehiclesResult.status === 'fulfilled' ? vehiclesResult.value : demoData.vehicles,
      settings: settingsResult.status === 'fulfilled' && settingsResult.value ? settingsResult.value : demoData.settings,
      syncState: syncResult.status === 'fulfilled' ? syncResult.value : demoData.syncState,
      permissions: permissionsResult.status === 'fulfilled' ? permissionsResult.value : [],
      roles: rolesResult.status === 'fulfilled' ? rolesResult.value : [],
      users: usersResult.status === 'fulfilled' ? usersResult.value : [],
    })

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
        : 'Alguns dados estão em fallback local enquanto a API termina de responder.',
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
    setAppData(demoData)
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

  function handleTransactionComplete(transaction: Transaction) {
    setTransactions((prev) => [transaction, ...prev])
    void showSuccessToast(`Pagamento de "${transaction.label}" registado — ${transaction.payment_method}.`)
  }

  function handleCancelTransaction(id: string) {
    setTransactions((prev) => prev.filter((t) => t.id !== id))
    void showSuccessToast('Transação cancelada.')
  }

  function handleMarkAsPaid(id: string, method: string) {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: 'completed' as const, payment_method: method } : t,
      ),
    )
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
            appointments={appData.appointments}
            customers={appData.customers}
            products={appData.products.filter((product) => product.department === 'barbershop')}
            services={appData.services}
            onTransactionComplete={handleTransactionComplete}
          />
        )
      case 'bar':
        return (
          <BarView
            products={appData.products.filter((product) => product.department === 'bar')}
            customers={appData.customers}
            onTransactionComplete={handleTransactionComplete}
          />
        )
      case 'carwash':
        return (
          <CarwashView
            appointments={appData.appointments}
            customers={appData.customers}
            products={appData.products.filter((product) => product.department === 'carwash')}
            services={appData.services}
            vehicles={appData.vehicles}
            onTransactionComplete={handleTransactionComplete}
          />
        )
      case 'caixa':
        return (
          <FinancasView
            transactions={transactions}
            onCancelTransaction={handleCancelTransaction}
            onMarkAsPaid={handleMarkAsPaid}
            canCancel={canManageSettings}
          />
        )
      case 'stock':
        return (
          <StockView
            categories={appData.productCategories}
            currentUser={session.user}
            movements={appData.stockMovements}
            products={appData.products}
            canManageStock={canManageStock}
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
            canManage={Boolean(session.user)}
            onSaveCustomer={(payload, customerId) =>
              runWithReload((accessToken) =>
                customerId
                  ? updateCustomer(accessToken, customerId, payload)
                  : createCustomer(accessToken, payload),
              )
            }
          />
        )
      case 'reports':
        return <ReportsView appointments={appData.appointments} dashboard={appData.dashboard} />
      case 'settings':
        return (
          <SettingsView
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
            onDeactivateUser={(userId) => runWithReload((accessToken) => deactivateUser(accessToken, userId))}
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
