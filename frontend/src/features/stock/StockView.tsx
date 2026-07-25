import type { ChangeEvent } from 'react'
import { useEffect, useRef, useState } from 'react'

import { TouchInput } from '../../components/touch/TouchInput'
import { TouchNumberInput } from '../../components/touch/TouchNumberInput'
import { TouchSelect } from '../../components/touch/TouchSelect'
import { TouchTextarea } from '../../components/touch/TouchTextarea'
import { showErrorAlert, showSuccessToast } from '../../lib/alerts'
import { formatCurrency, formatDateTime, toNumber } from '../../lib/formatters'
import type {
  AuthUser,
  DepartmentId,
  Product,
  ProductCategory,
  ProductItemType,
  ProductUnit,
  StockMovement,
  StockMovementType,
  StockReferenceType,
} from '../../types/models'

type StockFilter = 'all' | DepartmentId
type StockSubView = 'menu' | 'products' | 'categories' | 'subcategories' | 'movements'

interface StockViewProps {
  products: Product[]
  categories: ProductCategory[]
  movements: StockMovement[]
  currentUser: AuthUser | null
  canManageStock: boolean
  onSaveCategory: (payload: Record<string, unknown>, categoryId?: string) => Promise<unknown>
  onSaveProduct: (payload: Record<string, unknown>, productId?: string) => Promise<unknown>
  onSaveMovement: (payload: Record<string, unknown>) => Promise<unknown>
  onDeleteMovement: (movementId: string) => Promise<unknown>
}

interface CategoryFormState {
  id?: string
  department: DepartmentId
  parent_id: string
  name: string
  description: string
  active: boolean
}

interface ProductFormState {
  id?: string
  category_id: string
  department: DepartmentId
  item_type: ProductItemType
  name: string
  sku: string
  barcode: string
  unit: ProductUnit
  sale_price: string
  cost_price: string
  initial_stock: string
  low_stock_threshold: string
  reorder_quantity: string
  supplier_name: string
  storage_location: string
  image_url: string
  notes: string
  active: boolean
}

interface MovementFormState {
  product_id: string
  movement_type: StockMovementType
  reference_type: StockReferenceType
  reference_code: string
  quantity: string
  unit_cost: string
  notes: string
}

const defaultProductImage = '/branding/placeholders/product-default.svg'

function emptyCategoryForm(forSubcategory = false): CategoryFormState {
  return { department: 'bar', parent_id: forSubcategory ? '' : '', name: '', description: '', active: true }
}

function buildCategoryForm(category: ProductCategory): CategoryFormState {
  return {
    id: category.id,
    department: category.department ?? 'bar',
    parent_id: category.parent_id ?? '',
    name: category.name,
    description: category.description,
    active: category.active !== false,
  }
}

function emptyProductForm(): ProductFormState {
  return {
    category_id: '',
    department: 'bar',
    item_type: 'resale',
    name: '',
    sku: '',
    barcode: '',
    unit: 'unit',
    sale_price: '0',
    cost_price: '0',
    initial_stock: '0',
    low_stock_threshold: '5',
    reorder_quantity: '0',
    supplier_name: '',
    storage_location: '',
    image_url: defaultProductImage,
    notes: '',
    active: true,
  }
}

function buildProductForm(product: Product): ProductFormState {
  return {
    id: product.id,
    category_id: product.category_id ?? product.category ?? '',
    department: product.department,
    item_type: product.item_type,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode ?? '',
    unit: product.unit,
    sale_price: String(product.sale_price ?? 0),
    cost_price: String(product.cost_price ?? 0),
    initial_stock: String(product.stock_quantity ?? 0),
    low_stock_threshold: String(product.low_stock_threshold ?? 0),
    reorder_quantity: String(product.reorder_quantity ?? 0),
    supplier_name: product.supplier_name ?? '',
    storage_location: product.storage_location ?? '',
    image_url: product.image_url || defaultProductImage,
    notes: product.notes ?? '',
    active: product.active,
  }
}

function emptyMovementForm(defaultProductId = ''): MovementFormState {
  return {
    product_id: defaultProductId,
    movement_type: 'entry',
    reference_type: 'purchase',
    reference_code: '',
    quantity: '',
    unit_cost: '',
    notes: '',
  }
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Falha ao ler a imagem.'))
    reader.readAsDataURL(file)
  })
}

const departmentOptions = [
  { value: 'bar', label: 'Bar' },
  { value: 'barbershop', label: 'Barbershop' },
  { value: 'carwash', label: 'Carwash' },
  { value: 'shared', label: 'Partilhado' },
]
const itemTypeOptions = [
  { value: 'resale', label: 'Revenda' },
  { value: 'consumable', label: 'Consumível' },
  { value: 'supply', label: 'Material' },
]
const unitOptions = [
  { value: 'unit', label: 'Unidade' },
  { value: 'bottle', label: 'Garrafa' },
  { value: 'pack', label: 'Pacote' },
  { value: 'box', label: 'Caixa' },
  { value: 'liter', label: 'Litro' },
  { value: 'milliliter', label: 'Mililitro' },
  { value: 'kilogram', label: 'Quilograma' },
]
const movementTypeOptions = [
  { value: 'entry', label: 'Entrada' },
  { value: 'exit', label: 'Saída' },
  { value: 'adjustment', label: 'Ajuste' },
]
const referenceOptions = [
  { value: 'purchase', label: 'Compra' },
  { value: 'sale', label: 'Venda' },
  { value: 'internal_use', label: 'Uso interno' },
  { value: 'loss', label: 'Perda' },
  { value: 'adjustment', label: 'Ajuste' },
  { value: 'transfer', label: 'Transferência' },
]

export function StockView({
  products,
  categories,
  movements,
  currentUser,
  canManageStock,
  onSaveCategory,
  onSaveProduct,
  onSaveMovement,
  onDeleteMovement,
}: StockViewProps) {
  const [subView, setSubView] = useState<StockSubView>('menu')
  const [filter, setFilter] = useState<StockFilter>('all')
  const [search, setSearch] = useState('')

  // Modal states — null = closed, value = open with that form
  const [productModal, setProductModal] = useState<ProductFormState | null>(null)
  const [categoryModal, setCategoryModal] = useState<CategoryFormState | null>(null)
  const [movementModal, setMovementModal] = useState<MovementFormState | null>(null)

  const [savingCategory, setSavingCategory] = useState(false)
  const [savingProduct, setSavingProduct] = useState(false)
  const [savingMovement, setSavingMovement] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (productModal?.id && !products.some((p) => p.id === productModal.id)) {
      setProductModal(null)
    }
  }, [productModal?.id, products])

  // Derived data
  const rootCategories = categories.filter((c) => !c.parent_id)
  const subCategories = categories.filter((c) => Boolean(c.parent_id))

  const visibleCategories = categories.filter((c) =>
    filter === 'all' ? true : c.department === filter || c.department === 'shared',
  )
  const visibleRootCategories = visibleCategories.filter((c) => !c.parent_id)
  const visibleSubCategories = visibleCategories.filter((c) => Boolean(c.parent_id))
  const rootCategoryOptions = visibleRootCategories.map((c) => ({ value: c.id, label: c.name }))
  const productCategoryOptions = visibleCategories.map((c) => ({ value: c.id, label: c.full_name ?? c.name }))

  const filteredProducts = products.filter((product) => {
    const matchesFilter = filter === 'all' ? true : product.department === filter
    const term = search.trim().toLowerCase()
    const matchesSearch = !term
      ? true
      : [product.name, product.sku, product.category_name, product.subcategory_name, product.category_path, product.supplier_name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term))
    return matchesFilter && matchesSearch
  })

  const filteredMovements = movements.filter((m) =>
    filter === 'all' ? true : m.product_department === filter,
  )

  const allLowStockItems = products.filter((p) => toNumber(p.stock_quantity) <= toNumber(p.low_stock_threshold))
  const filteredLowStockItems = filteredProducts.filter((p) => toNumber(p.stock_quantity) <= toNumber(p.low_stock_threshold))
  const stockCostValue = products.reduce((sum, p) => sum + toNumber(p.stock_quantity) * toNumber(p.cost_price), 0)
  const stockSaleValue = products.reduce((sum, p) => sum + toNumber(p.stock_quantity) * toNumber(p.sale_price), 0)

  const latestMovementIds = new Set<string>()
  const seenProductIds = new Set<string>()
  for (const m of filteredMovements) {
    if (m.product_id && !seenProductIds.has(m.product_id)) {
      seenProductIds.add(m.product_id)
      latestMovementIds.add(m.id)
    }
  }

  // Handlers
  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setProductModal((f) => f ? { ...f, image_url: dataUrl } : f)
    } catch (error) {
      console.error(error)
      void showErrorAlert('Falha ao carregar imagem', 'Tente novamente com outro ficheiro.')
    } finally {
      event.target.value = ''
    }
  }

  async function handleSaveCategory() {
    if (!categoryModal?.name.trim()) {
      void showErrorAlert('Campo obrigatório', 'Indique o nome da categoria.')
      return
    }
    setSavingCategory(true)
    try {
      await onSaveCategory(
        {
          department: categoryModal.department,
          parent_id: categoryModal.parent_id || null,
          name: categoryModal.name.trim(),
          description: categoryModal.description.trim(),
          active: categoryModal.active,
        },
        categoryModal.id,
      )
      setCategoryModal(null)
      void showSuccessToast('Categoria guardada com sucesso.')
    } catch (error) {
      console.error(error)
      void showErrorAlert('Falha ao guardar categoria', 'Verifique o nome e tente novamente.')
    } finally {
      setSavingCategory(false)
    }
  }

  async function handleSaveProduct() {
    if (!productModal) return
    if (!productModal.name.trim() || !productModal.sku.trim() || !productModal.category_id) {
      void showErrorAlert('Dados em falta', 'Nome, SKU e categoria são obrigatórios.')
      return
    }
    const payload: Record<string, unknown> = {
      category_id: productModal.category_id,
      department: productModal.department,
      item_type: productModal.item_type,
      name: productModal.name.trim(),
      sku: productModal.sku.trim(),
      barcode: productModal.barcode.trim(),
      unit: productModal.unit,
      sale_price: productModal.sale_price,
      cost_price: productModal.cost_price,
      low_stock_threshold: productModal.low_stock_threshold,
      reorder_quantity: productModal.reorder_quantity,
      supplier_name: productModal.supplier_name.trim(),
      storage_location: productModal.storage_location.trim(),
      image_url: productModal.image_url || defaultProductImage,
      notes: productModal.notes.trim(),
      active: productModal.active,
    }
    if (!productModal.id) payload.stock_quantity = productModal.initial_stock
    setSavingProduct(true)
    try {
      await onSaveProduct(payload, productModal.id)
      setProductModal(null)
      void showSuccessToast('Artigo guardado com sucesso.')
    } catch (error) {
      console.error(error)
      void showErrorAlert('Falha ao guardar artigo', 'Confirme os dados e tente novamente.')
    } finally {
      setSavingProduct(false)
    }
  }

  async function handleSaveMovement() {
    if (!movementModal?.product_id || !movementModal.quantity.trim()) {
      void showErrorAlert('Movimento incompleto', 'Selecione o artigo e a quantidade.')
      return
    }
    setSavingMovement(true)
    try {
      await onSaveMovement({
        product_id: movementModal.product_id,
        movement_type: movementModal.movement_type,
        reference_type: movementModal.reference_type,
        reference_code: movementModal.reference_code.trim(),
        quantity: movementModal.quantity,
        unit_cost: movementModal.unit_cost || '0',
        notes: movementModal.notes.trim(),
      })
      setMovementModal(null)
      void showSuccessToast('Movimento registado com sucesso.')
    } catch (error) {
      console.error(error)
      void showErrorAlert('Falha ao registar movimento', 'Verifique o stock, a quantidade e o tipo de movimento.')
    } finally {
      setSavingMovement(false)
    }
  }

  async function handleDeleteMovement(movementId: string) {
    try {
      await onDeleteMovement(movementId)
      void showSuccessToast('Movimento anulado com sucesso.')
    } catch (error) {
      console.error(error)
      void showErrorAlert('Falha ao anular movimento', 'Só o movimento mais recente de cada artigo pode ser anulado.')
    }
  }

  function goToMenu() {
    setSubView('menu')
    setFilter('all')
    setSearch('')
  }

  function navigateTo(view: StockSubView) {
    setCategoryModal(null)
    setProductModal(null)
    setMovementModal(null)
    setFilter('all')
    setSearch('')
    setSubView(view)
  }

  // Reusable filter bar
  function DeptFilterBar({ withSearch = false }: { withSearch?: boolean }) {
    return (
      <div className="toolbar-strip">
        <div className="chip-group">
          <button type="button" className={`chip-button ${filter === 'all' ? 'is-selected' : ''}`} onClick={() => setFilter('all')}>
            Todas as áreas
          </button>
          {departmentOptions.map((opt) => (
            <button key={opt.value} type="button" className={`chip-button ${filter === opt.value ? 'is-selected' : ''}`} onClick={() => setFilter(opt.value as DepartmentId)}>
              {opt.label}
            </button>
          ))}
        </div>
        {withSearch && (
          <div className="toolbar-search">
            <TouchInput label="Pesquisar artigo" value={search} onChange={setSearch} placeholder="Nome, SKU, fornecedor..." type="search" />
          </div>
        )}
      </div>
    )
  }

  // =================== MENU VIEW ===================
  if (subView === 'menu') {
    return (
      <section className="module-layout">
        <div className="module-header">
          <div>
            <p className="eyebrow">Stock</p>
            <h3 className="section-title">Inventário &amp; Catálogo</h3>
          </div>
          <div className="chip-group">
            <span className="chip">{products.length} artigos</span>
            <span className={`chip ${allLowStockItems.length > 0 ? 'chip-warn' : 'chip-good'}`}>
              {allLowStockItems.length} em alerta
            </span>
            <span className="chip">{currentUser?.role?.name ?? 'Perfil'}</span>
          </div>
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <span className="touch-helper">Total de artigos</span>
            <strong>{products.length}</strong>
          </article>
          <article className="stat-card">
            <span className="touch-helper">Valor de stock (custo)</span>
            <strong>{formatCurrency(stockCostValue)}</strong>
          </article>
          <article className="stat-card">
            <span className="touch-helper">Valor de stock (venda)</span>
            <strong>{formatCurrency(stockSaleValue)}</strong>
          </article>
          <article className="stat-card">
            <span className="touch-helper">Alertas de stock mínimo</span>
            <strong className={allLowStockItems.length > 0 ? 'danger-text' : ''}>{allLowStockItems.length} artigos</strong>
          </article>
        </div>

        <div className="stock-nav-grid">
          <button type="button" className="stock-nav-card tone-mint" onClick={() => navigateTo('products')}>
            <div className="stock-nav-card__icon">
              <img src="/branding/placeholders/products-product-svgrepo-com.svg" alt="" aria-hidden="true" draggable="false" />
            </div>
            <p className="stock-nav-card__count">{products.length}</p>
            <strong className="stock-nav-card__title">Produtos</strong>
            <p className="stock-nav-card__desc">Catálogo completo, preços, imagens e gestão de stock</p>
          </button>

          <button type="button" className="stock-nav-card tone-aqua" onClick={() => navigateTo('categories')}>
            <div className="stock-nav-card__icon">
              <img src="/branding/placeholders/category-svgrepo-com.svg" alt="" aria-hidden="true" draggable="false" />
            </div>
            <p className="stock-nav-card__count">{rootCategories.length}</p>
            <strong className="stock-nav-card__title">Categorias</strong>
            <p className="stock-nav-card__desc">Famílias principais de artigos organizadas por departamento</p>
          </button>

          <button type="button" className="stock-nav-card tone-lilac" onClick={() => navigateTo('subcategories')}>
            <div className="stock-nav-card__icon">
              <img src="/branding/placeholders/category-new-each-svgrepo-com.svg" alt="" aria-hidden="true" draggable="false" />
            </div>
            <p className="stock-nav-card__count">{subCategories.length}</p>
            <strong className="stock-nav-card__title">Subcategorias</strong>
            <p className="stock-nav-card__desc">Agrupamentos detalhados dentro de cada família de artigos</p>
          </button>

          <button type="button" className="stock-nav-card tone-peach" onClick={() => navigateTo('movements')}>
            <div className="stock-nav-card__icon">
              <img src="/branding/icons/stock-movement-svgrepo-com.svg" alt="" aria-hidden="true" draggable="false" />
            </div>
            <p className="stock-nav-card__count">{movements.length}</p>
            <strong className="stock-nav-card__title">Movimentos</strong>
            <p className="stock-nav-card__desc">Registo de entradas, saídas e ajustes de inventário</p>
          </button>
        </div>

        {allLowStockItems.length > 0 && (
          <article className="panel">
            <div className="panel-head">
              <h4>Alertas de stock mínimo</h4>
              <span className="chip chip-warn">{allLowStockItems.length} abaixo do limite</span>
            </div>
            <div className="record-list">
              {allLowStockItems.slice(0, 8).map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="record-row record-row--with-thumb"
                  onClick={() => {
                    setProductModal(buildProductForm(product))
                    setSubView('products')
                  }}
                >
                  <div className="record-thumb">
                    <img src={product.image_url || defaultProductImage} alt={product.name} className="product-thumb" />
                  </div>
                  <div className="record-main">
                    <strong>{product.name}</strong>
                    <small>{product.category_path || product.category_name} · {product.department}</small>
                  </div>
                  <div className="timeline-meta">
                    <span className="danger-text">{product.stock_quantity} {product.unit}</span>
                    <small>mín. {product.low_stock_threshold}</small>
                  </div>
                </button>
              ))}
            </div>
          </article>
        )}
      </section>
    )
  }

  // =================== PRODUCTS VIEW ===================
  if (subView === 'products') {
    return (
      <section className="module-layout">
        <div className="module-header">
          <div className="stock-breadcrumb">
            <button type="button" className="ghost-button stock-back-btn" onClick={goToMenu}>← Stock</button>
            <div>
              <p className="eyebrow">Stock · Produtos</p>
              <h3 className="section-title">Catálogo operacional</h3>
            </div>
          </div>
          <div className="chip-group">
            <span className="chip">{filteredProducts.length} visíveis</span>
            <span className={`chip ${filteredLowStockItems.length > 0 ? 'chip-warn' : 'chip-good'}`}>
              {filteredLowStockItems.length} em alerta
            </span>
            {canManageStock && (
              <button type="button" className="primary-button" onClick={() => setProductModal(emptyProductForm())}>
                + Novo artigo
              </button>
            )}
          </div>
        </div>

        <DeptFilterBar withSearch />

        <article className="panel">
          <div className="panel-head">
            <h4>Artigos</h4>
            <span className="chip">{filteredProducts.length}</span>
          </div>
          <div className="record-list">
            {filteredProducts.length === 0 && <p className="empty-state">Nenhum artigo encontrado.</p>}
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                className="record-row record-row--with-thumb"
                onClick={() => setProductModal(buildProductForm(product))}
              >
                <div className="record-thumb">
                  <img src={product.image_url || defaultProductImage} alt={product.name} className="product-thumb" />
                </div>
                <div className="record-main">
                  <strong>{product.name}</strong>
                  <small>{product.category_path || product.category_name} · {product.department} · {product.sku}</small>
                </div>
                <div className="timeline-meta">
                  <span className={toNumber(product.stock_quantity) <= toNumber(product.low_stock_threshold) ? 'danger-text' : ''}>
                    {product.stock_quantity} {product.unit}
                  </span>
                  <small>{formatCurrency(product.cost_price)}</small>
                </div>
              </button>
            ))}
          </div>
        </article>

        {/* Product Modal */}
        {productModal !== null && (
          <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setProductModal(null) }}>
            <div className="modal-panel modal-panel--wide">
              <div className="modal-header">
                <div>
                  <p className="eyebrow">Stock · Produtos</p>
                  <h4 className="section-title" style={{ margin: 0 }}>
                    {productModal.id ? 'Editar artigo' : 'Novo artigo'}
                  </h4>
                </div>
                <button type="button" className="modal-close" onClick={() => setProductModal(null)}>✕</button>
              </div>

              <div className="product-image-editor">
                <div className="product-image-editor__preview">
                  <img src={productModal.image_url || defaultProductImage} alt={productModal.name || 'Produto'} className="product-image-preview" />
                </div>
                <div className="product-image-editor__actions">
                  <strong>Imagem do produto</strong>
                  <small className="touch-helper">Carregue uma imagem ou use a imagem padrão.</small>
                  <div className="form-actions">
                    <button type="button" className="ghost-button" onClick={() => fileInputRef.current?.click()} disabled={!canManageStock}>
                      Carregar imagem
                    </button>
                    <button type="button" className="ghost-button" onClick={() => setProductModal((f) => f ? { ...f, image_url: defaultProductImage } : f)} disabled={!canManageStock}>
                      Usar padrão
                    </button>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden-file-input" onChange={(e) => void handleImageChange(e)} />
                </div>
              </div>

              <div className="form-grid">
                <TouchSelect label="Categoria / subcategoria" value={productModal.category_id} onChange={(v) => setProductModal((f) => f ? { ...f, category_id: v } : f)} options={productCategoryOptions} />
                <TouchSelect label="Área" value={productModal.department} onChange={(v) => setProductModal((f) => f ? { ...f, department: v as DepartmentId } : f)} options={departmentOptions} />
                <TouchSelect label="Tipo de artigo" value={productModal.item_type} onChange={(v) => setProductModal((f) => f ? { ...f, item_type: v as ProductItemType } : f)} options={itemTypeOptions} />
                <TouchSelect label="Unidade" value={productModal.unit} onChange={(v) => setProductModal((f) => f ? { ...f, unit: v as ProductUnit } : f)} options={unitOptions} />
                <TouchInput label="Nome" value={productModal.name} onChange={(v) => setProductModal((f) => f ? { ...f, name: v } : f)} />
                <TouchInput label="SKU" value={productModal.sku} onChange={(v) => setProductModal((f) => f ? { ...f, sku: v } : f)} />
                <TouchInput label="Código de barras" value={productModal.barcode} onChange={(v) => setProductModal((f) => f ? { ...f, barcode: v } : f)} />
                <TouchInput label="Fornecedor" value={productModal.supplier_name} onChange={(v) => setProductModal((f) => f ? { ...f, supplier_name: v } : f)} />
                <TouchInput label="Local de armazenamento" value={productModal.storage_location} onChange={(v) => setProductModal((f) => f ? { ...f, storage_location: v } : f)} />
                <TouchNumberInput label="Preço de venda" value={productModal.sale_price} onChange={(v) => setProductModal((f) => f ? { ...f, sale_price: v } : f)} />
                <TouchNumberInput label="Custo unitário" value={productModal.cost_price} onChange={(v) => setProductModal((f) => f ? { ...f, cost_price: v } : f)} />
                <TouchNumberInput
                  label={productModal.id ? 'Stock atual (gerido por movimento)' : 'Stock inicial'}
                  value={productModal.initial_stock}
                  onChange={(v) => setProductModal((f) => f ? { ...f, initial_stock: v } : f)}
                  helperText={productModal.id ? 'Use Movimentos para ajustar o stock existente.' : undefined}
                  disabled={Boolean(productModal.id)}
                />
                <TouchNumberInput label="Limite mínimo" value={productModal.low_stock_threshold} onChange={(v) => setProductModal((f) => f ? { ...f, low_stock_threshold: v } : f)} />
                <TouchNumberInput label="Reposição sugerida" value={productModal.reorder_quantity} onChange={(v) => setProductModal((f) => f ? { ...f, reorder_quantity: v } : f)} />
              </div>

              <TouchTextarea label="Notas" value={productModal.notes} onChange={(v) => setProductModal((f) => f ? { ...f, notes: v } : f)} rows={3} />

              <div className="toggle-grid">
                <label className="toggle-card">
                  <input type="checkbox" checked={productModal.active} onChange={(e) => setProductModal((f) => f ? { ...f, active: e.target.checked } : f)} />
                  <span>Artigo ativo</span>
                </label>
              </div>

              <div className="form-actions">
                <button type="button" className="ghost-button" onClick={() => setProductModal(null)}>Cancelar</button>
                <button type="button" className="primary-button" onClick={() => void handleSaveProduct()} disabled={!canManageStock || savingProduct}>
                  {savingProduct ? 'A guardar...' : productModal.id ? 'Atualizar artigo' : 'Criar artigo'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    )
  }

  // =================== CATEGORIES VIEW ===================
  if (subView === 'categories') {
    return (
      <section className="module-layout">
        <div className="module-header">
          <div className="stock-breadcrumb">
            <button type="button" className="ghost-button stock-back-btn" onClick={goToMenu}>← Stock</button>
            <div>
              <p className="eyebrow">Stock · Categorias</p>
              <h3 className="section-title">Famílias de produtos</h3>
            </div>
          </div>
          <div className="chip-group">
            <span className="chip">{visibleRootCategories.length} categorias</span>
            {canManageStock && (
              <button type="button" className="primary-button" onClick={() => setCategoryModal(emptyCategoryForm())}>
                + Nova categoria
              </button>
            )}
          </div>
        </div>

        <DeptFilterBar />

        <article className="panel">
          <div className="panel-head">
            <h4>Categorias principais</h4>
            <span className="chip">{visibleRootCategories.length}</span>
          </div>
          <div className="record-list">
            {visibleRootCategories.length === 0 && <p className="empty-state">Nenhuma categoria encontrada.</p>}
            {visibleRootCategories.map((cat) => (
              <button key={cat.id} type="button" className="record-row" onClick={() => setCategoryModal(buildCategoryForm(cat))}>
                <div className="record-main">
                  <strong>{cat.name}</strong>
                  <small>{cat.department} · {cat.description || 'Sem descrição'}</small>
                </div>
                <span className="chip">{cat.child_count ?? 0} sub</span>
              </button>
            ))}
          </div>
        </article>

        {/* Category Modal */}
        {categoryModal !== null && (
          <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setCategoryModal(null) }}>
            <div className="modal-panel">
              <div className="modal-header">
                <div>
                  <p className="eyebrow">Stock · Categorias</p>
                  <h4 className="section-title" style={{ margin: 0 }}>
                    {categoryModal.id ? 'Editar categoria' : 'Nova categoria'}
                  </h4>
                </div>
                <button type="button" className="modal-close" onClick={() => setCategoryModal(null)}>✕</button>
              </div>
              <div className="form-grid">
                <TouchSelect
                  label="Departamento"
                  value={categoryModal.department}
                  onChange={(v) => setCategoryModal((f) => f ? { ...f, department: v as DepartmentId, parent_id: '' } : f)}
                  options={departmentOptions}
                />
                <TouchInput
                  label="Nome da categoria"
                  value={categoryModal.name}
                  onChange={(v) => setCategoryModal((f) => f ? { ...f, name: v } : f)}
                />
              </div>
              <TouchTextarea
                label="Descrição"
                value={categoryModal.description}
                onChange={(v) => setCategoryModal((f) => f ? { ...f, description: v } : f)}
                rows={3}
              />
              <div className="toggle-grid">
                <label className="toggle-card">
                  <input type="checkbox" checked={categoryModal.active} onChange={(e) => setCategoryModal((f) => f ? { ...f, active: e.target.checked } : f)} />
                  <span>Categoria ativa</span>
                </label>
              </div>
              <div className="form-actions">
                <button type="button" className="ghost-button" onClick={() => setCategoryModal(null)}>Cancelar</button>
                <button type="button" className="primary-button" onClick={() => void handleSaveCategory()} disabled={!canManageStock || savingCategory}>
                  {savingCategory ? 'A guardar...' : categoryModal.id ? 'Atualizar categoria' : 'Criar categoria'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    )
  }

  // =================== SUBCATEGORIES VIEW ===================
  if (subView === 'subcategories') {
    return (
      <section className="module-layout">
        <div className="module-header">
          <div className="stock-breadcrumb">
            <button type="button" className="ghost-button stock-back-btn" onClick={goToMenu}>← Stock</button>
            <div>
              <p className="eyebrow">Stock · Subcategorias</p>
              <h3 className="section-title">Agrupamentos detalhados</h3>
            </div>
          </div>
          <div className="chip-group">
            <span className="chip">{visibleSubCategories.length} subcategorias</span>
            {canManageStock && (
              <button type="button" className="primary-button" onClick={() => setCategoryModal(emptyCategoryForm())}>
                + Nova subcategoria
              </button>
            )}
          </div>
        </div>

        <DeptFilterBar />

        <article className="panel">
          <div className="panel-head">
            <h4>Subcategorias</h4>
            <span className="chip">{visibleSubCategories.length}</span>
          </div>
          <div className="record-list">
            {visibleSubCategories.length === 0 && <p className="empty-state">Nenhuma subcategoria encontrada.</p>}
            {visibleSubCategories.map((cat) => (
              <button key={cat.id} type="button" className="record-row" onClick={() => setCategoryModal(buildCategoryForm(cat))}>
                <div className="record-main">
                  <strong>{cat.name}</strong>
                  <small>{cat.full_name ?? cat.name} · {cat.department}</small>
                </div>
              </button>
            ))}
          </div>
        </article>

        {/* Subcategory Modal */}
        {categoryModal !== null && (
          <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setCategoryModal(null) }}>
            <div className="modal-panel">
              <div className="modal-header">
                <div>
                  <p className="eyebrow">Stock · Subcategorias</p>
                  <h4 className="section-title" style={{ margin: 0 }}>
                    {categoryModal.id ? 'Editar subcategoria' : 'Nova subcategoria'}
                  </h4>
                </div>
                <button type="button" className="modal-close" onClick={() => setCategoryModal(null)}>✕</button>
              </div>
              <div className="form-grid">
                <TouchSelect
                  label="Departamento"
                  value={categoryModal.department}
                  onChange={(v) => setCategoryModal((f) => f ? { ...f, department: v as DepartmentId, parent_id: '' } : f)}
                  options={departmentOptions}
                />
                <TouchSelect
                  label="Categoria pai"
                  value={categoryModal.parent_id}
                  onChange={(v) => setCategoryModal((f) => f ? { ...f, parent_id: v } : f)}
                  options={rootCategoryOptions.filter((o) => o.value !== categoryModal.id)}
                  helperText="Selecione a categoria principal desta subcategoria."
                />
                <TouchInput
                  label="Nome da subcategoria"
                  value={categoryModal.name}
                  onChange={(v) => setCategoryModal((f) => f ? { ...f, name: v } : f)}
                />
              </div>
              <TouchTextarea
                label="Descrição"
                value={categoryModal.description}
                onChange={(v) => setCategoryModal((f) => f ? { ...f, description: v } : f)}
                rows={3}
              />
              <div className="toggle-grid">
                <label className="toggle-card">
                  <input type="checkbox" checked={categoryModal.active} onChange={(e) => setCategoryModal((f) => f ? { ...f, active: e.target.checked } : f)} />
                  <span>Subcategoria ativa</span>
                </label>
              </div>
              <div className="form-actions">
                <button type="button" className="ghost-button" onClick={() => setCategoryModal(null)}>Cancelar</button>
                <button type="button" className="primary-button" onClick={() => void handleSaveCategory()} disabled={!canManageStock || savingCategory}>
                  {savingCategory ? 'A guardar...' : categoryModal.id ? 'Atualizar subcategoria' : 'Criar subcategoria'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    )
  }

  // =================== MOVEMENTS VIEW ===================
  return (
    <section className="module-layout">
      <div className="module-header">
        <div className="stock-breadcrumb">
          <button type="button" className="ghost-button stock-back-btn" onClick={goToMenu}>← Stock</button>
          <div>
            <p className="eyebrow">Stock · Movimentos</p>
            <h3 className="section-title">Registo de movimentos</h3>
          </div>
        </div>
        <div className="chip-group">
          <span className="chip">{filteredMovements.length} movimentos</span>
          {canManageStock && (
            <button type="button" className="primary-button" onClick={() => setMovementModal(emptyMovementForm())}>
              + Registar movimento
            </button>
          )}
        </div>
      </div>

      <DeptFilterBar />

      <article className="panel">
        <div className="panel-head">
          <h4>Histórico recente</h4>
          <span className="chip">{filteredMovements.length}</span>
        </div>
        <div className="timeline-list">
          {filteredMovements.length === 0 && <p className="empty-state">Nenhum movimento registado.</p>}
          {filteredMovements.map((movement) => {
            const canUndo = canManageStock && latestMovementIds.has(movement.id)
            return (
              <div key={movement.id} className="timeline-item timeline-item--stack">
                <div>
                  <strong>{movement.product_name}</strong>
                  <small>{movement.reference_type} · {movement.reference_code || 'Sem código'} · {formatDateTime(movement.created_at)}</small>
                </div>
                <div className="timeline-meta">
                  <span>{movement.movement_type} · {movement.quantity}</span>
                  <small>{movement.stock_before} → {movement.stock_after}</small>
                </div>
                {canUndo && (
                  <button type="button" className="ghost-button" onClick={() => void handleDeleteMovement(movement.id)}>
                    Anular
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </article>

      {/* Movement Modal */}
      {movementModal !== null && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setMovementModal(null) }}>
          <div className="modal-panel">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Stock · Movimentos</p>
                <h4 className="section-title" style={{ margin: 0 }}>Registar movimento</h4>
              </div>
              <button type="button" className="modal-close" onClick={() => setMovementModal(null)}>✕</button>
            </div>
            <div className="form-grid">
              <TouchSelect
                label="Artigo"
                value={movementModal.product_id}
                onChange={(v) => setMovementModal((f) => f ? { ...f, product_id: v } : f)}
                options={filteredProducts.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))}
              />
              <TouchSelect
                label="Tipo de movimento"
                value={movementModal.movement_type}
                onChange={(v) => setMovementModal((f) => f ? { ...f, movement_type: v as StockMovementType } : f)}
                options={movementTypeOptions}
              />
              <TouchSelect
                label="Referência"
                value={movementModal.reference_type}
                onChange={(v) => setMovementModal((f) => f ? { ...f, reference_type: v as StockReferenceType } : f)}
                options={referenceOptions}
              />
              <TouchInput
                label="Código de referência"
                value={movementModal.reference_code}
                onChange={(v) => setMovementModal((f) => f ? { ...f, reference_code: v } : f)}
              />
              <TouchNumberInput
                label={movementModal.movement_type === 'adjustment' ? 'Stock contado' : 'Quantidade'}
                value={movementModal.quantity}
                onChange={(v) => setMovementModal((f) => f ? { ...f, quantity: v } : f)}
              />
              <TouchNumberInput
                label="Custo unitário"
                value={movementModal.unit_cost}
                onChange={(v) => setMovementModal((f) => f ? { ...f, unit_cost: v } : f)}
              />
            </div>
            <TouchTextarea
              label="Notas"
              value={movementModal.notes}
              onChange={(v) => setMovementModal((f) => f ? { ...f, notes: v } : f)}
              rows={3}
            />
            <div className="form-actions">
              <button type="button" className="ghost-button" onClick={() => setMovementModal(null)}>Cancelar</button>
              <button type="button" className="primary-button" onClick={() => void handleSaveMovement()} disabled={!canManageStock || savingMovement}>
                {savingMovement ? 'A registar...' : 'Registar movimento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
