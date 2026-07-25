export type ModuleId =
  | 'menu'
  | 'dashboard'
  | 'barbershop'
  | 'bar'
  | 'carwash'
  | 'caixa'
  | 'stock'
  | 'customers'
  | 'reports'
  | 'settings'

export type DepartmentId = 'bar' | 'barbershop' | 'carwash' | 'shared'
export type EmployeeDepartment = DepartmentId | 'management' | 'cashier'
export type ProductItemType = 'resale' | 'consumable' | 'supply'
export type ProductUnit = 'unit' | 'bottle' | 'pack' | 'box' | 'liter' | 'milliliter' | 'kilogram'
export type StockMovementType = 'entry' | 'exit' | 'adjustment'
export type StockReferenceType = 'purchase' | 'sale' | 'internal_use' | 'loss' | 'adjustment' | 'transfer'

export interface SyncState {
  online: boolean
  api_online?: boolean
  remote_api_online?: boolean
  database_online?: boolean
  postgres_online?: boolean
  has_cloud_credentials?: boolean
  pending_count: number
  mode: string
  label?: string
  last_error?: string
}

export interface DashboardSummary {
  data: string
  total_vendas: number | string
  totais_por_area: Record<string, number | string>
  servicos_pendentes: number
  caixa_aberto: boolean
  estado_sincronizacao: SyncState
  ultima_sincronizacao?: string | null
}

export interface Product {
  id: string
  category?: string
  category_id?: string
  department: DepartmentId
  item_type: ProductItemType
  name: string
  sku: string
  barcode?: string
  unit: ProductUnit
  sale_price: number | string
  cost_price?: number | string
  stock_quantity: number | string
  low_stock_threshold: number | string
  reorder_quantity?: number | string
  supplier_name?: string
  storage_location?: string
  image_url?: string
  notes?: string
  category_name?: string
  subcategory_name?: string
  category_path?: string
  low_stock?: boolean
  active: boolean
}

export interface Service {
  id: string
  department: 'barbershop' | 'carwash'
  category: string
  subcategory?: string
  category_ref?: string | null
  category_ref_id?: string | null
  category_ref_name?: string
  name: string
  duration_minutes: number
  price: number | string
  active: boolean
  description?: string
}

export interface Customer {
  id: string
  full_name: string
  phone: string
  loyalty_points: number
  preferred_barber_name?: string
  notes?: string
  active?: boolean
}

export interface Appointment {
  id: string
  department: 'barbershop' | 'carwash'
  customer_name: string
  employee_name: string
  service_name: string
  scheduled_for: string
  status: string
  payment_status: string
  walk_in: boolean
  price: number | string
}

export interface Vehicle {
  id: string
  customer_name: string
  registration_number: string
  brand: string
  model: string
  color?: string
}

export interface AppSettings {
  id: string
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
  tax_rate: number | string
  appointment_slot_minutes: number
  receipt_header: string
  receipt_footer: string
  printer_name: string
  business_hours: string
  backup_folder: string
  ssh_tunnel_command: string
  sync_interval_seconds: number
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
  default_markup_percent: number | string
  default_commission_percent: number | string
  dark_mode: boolean
}

export interface PermissionDefinition {
  id: string
  module: string
  code: string
  name: string
  description: string
}

export interface RoleSummary {
  id?: string
  code: string
  name: string
  description?: string
  permissions?: PermissionDefinition[]
}

export interface RoleRecord {
  id: string
  code: string
  name: string
  description: string
  permissions: PermissionDefinition[]
}

export interface AuthUser {
  id: number
  username: string
  display_name?: string
  email: string
  first_name: string
  last_name: string
  phone: string
  role?: RoleSummary | null
  force_password_change: boolean
  is_superuser?: boolean
}

export interface LoginUserOption {
  id: number
  username: string
  display_name: string
  role_name?: string
}

export interface AuthSession {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
}

export interface UserRecord {
  id: number
  username: string
  display_name?: string
  email: string
  first_name: string
  last_name: string
  phone: string
  role?: RoleRecord | null
  force_password_change: boolean
  is_active: boolean
  is_staff: boolean
  is_superuser?: boolean
  is_online: boolean
  department?: EmployeeDepartment | null
  title?: string
  commission_rate?: number | string
  is_active_employee?: boolean
  hire_date?: string | null
  employee_notes?: string
  created_at?: string
  updated_at?: string
}

export interface ProductCategory {
  id: string
  department?: DepartmentId
  parent?: string | null
  parent_id?: string | null
  parent_name?: string
  name: string
  description: string
  active?: boolean
  child_count?: number
  full_name?: string
  created_at?: string
  updated_at?: string
}

export interface ServiceCategory {
  id: string
  department: 'barbershop' | 'carwash'
  parent?: string | null
  parent_id?: string | null
  parent_name?: string
  name: string
  description: string
  active: boolean
  child_count?: number
  full_name?: string
  created_at?: string
  updated_at?: string
}

export interface PosCartItem {
  uid: string
  product_id?: string
  service_id?: string
  label: string
  category?: string
  price: number
  kind: 'product' | 'service'
  department: 'bar' | 'barbershop' | 'carwash'
  has_stock: boolean
  quantity: number
}

export interface Comanda {
  id: string
  label: string
  items: PosCartItem[]
  source: 'bar' | 'barbershop' | 'carwash' | 'pos'
  created_at: number
}

export interface Transaction {
  id: string
  label: string
  source: 'bar' | 'barbershop' | 'carwash'
  items: PosCartItem[]
  payment_method: string
  subtotal: number
  discount: number
  total: number
  created_at: number
  status: 'completed' | 'pending'
  note?: string
}

export interface StockMovement {
  id: string
  product?: string
  product_id?: string
  product_name: string
  product_department?: DepartmentId
  movement_type: StockMovementType
  reference_type: StockReferenceType
  reference_code: string
  quantity: number | string
  unit_cost: number | string
  stock_before: number | string
  stock_after: number | string
  notes: string
  created_by?: number | null
  created_by_id?: number | null
  created_by_name?: string
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}
