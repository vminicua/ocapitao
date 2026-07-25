import type {
  AppSettings,
  Appointment,
  AuthSession,
  AuthUser,
  Customer,
  DashboardSummary,
  LoginUserOption,
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
} from '../types/models'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'

interface PaginatedResponse<T> {
  results: T[]
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

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
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
  const payload = await request<T[] | PaginatedResponse<T>>(path, undefined, accessToken)
  return unwrapList(payload)
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

export function getVehicles(accessToken: string) {
  return requestList<Vehicle>('/vehicles/', accessToken)
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
