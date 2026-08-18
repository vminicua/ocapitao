import type {
  AppSettings,
  Appointment,
  AuthSession,
  AuthUser,
  Customer,
  EmployeeRecord,
  DashboardSummary,
  LoginUserOption,
  PermissionDefinition,
  Product,
  ProductCategory,
  RoleRecord,
  SaleRecord,
  CashSessionRecord,
  CommissionRecord,
  BackupRecord,
  SyncQueueRecord,
  OperationalSessionRecord,
  Service,
  ServiceCategory,
  StockMovement,
  SyncState,
  UserRecord,
  Vehicle,
  AnalyticsReport,
  SaleReceipt,
} from '../types/models'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'

interface PaginatedResponse<T> {
  results: T[]
  next?: string | null
}

type JsonRecord = Record<string, unknown>

function unwrapList<T>(payload: T[] | PaginatedResponse<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results
}

async function request<T>(path: string, init?: RequestInit, accessToken?: string): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const target = /^https?:\/\//.test(path) ? path : `${API_BASE}${path}`
  const response = await fetch(target, { ...init, headers })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Falha ao comunicar com a API (${response.status}).`)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json() as Promise<T>
}

async function requestList<T>(path: string, accessToken: string) {
  const records: T[] = []
  let next: string | null = path
  while (next) {
    const payload: T[] | PaginatedResponse<T> = await request<T[] | PaginatedResponse<T>>(
      next,
      undefined,
      accessToken,
    )
    records.push(...unwrapList(payload))
    next = Array.isArray(payload) ? null : payload.next ?? null
  }
  return records
}

function createRecord<T>(path: string, payload: JsonRecord, accessToken: string) {
  return request<T>(
    path,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    accessToken,
  )
}

function updateRecord<T>(path: string, id: string | number, payload: JsonRecord, accessToken: string) {
  return request<T>(
    `${path}${id}/`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    accessToken,
  )
}

function deleteRecord(path: string, id: string | number, accessToken: string) {
  return request<void>(
    `${path}${id}/`,
    {
      method: 'DELETE',
    },
    accessToken,
  )
}

export async function signIn(userId: number, pin: string): Promise<AuthSession> {
  const tokens = await request<{ access: string; refresh: string }>(
    '/auth/token/',
    {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, pin }),
    },
  )

  const user = await getCurrentUser(tokens.access)
  return {
    accessToken: tokens.access,
    refreshToken: tokens.refresh,
    user,
  }
}

export function getPublicHealth() {
  return request<SyncState>('/health/')
}

export function getLoginUsers() {
  return request<LoginUserOption[]>('/auth/users/')
}

export function getCurrentUser(accessToken: string) {
  return request<AuthUser>('/auth/me/', undefined, accessToken)
}

export function changePin(accessToken: string, currentPin: string, newPin: string) {
  return createRecord<{ ok: boolean; message: string }>(
    '/auth/change-pin/',
    { current_pin: currentPin, new_pin: newPin },
    accessToken,
  )
}

export function getDashboardSummary(accessToken: string) {
  return request<DashboardSummary>('/dashboard/resumo/', undefined, accessToken)
}

export function getProducts(accessToken: string) {
  return requestList<Product>('/products/', accessToken)
}

export function getProductCategories(accessToken: string) {
  return requestList<ProductCategory>('/product-categories/', accessToken)
}

export function getStockMovements(accessToken: string) {
  return requestList<StockMovement>('/stock-movements/', accessToken)
}

export function getSales(accessToken: string) {
  return requestList<SaleRecord>('/sales/?status=completed', accessToken)
}

export function getCommissions(accessToken: string) {
  return requestList<CommissionRecord>('/commissions/', accessToken)
}

export function getAnalytics(accessToken: string, dateFrom: string, dateTo: string) {
  return request<AnalyticsReport>(`/reports/analytics/?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`, undefined, accessToken)
}

export async function downloadAnalyticsCsv(accessToken: string, dateFrom: string, dateTo: string) {
  const response = await fetch(`${API_BASE}/reports/analytics/?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}&export=csv`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!response.ok) throw new Error(await response.text())
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url; link.download = `relatorio-${dateFrom}-${dateTo}.csv`; link.click()
  URL.revokeObjectURL(url)
}

export function getSaleReceipt(accessToken: string, saleId: string, reprint = false) {
  return request<SaleReceipt>(`/sales/${saleId}/receipt/${reprint ? '?reprint=true' : ''}`, undefined, accessToken)
}

export function getBackups(accessToken: string) {
  return request<{ results: BackupRecord[] }>('/backups/', undefined, accessToken).then(payload => payload.results)
}

export function createBackup(accessToken: string) {
  return createRecord<BackupRecord>('/backups/', {}, accessToken)
}

export function restoreBackup(accessToken: string, file: string) {
  return createRecord<{ restored: string; safety_backup: string }>('/backups/restore/', { file }, accessToken)
}

export function getSyncQueue(accessToken: string) {
  return requestList<SyncQueueRecord>('/sync-queue/', accessToken)
}

export function resolveSyncConflict(accessToken: string, queueId: number, resolution: 'keep_local' | 'use_cloud') {
  return createRecord<{ ok: boolean }>(`/sync-queue/${queueId}/resolve/`, { resolution }, accessToken)
}

export function completeSale(accessToken: string, payload: JsonRecord) {
  return createRecord<SaleRecord>('/sales/complete/', payload, accessToken)
}

export function receiveSalePayment(accessToken: string, saleId: string, method: string) {
  return createRecord<SaleRecord>(`/sales/${saleId}/receive-payment/`, { method }, accessToken)
}

export function cancelSale(accessToken: string, saleId: string) {
  return createRecord<SaleRecord>(`/sales/${saleId}/cancel/`, {}, accessToken)
}

export function getCurrentCashSession(accessToken: string) {
  return request<CashSessionRecord | null>('/cash-sessions/current/', undefined, accessToken)
}

export function openCashSession(accessToken: string, openingAmount: number) {
  return createRecord<CashSessionRecord>('/cash-sessions/open/', { opening_amount: openingAmount }, accessToken)
}

export function closeCashSession(accessToken: string, sessionId: string, closingAmount: number) {
  return createRecord<CashSessionRecord>(`/cash-sessions/${sessionId}/close/`, { closing_amount: closingAmount }, accessToken)
}

export function getOperationalSessions(accessToken: string, department: string) {
  return requestList<OperationalSessionRecord>(`/operational-sessions/?department=${department}&status=open`, accessToken)
}

export function saveOperationalSessions(accessToken: string, department: string, sessions: JsonRecord[]) {
  return createRecord<OperationalSessionRecord[]>('/operational-sessions/snapshot/', { department, sessions }, accessToken)
}

export function getServices(accessToken: string) {
  return requestList<Service>('/services/', accessToken)
}

export function getServiceCategories(accessToken: string) {
  return requestList<ServiceCategory>('/service-categories/', accessToken)
}

export function getCustomers(accessToken: string) {
  return requestList<Customer>('/customers/', accessToken)
}

export function createCustomer(accessToken: string, payload: JsonRecord) {
  return createRecord<Customer>('/customers/', payload, accessToken)
}

export function updateCustomer(accessToken: string, customerId: string, payload: JsonRecord) {
  return updateRecord<Customer>('/customers/', customerId, payload, accessToken)
}

export function getAppointments(accessToken: string) {
  return requestList<Appointment>('/appointments/', accessToken)
}

export function createAppointment(accessToken: string, payload: JsonRecord) {
  return createRecord<Appointment>('/appointments/', payload, accessToken)
}

export function updateAppointment(accessToken: string, appointmentId: string, payload: JsonRecord) {
  return updateRecord<Appointment>('/appointments/', appointmentId, payload, accessToken)
}

export function startAppointment(accessToken: string, appointmentId: string) {
  return createRecord<{ appointment: Appointment; operational_session_id: string }>(`/appointments/${appointmentId}/start/`, {}, accessToken)
}

export function getEmployees(accessToken: string) {
  return requestList<EmployeeRecord>('/employees/', accessToken)
}

export function getVehicles(accessToken: string) {
  return requestList<Vehicle>('/vehicles/', accessToken)
}

export function createVehicle(accessToken: string, payload: JsonRecord) {
  return createRecord<Vehicle>('/vehicles/', payload, accessToken)
}

export function updateVehicle(accessToken: string, vehicleId: string, payload: JsonRecord) {
  return updateRecord<Vehicle>('/vehicles/', vehicleId, payload, accessToken)
}

export async function getSettings(accessToken: string) {
  const settings = await requestList<AppSettings>('/settings/', accessToken)
  return settings[0]
}

export function updateSettings(accessToken: string, settingsId: string, payload: JsonRecord) {
  return updateRecord<AppSettings>('/settings/', settingsId, payload, accessToken)
}

export function getPermissions(accessToken: string) {
  return requestList<PermissionDefinition>('/permissions/', accessToken)
}

export function getRoles(accessToken: string) {
  return requestList<RoleRecord>('/roles/', accessToken)
}

export function createRole(accessToken: string, payload: JsonRecord) {
  return createRecord<RoleRecord>('/roles/', payload, accessToken)
}

export function updateRole(accessToken: string, roleId: string, payload: JsonRecord) {
  return updateRecord<RoleRecord>('/roles/', roleId, payload, accessToken)
}

export function getUsers(accessToken: string) {
  return requestList<UserRecord>('/users/', accessToken)
}

export function createUser(accessToken: string, payload: JsonRecord) {
  return createRecord<UserRecord>('/users/', payload, accessToken)
}

export function updateUser(accessToken: string, userId: number, payload: JsonRecord) {
  return updateRecord<UserRecord>('/users/', userId, payload, accessToken)
}

export function deactivateUser(accessToken: string, userId: number) {
  return deleteRecord('/users/', userId, accessToken)
}

export function createProductCategory(accessToken: string, payload: JsonRecord) {
  return createRecord<ProductCategory>('/product-categories/', payload, accessToken)
}

export function updateProductCategory(accessToken: string, categoryId: string, payload: JsonRecord) {
  return updateRecord<ProductCategory>('/product-categories/', categoryId, payload, accessToken)
}

export function createProduct(accessToken: string, payload: JsonRecord) {
  return createRecord<Product>('/products/', payload, accessToken)
}

export function updateProduct(accessToken: string, productId: string, payload: JsonRecord) {
  return updateRecord<Product>('/products/', productId, payload, accessToken)
}

export function createServiceCategory(accessToken: string, payload: JsonRecord) {
  return createRecord<ServiceCategory>('/service-categories/', payload, accessToken)
}

export function updateServiceCategory(accessToken: string, categoryId: string, payload: JsonRecord) {
  return updateRecord<ServiceCategory>('/service-categories/', categoryId, payload, accessToken)
}

export function createService(accessToken: string, payload: JsonRecord) {
  return createRecord<Service>('/services/', payload, accessToken)
}

export function updateService(accessToken: string, serviceId: string, payload: JsonRecord) {
  return updateRecord<Service>('/services/', serviceId, payload, accessToken)
}

export function createStockMovement(accessToken: string, payload: JsonRecord) {
  return createRecord<StockMovement>('/stock-movements/', payload, accessToken)
}

export function updateStockMovement(accessToken: string, movementId: string, payload: JsonRecord) {
  return updateRecord<StockMovement>('/stock-movements/', movementId, payload, accessToken)
}

export function deleteStockMovement(accessToken: string, movementId: string) {
  return deleteRecord('/stock-movements/', movementId, accessToken)
}

export function getSuppliers(accessToken: string) { return requestList<Record<string, unknown>>('/suppliers/', accessToken) }
export function saveSupplier(accessToken: string, payload: JsonRecord, id?: string) { return id ? updateRecord('/suppliers/', id, payload, accessToken) : createRecord('/suppliers/', payload, accessToken) }
export function getStockLocations(accessToken: string) { return requestList<Record<string, unknown>>('/stock-locations/', accessToken) }
export function saveStockLocation(accessToken: string, payload: JsonRecord) { return createRecord('/stock-locations/', payload, accessToken) }
export function getPurchaseOrders(accessToken: string) { return requestList<Record<string, unknown>>('/purchase-orders/', accessToken) }
export function savePurchaseOrder(accessToken: string, payload: JsonRecord) { return createRecord('/purchase-orders/', payload, accessToken) }
export function savePurchaseOrderItem(accessToken: string, payload: JsonRecord) { return createRecord('/purchase-order-items/', payload, accessToken) }
export function receivePurchaseOrder(accessToken: string, id: string, items: JsonRecord[]) { return createRecord(`/purchase-orders/${id}/receive/`, { items }, accessToken) }
export function getStockCounts(accessToken: string) { return requestList<Record<string, unknown>>('/stock-counts/', accessToken) }
export function getPromotions(accessToken: string) { return requestList<Record<string, unknown>>('/promotions/', accessToken) }
export function savePromotion(accessToken: string, payload: JsonRecord, id?: string) { return id ? updateRecord('/promotions/', id, payload, accessToken) : createRecord('/promotions/', payload, accessToken) }
export function getLoyaltyPrograms(accessToken: string) { return requestList<Record<string, unknown>>('/loyalty-programs/', accessToken) }
export function saveLoyaltyProgram(accessToken: string, payload: JsonRecord, id?: string) { return id ? updateRecord('/loyalty-programs/', id, payload, accessToken) : createRecord('/loyalty-programs/', payload, accessToken) }

export function getSyncStatus(accessToken: string) {
  return request<SyncState>('/sync/status/', undefined, accessToken)
}

export function connectCloud(accessToken: string, sshPassword: string) {
  return request<{ ok: boolean; message: string }>(
    '/cloud/connect/',
    { method: 'POST', body: JSON.stringify({ ssh_password: sshPassword }) },
    accessToken,
  )
}

export function disconnectCloud(accessToken: string) {
  return request<{ ok: boolean; message: string }>(
    '/cloud/disconnect/',
    { method: 'POST', body: JSON.stringify({}) },
    accessToken,
  )
}

export function triggerSyncNow(accessToken: string) {
  return request<{ ok: boolean; message: string; synced_count: number; failed_count: number }>(
    '/sync/run/',
    { method: 'POST', body: JSON.stringify({}) },
    accessToken,
  )
}
